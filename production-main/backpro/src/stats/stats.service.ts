// src/stats/stats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
  ) {}

  // Méthode utilitaire pour obtenir la quantité source
  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  // Méthode pour calculer le pourcentage d'écart
  private calculerEcartPourcentage(total5M: number, quantiteSource: number): number {
    if (quantiteSource <= 0) return 0;
    const pourcentage = (total5M / quantiteSource) * 100;
    return Math.round(pourcentage * 10) / 10;
  }

  async getStatsBySemaineAndLigne(semaine: string, ligne: string) {
    console.log(`=== CALCUL STATISTIQUES POUR ${ligne} - ${semaine} ===`);

    // 1. Récupérer toutes les planifications pour cette semaine et ligne
    const planifications = await this.planificationRepository.find({
      where: { 
        semaine: semaine,
        ligne: ligne
      },
      relations: ['nonConformites'],
      order: { jour: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la ligne ${ligne} dans la semaine ${semaine}`
      );
    }

    // 2. Initialiser les totaux
    let totalQtePlanifiee = 0;
    let totalQteModifiee = 0;
    let totalQteSource = 0;
    let totalDecProduction = 0;
    let totalDeltaProd = 0;
    
    // Pour les non-conformités
    let totalEcart = 0; // Somme des totaux 5M
    let totalEcartMatierePremiere = 0;
    let totalEcartAbsence = 0;
    let totalEcartRendement = 0;
    let totalEcartMaintenance = 0;
    let totalEcartQualite = 0;

    // Groupement par référence
    const statsParReference: Record<string, any> = {};
    const referencesUniques = new Set<string>();

    // 3. Parcourir toutes les planifications
    for (const plan of planifications) {
      const quantiteSource = this.getQuantitySource(plan);
      
      // Mise à jour des totaux globaux
      totalQtePlanifiee += plan.qtePlanifiee;
      totalQteModifiee += plan.qteModifiee;
      totalQteSource += quantiteSource;
      totalDecProduction += plan.decProduction;
      totalDeltaProd += plan.deltaProd;

      // Grouper par référence
      if (!statsParReference[plan.reference]) {
        statsParReference[plan.reference] = {
          reference: plan.reference,
          totalQtePlanifiee: 0,
          totalQteModifiee: 0,
          totalQteSource: 0,
          totalDecProduction: 0,
          totalEcart: 0,
          detailsParJour: {},
          nonConformites: []
        };
      }

      // Mise à jour des stats par référence
      const refStats = statsParReference[plan.reference];
      refStats.totalQtePlanifiee += plan.qtePlanifiee;
      refStats.totalQteModifiee += plan.qteModifiee;
      refStats.totalQteSource += quantiteSource;
      refStats.totalDecProduction += plan.decProduction;

      // Initialiser le jour dans la référence
      if (!refStats.detailsParJour[plan.jour]) {
        refStats.detailsParJour[plan.jour] = {
          qtePlanifiee: 0,
          qteModifiee: 0,
          qteSource: 0,
          decProduction: 0,
          pcsProd: 0,
          ecart: 0,
          ecartPourcentage: 0
        };
      }

      const jourStats = refStats.detailsParJour[plan.jour];
      jourStats.qtePlanifiee += plan.qtePlanifiee;
      jourStats.qteModifiee += plan.qteModifiee;
      jourStats.qteSource += quantiteSource;
      jourStats.decProduction += plan.decProduction;
      jourStats.pcsProd = jourStats.qteSource > 0 ? 
        (jourStats.decProduction / jourStats.qteSource) * 100 : 0;

      // Traitement des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        // Totaux globaux par cause
        totalEcart += nonConf.total;
        totalEcartMatierePremiere += nonConf.matierePremiere;
        totalEcartAbsence += nonConf.absence;
        totalEcartRendement += nonConf.rendement;
        totalEcartMaintenance += nonConf.maintenance;
        totalEcartQualite += nonConf.qualite;

        // Mise à jour référence
        refStats.totalEcart += nonConf.total;
        jourStats.ecart += nonConf.total;
        jourStats.ecartPourcentage = this.calculerEcartPourcentage(
          jourStats.ecart,
          jourStats.qteSource
        );

        // Ajouter détail non-conformité
        refStats.nonConformites.push({
          jour: plan.jour,
          matierePremiere: nonConf.matierePremiere,
          referenceMatierePremiere: nonConf.referenceMatierePremiere,
          absence: nonConf.absence,
          rendement: nonConf.rendement,
          maintenance: nonConf.maintenance,
          qualite: nonConf.qualite,
          total: nonConf.total,
          ecartPourcentage: nonConf.ecartPourcentage || this.calculerEcartPourcentage(nonConf.total, quantiteSource),
          commentaire: nonConf.commentaire
        });
      }

      referencesUniques.add(plan.reference);
    }

    // 4. Calculer les pourcentages finaux
    const pcsProdTotal = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;
    const pourcentageTotalEcart = totalQteSource > 0 ? (totalEcart / totalQteSource) * 100 : 0;

    // 5. Calculer la répartition des écarts par cause
    const repartitionEcartParCause = {
      matierePremiere: {
        quantite: totalEcartMatierePremiere,
        pourcentage: totalEcart > 0 ? (totalEcartMatierePremiere / totalEcart) * 100 : 0
      },
      absence: {
        quantite: totalEcartAbsence,
        pourcentage: totalEcart > 0 ? (totalEcartAbsence / totalEcart) * 100 : 0
      },
      rendement: {
        quantite: totalEcartRendement,
        pourcentage: totalEcart > 0 ? (totalEcartRendement / totalEcart) * 100 : 0
      },
      maintenance: {
        quantite: totalEcartMaintenance,
        pourcentage: totalEcart > 0 ? (totalEcartMaintenance / totalEcart) * 100 : 0
      },
      qualite: {
        quantite: totalEcartQualite,
        pourcentage: totalEcart > 0 ? (totalEcartQualite / totalEcart) * 100 : 0
      }
    };

    // 6. Formater les stats par référence
    const statsParReferenceFormate = Object.values(statsParReference).map((ref: any) => {
      const pcsProdRef = ref.totalQteSource > 0 ? 
        (ref.totalDecProduction / ref.totalQteSource) * 100 : 0;
      
      const pourcentageEcartRef = ref.totalQteSource > 0 ? 
        (ref.totalEcart / ref.totalQteSource) * 100 : 0;

      return {
        reference: ref.reference,
        totalQtePlanifiee: ref.totalQtePlanifiee,
        totalQteModifiee: ref.totalQteModifiee,
        totalQteSource: ref.totalQteSource,
        totalDecProduction: ref.totalDecProduction,
        pcsProd: Math.round(pcsProdRef * 100) / 100,
        totalEcart: ref.totalEcart,
        pourcentageEcart: Math.round(pourcentageEcartRef * 10) / 10,
        detailsParJour: Object.entries(ref.detailsParJour).map(([jour, data]: [string, any]) => ({
          jour,
          qtePlanifiee: data.qtePlanifiee,
          qteModifiee: data.qteModifiee,
          qteSource: data.qteSource,
          decProduction: data.decProduction,
          pcsProd: Math.round(data.pcsProd * 100) / 100,
          ecart: data.ecart,
          ecartPourcentage: Math.round(data.ecartPourcentage * 10) / 10
        })),
        nonConformites: ref.nonConformites
      };
    });

    // 7. Préparer la réponse finale
    const response = {
      message: `Statistiques pour la ligne ${ligne} - Semaine ${semaine}`,
      periode: {
        semaine: semaine,
        ligne: ligne,
        dateCalcul: new Date().toISOString()
      },
      resumeGeneral: {
        nombrePlanifications: planifications.length,
        nombreReferences: referencesUniques.size,
        totalQtePlanifiee: totalQtePlanifiee,
        totalQteModifiee: totalQteModifiee,
        totalQteSource: totalQteSource,
        totalDecProduction: totalDecProduction,
        deltaProdTotal: totalDeltaProd,
        pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
        totalEcart: totalEcart,
        pourcentageTotalEcart: Math.round(pourcentageTotalEcart * 10) / 10
      },
      repartitionEcartParCause,
      statsParReference: statsParReferenceFormate,
      details: planifications.map(plan => ({
        id: plan.id,
        jour: plan.jour,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        decProduction: plan.decProduction,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees
      }))
    };

    console.log(`=== FIN STATISTIQUES POUR ${ligne} - ${semaine} ===`);
    return response;
  }

  // Méthode pour obtenir toutes les statistiques (si besoin)
  async getAllStats(semaine?: string) {
    // Logique pour récupérer toutes les statistiques
    // (à implémenter si nécessaire)
  }
  // Modifications dans stats.service.ts
// Ajoutez cette méthode à la fin de la classe StatsService :

async getPcsProdTotalParLigne(semaine: string) {
  console.log(`=== CALCUL PCS PROD TOTAL PAR LIGNE POUR ${semaine} ===`);

  // 1. Récupérer toutes les planifications pour cette semaine
  const planifications = await this.planificationRepository.find({
    where: { 
      semaine: semaine
    },
    relations: ['nonConformites'],
    order: { ligne: 'ASC', jour: 'ASC', reference: 'ASC' }
  });

  if (planifications.length === 0) {
    throw new NotFoundException(
      `Aucune planification trouvée pour la semaine ${semaine}`
    );
  }

  // 2. Grouper par ligne
  const statsParLigne: Record<string, any> = {};

  // 3. Parcourir toutes les planifications
  for (const plan of planifications) {
    const quantiteSource = this.getQuantitySource(plan);
    const ligne = plan.ligne;
    
    // Initialiser la ligne si elle n'existe pas
    if (!statsParLigne[ligne]) {
      statsParLigne[ligne] = {
        ligne: ligne,
        totalQteSource: 0,
        totalDecProduction: 0,
        nombreReferences: new Set<string>(),
        nombrePlanifications: 0,
        detailsParReference: {}
      };
    }

    // Mise à jour des totaux par ligne
    const ligneStats = statsParLigne[ligne];
    ligneStats.totalQteSource += quantiteSource;
    ligneStats.totalDecProduction += plan.decProduction;
    ligneStats.nombrePlanifications += 1;
    ligneStats.nombreReferences.add(plan.reference);

    // Détails par référence (optionnel)
    if (!ligneStats.detailsParReference[plan.reference]) {
      ligneStats.detailsParReference[plan.reference] = {
        totalQteSource: 0,
        totalDecProduction: 0
      };
    }
    ligneStats.detailsParReference[plan.reference].totalQteSource += quantiteSource;
    ligneStats.detailsParReference[plan.reference].totalDecProduction += plan.decProduction;
  }

  // 4. Formater la réponse
  const resultat = Object.values(statsParLigne).map((ligne: any) => {
    const pcsProdTotal = ligne.totalQteSource > 0 ? 
      (ligne.totalDecProduction / ligne.totalQteSource) * 100 : 0;

    return {
      ligne: ligne.ligne,
      nombrePlanifications: ligne.nombrePlanifications,
      nombreReferences: ligne.nombreReferences.size,
      totalQteSource: ligne.totalQteSource,
      totalDecProduction: ligne.totalDecProduction,
      pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
      // Optionnel: ajouter les références avec leur pcsProd
      references: Object.entries(ligne.detailsParReference).map(([ref, data]: [string, any]) => ({
        reference: ref,
        pcsProd: Math.round((data.totalDecProduction / data.totalQteSource) * 10000) / 100
      }))
    };
  });

  // 5. Trier par ligne (optionnel)
  resultat.sort((a, b) => a.ligne.localeCompare(b.ligne));

  console.log(`=== FIN PCS PROD TOTAL PAR LIGNE POUR ${semaine} ===`);
  return {
    message: `PCS Prod Total par ligne pour la semaine ${semaine}`,
    semaine: semaine,
    dateCalcul: new Date().toISOString(),
    nombreLignes: resultat.length,
    lignes: resultat
  };
}
}