// src/stats/stats.service.ts
import { Injectable, NotFoundException,InternalServerErrorException } from '@nestjs/common';
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
async getStatsPourcentage5MParSemaine(semaine: string) {
  console.log(`=== CALCUL POURCENTAGE 5M POUR SEMAINE ${semaine} ===`);

  try {
    // 1. Récupérer toutes les planifications de la semaine
    const planifications = await this.planificationRepository.find({
      where: { semaine: semaine },
      relations: ['nonConformites']
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    // 2. Calculer la quantité totale planifiée
    let totalQuantitePlanifiee = 0;
    
    // 3. Initialiser les totaux pour chaque cause 5M
    let totalMatierePremiere = 0;
    let totalAbsence = 0;
    let totalRendement = 0;
    let totalMaintenance = 0;
    let totalQualite = 0;
    let total5M = 0;

    // 4. Parcourir toutes les planifications
    for (const plan of planifications) {
      // Quantité source pour cette planification
      const quantiteSource = this.getQuantitySource(plan);
      totalQuantitePlanifiee += quantiteSource;

      // Vérifier s'il y a des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0]; // Normalement une seule
        
        // Ajouter aux totaux par cause
        totalMatierePremiere += nonConf.matierePremiere;
        totalAbsence += nonConf.absence;
        totalRendement += nonConf.rendement;
        totalMaintenance += nonConf.maintenance;
        totalQualite += nonConf.qualite;
        
        // Total 5M
        total5M += nonConf.total;
      }
    }

    console.log('Totaux calculés:', {
      totalQuantitePlanifiee,
      totalMatierePremiere,
      totalAbsence,
      totalRendement,
      totalMaintenance,
      totalQualite,
      total5M
    });

    // 5. Calculer les pourcentages
    const calculerPourcentage = (totalCause: number): number => {
      if (totalQuantitePlanifiee <= 0) return 0;
      const pourcentage = (totalCause / totalQuantitePlanifiee) * 100;
      return Math.round(pourcentage * 10) / 10; // Une décimale
    };

    const pourcentageMatierePremiere = calculerPourcentage(totalMatierePremiere);
    const pourcentageAbsence = calculerPourcentage(totalAbsence);
    const pourcentageRendement = calculerPourcentage(totalRendement);
    const pourcentageMaintenance = calculerPourcentage(totalMaintenance);
    const pourcentageQualite = calculerPourcentage(totalQualite);
    const pourcentageTotal5M = calculerPourcentage(total5M);

    // 6. Calculer la répartition des 5M (pourcentage de chaque cause dans le total 5M)
    const calculerPourcentageDans5M = (totalCause: number): number => {
      if (total5M <= 0) return 0;
      const pourcentage = (totalCause / total5M) * 100;
      return Math.round(pourcentage * 10) / 10; // Une décimale
    };

    const pourcentageDans5MMatierePremiere = calculerPourcentageDans5M(totalMatierePremiere);
    const pourcentageDans5MAbsence = calculerPourcentageDans5M(totalAbsence);
    const pourcentageDans5MRendement = calculerPourcentageDans5M(totalRendement);
    const pourcentageDans5MMaintenance = calculerPourcentageDans5M(totalMaintenance);
    const pourcentageDans5MQualite = calculerPourcentageDans5M(totalQualite);

    // 7. Préparer la réponse
    const response = {
      message: `Pourcentages des 5M pour la semaine ${semaine}`,
      periode: {
        semaine: semaine,
        dateCalcul: new Date().toISOString(),
        nombrePlanifications: planifications.length
      },
      resume: {
        totalQuantitePlanifiee: totalQuantitePlanifiee,
        total5M: total5M,
        pourcentageTotal5M: `${pourcentageTotal5M}%`,
        pourcentageTotal5MNumber: pourcentageTotal5M
      },
      pourcentagesParCause: {
        matierePremiere: {
          total: totalMatierePremiere,
          pourcentage: `${pourcentageMatierePremiere}%`,
          pourcentageNumber: pourcentageMatierePremiere,
          pourcentageDansTotal5M: `${pourcentageDans5MMatierePremiere}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MMatierePremiere
        },
        absence: {
          total: totalAbsence,
          pourcentage: `${pourcentageAbsence}%`,
          pourcentageNumber: pourcentageAbsence,
          pourcentageDansTotal5M: `${pourcentageDans5MAbsence}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MAbsence
        },
        rendement: {
          total: totalRendement,
          pourcentage: `${pourcentageRendement}%`,
          pourcentageNumber: pourcentageRendement,
          pourcentageDansTotal5M: `${pourcentageDans5MRendement}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MRendement
        },
        maintenance: {
          total: totalMaintenance,
          pourcentage: `${pourcentageMaintenance}%`,
          pourcentageNumber: pourcentageMaintenance,
          pourcentageDansTotal5M: `${pourcentageDans5MMaintenance}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MMaintenance
        },
        qualite: {
          total: totalQualite,
          pourcentage: `${pourcentageQualite}%`,
          pourcentageNumber: pourcentageQualite,
          pourcentageDansTotal5M: `${pourcentageDans5MQualite}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MQualite
        }
      },
      // Optionnel: Résumé en tableau pour faciliter l'affichage
      resumeTableau: [
        {
          cause: 'Matière Première',
          total: totalMatierePremiere,
          pourcentage: pourcentageMatierePremiere,
          pourcentageDans5M: pourcentageDans5MMatierePremiere
        },
        {
          cause: 'Absence',
          total: totalAbsence,
          pourcentage: pourcentageAbsence,
          pourcentageDans5M: pourcentageDans5MAbsence
        },
        {
          cause: 'Rendement',
          total: totalRendement,
          pourcentage: pourcentageRendement,
          pourcentageDans5M: pourcentageDans5MRendement
        },
        {
          cause: 'Maintenance',
          total: totalMaintenance,
          pourcentage: pourcentageMaintenance,
          pourcentageDans5M: pourcentageDans5MMaintenance
        },
        {
          cause: 'Qualité',
          total: totalQualite,
          pourcentage: pourcentageQualite,
          pourcentageDans5M: pourcentageDans5MQualite
        }
      ]
    };

    console.log(`=== FIN POURCENTAGE 5M POUR SEMAINE ${semaine} ===`);
    return response;

  } catch (error) {
    console.error(`Erreur dans getStatsPourcentage5MParSemaine:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des pourcentages 5M: ${error.message}`
    );
  }
}
// Dans stats.service.ts - Ajoute cette nouvelle méthode
async getPourcentage5MParLigne(semaine: string) {
  console.log(`=== CALCUL POURCENTAGE 5M PAR LIGNE POUR SEMAINE ${semaine} ===`);

  try {
    // 1. Récupérer toutes les planifications de la semaine
    const planifications = await this.planificationRepository.find({
      where: { semaine: semaine },
      relations: ['nonConformites'],
      order: { ligne: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    // 2. Grouper les données par ligne
    const statsParLigne: Record<string, any> = {};

    // 3. Parcourir toutes les planifications
    for (const plan of planifications) {
      const ligne = plan.ligne;
      const quantiteSource = this.getQuantitySource(plan);

      // Initialiser la ligne si elle n'existe pas
      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne: ligne,
          totalQuantiteSource: 0,
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          maintenance: 0,
          qualite: 0,
          total5M: 0,
          nombrePlanifications: 0,
          references: new Set<string>()
        };
      }

      // Mettre à jour les totaux
      const ligneStats = statsParLigne[ligne];
      ligneStats.totalQuantiteSource += quantiteSource;
      ligneStats.nombrePlanifications += 1;
      ligneStats.references.add(plan.reference);

      // Ajouter les non-conformités si elles existent
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        ligneStats.matierePremiere += nonConf.matierePremiere;
        ligneStats.absence += nonConf.absence;
        ligneStats.rendement += nonConf.rendement;
        ligneStats.maintenance += nonConf.maintenance;
        ligneStats.qualite += nonConf.qualite;
        ligneStats.total5M += nonConf.total;
      }
    }

    // 4. Fonction pour calculer le pourcentage
    const calculerPourcentage = (valeur: number, total: number): number => {
      if (total <= 0) return 0;
      return Math.round((valeur / total) * 100 * 10) / 10; // Une décimale
    };

    // 5. Calculer les pourcentages pour chaque ligne
    const resultats = Object.values(statsParLigne).map((ligne: any) => {
      const pourcentage5M = calculerPourcentage(ligne.total5M, ligne.totalQuantiteSource);
      
      // Calculer la répartition des causes dans le total 5M
      const calculerPourcentageDans5M = (cause: number): number => {
        if (ligne.total5M <= 0) return 0;
        return Math.round((cause / ligne.total5M) * 100 * 10) / 10;
      };

      return {
        ligne: ligne.ligne,
        nombrePlanifications: ligne.nombrePlanifications,
        nombreReferences: ligne.references.size,
        totalQuantiteSource: ligne.totalQuantiteSource,
        total5M: ligne.total5M,
        pourcentage5M: pourcentage5M,
        detailParCause: {
          matierePremiere: {
            quantite: ligne.matierePremiere,
            pourcentage: calculerPourcentageDans5M(ligne.matierePremiere),
            pourcentageDuTotal: calculerPourcentage(ligne.matierePremiere, ligne.totalQuantiteSource)
          },
          absence: {
            quantite: ligne.absence,
            pourcentage: calculerPourcentageDans5M(ligne.absence),
            pourcentageDuTotal: calculerPourcentage(ligne.absence, ligne.totalQuantiteSource)
          },
          rendement: {
            quantite: ligne.rendement,
            pourcentage: calculerPourcentageDans5M(ligne.rendement),
            pourcentageDuTotal: calculerPourcentage(ligne.rendement, ligne.totalQuantiteSource)
          },
          maintenance: {
            quantite: ligne.maintenance,
            pourcentage: calculerPourcentageDans5M(ligne.maintenance),
            pourcentageDuTotal: calculerPourcentage(ligne.maintenance, ligne.totalQuantiteSource)
          },
          qualite: {
            quantite: ligne.qualite,
            pourcentage: calculerPourcentageDans5M(ligne.qualite),
            pourcentageDuTotal: calculerPourcentage(ligne.qualite, ligne.totalQuantiteSource)
          }
        },
        // Version simplifiée pour tableau
        resumeTableau: [
          { cause: 'Matière Première', quantite: ligne.matierePremiere, pourcentage5M: calculerPourcentageDans5M(ligne.matierePremiere) },
          { cause: 'Absence', quantite: ligne.absence, pourcentage5M: calculerPourcentageDans5M(ligne.absence) },
          { cause: 'Rendement', quantite: ligne.rendement, pourcentage5M: calculerPourcentageDans5M(ligne.rendement) },
          { cause: 'Maintenance', quantite: ligne.maintenance, pourcentage5M: calculerPourcentageDans5M(ligne.maintenance) },
          { cause: 'Qualité', quantite: ligne.qualite, pourcentage5M: calculerPourcentageDans5M(ligne.qualite) }
        ]
      };
    });

    // 6. Trier par pourcentage 5M décroissant
    resultats.sort((a, b) => b.pourcentage5M - a.pourcentage5M);

    // 7. Calculer les totaux globaux
    const totalGlobal = {
      totalQuantiteSource: resultats.reduce((sum, ligne) => sum + ligne.totalQuantiteSource, 0),
      total5M: resultats.reduce((sum, ligne) => sum + ligne.total5M, 0),
      pourcentage5MGlobal: 0
    };
    
    totalGlobal.pourcentage5MGlobal = calculerPourcentage(
      totalGlobal.total5M, 
      totalGlobal.totalQuantiteSource
    );

    // 8. Préparer la réponse
    const response = {
      message: `Pourcentages 5M par ligne pour la semaine ${semaine}`,
      periode: {
        semaine: semaine,
        dateCalcul: new Date().toISOString(),
        nombreTotalPlanifications: planifications.length,
        nombreLignes: resultats.length
      },
      resumeGlobal: {
        totalQuantiteSource: totalGlobal.totalQuantiteSource,
        total5M: totalGlobal.total5M,
        pourcentage5MGlobal: totalGlobal.pourcentage5MGlobal
      },
      lignes: resultats,
      // Pour faciliter la génération de graphiques
      resumePourGraphique: {
        labels: resultats.map(l => l.ligne),
        pourcentages: resultats.map(l => l.pourcentage5M),
        totaux: resultats.map(l => l.total5M)
      }
    };

    console.log(`=== FIN POURCENTAGE 5M PAR LIGNE POUR SEMAINE ${semaine} ===`);
    return response;

  } catch (error) {
    console.error(`Erreur dans getPourcentage5MParLigne:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des pourcentages 5M par ligne: ${error.message}`
    );
  }
}
}