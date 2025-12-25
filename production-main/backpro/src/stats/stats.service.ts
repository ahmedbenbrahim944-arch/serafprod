// src/stats/stats.service.ts
import { Injectable, NotFoundException, InternalServerErrorException,BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { Semaine } from '../semaine/entities/semaine.entity';
import {MoreThanOrEqual, LessThanOrEqual} from "typeorm";


@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Semaine)
private semaineRepository: Repository<Semaine>,
  ) {}

  // Méthode utilitaire pour obtenir la quantité source
 

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
async getStatsParDate(getStatsDateDto: GetStatsDateDto) {
    const { date } = getStatsDateDto;
   
    
    console.log(`=== CALCUL STATS POUR LA DATE ${date} ===`);

    try {
      // 1. Convertir la date en semaine et jour (ATTENTION: méthode synchrone)
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date); // PAS de "await"
      
      console.log(`Date ${date} convertie en: semaine="${semaine}", jour="${jour}"`);

      // 2. Récupérer les stats de production par ligne
      const statsProduction = await this.getProductionParLigneDate(semaine, jour);

      // 3. Récupérer les stats de saisie des rapports
      const statsRapports = await this.getRapportsSaisieStats(semaine, jour);

      // 4. Préparer la réponse complète
      const response = {
        message: `Statistiques complètes pour le ${date}`,
        periode: {
          date: date,
          jour: jour,
          semaine: semaine,
          dateCalcul: new Date().toISOString()
        },
        productionParLigne: statsProduction.lignes,
        resumeProduction: {
          nombreLignes: statsProduction.nombreLignes,
          totalQteSource: statsProduction.totalQteSource,
          totalDecProduction: statsProduction.totalDecProduction,
          pcsProdMoyen: statsProduction.pcsProdMoyen,
          total5M: statsProduction.total5M,
          pourcentage5MMoyen: statsProduction.pourcentage5MMoyen
        },
        rapportsSaisie: statsRapports
      };

      console.log(`=== FIN CALCUL STATS POUR ${date} ===`);
      return response;

    } catch (error) {
      console.error(`Erreur dans getStatsParDate:`, error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors du calcul des statistiques pour la date ${date}: ${error.message}`
      );
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Stats de production par ligne pour une date
   */
  private async getProductionParLigneDate(semaine: string, jour: string) {
    // Récupérer toutes les planifications pour ce jour
    const planifications = await this.planificationRepository.find({
      where: { semaine, jour },
      relations: ['nonConformites'],
      order: { ligne: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour le ${jour} de la semaine ${semaine}`
      );
    }

    // Grouper par ligne
    const statsParLigne: Record<string, any> = {};

    for (const plan of planifications) {
      const ligne = plan.ligne;
      const quantiteSource = this.getQuantitySource(plan);

      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne: ligne,
          totalQteSource: 0,
          totalDecProduction: 0,
          total5M: 0,
          nombreReferences: new Set<string>(),
          nombrePlanifications: 0,
          references: []
        };
      }

      const ligneStats = statsParLigne[ligne];
      ligneStats.totalQteSource += quantiteSource;
      ligneStats.totalDecProduction += plan.decProduction;
      ligneStats.nombrePlanifications += 1;
      ligneStats.nombreReferences.add(plan.reference);

      // Ajouter les détails de la référence
      ligneStats.references.push({
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        qteSource: quantiteSource,
        decProduction: plan.decProduction,
        pcsProd: plan.pcsProd
      });

      // Traiter les non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        ligneStats.total5M += nonConf.total;
      }
    }

    // Calculer les pourcentages et formater
    const lignesFormatees = Object.values(statsParLigne).map((ligne: any) => {
      const pcsProd = ligne.totalQteSource > 0 
        ? (ligne.totalDecProduction / ligne.totalQteSource) * 100 
        : 0;
      
      const pourcentage5M = ligne.totalQteSource > 0
        ? (ligne.total5M / ligne.totalQteSource) * 100
        : 0;

      return {
        ligne: ligne.ligne,
        nombrePlanifications: ligne.nombrePlanifications,
        nombreReferences: ligne.nombreReferences.size,
        totalQteSource: ligne.totalQteSource,
        totalDecProduction: ligne.totalDecProduction,
        pcsProdTotal: Math.round(pcsProd * 100) / 100,
        total5M: ligne.total5M,
        pourcentage5M: Math.round(pourcentage5M * 10) / 10,
        references: ligne.references
      };
    });

    // Calculer les totaux globaux
    const totalQteSource = lignesFormatees.reduce((sum, l) => sum + l.totalQteSource, 0);
    const totalDecProduction = lignesFormatees.reduce((sum, l) => sum + l.totalDecProduction, 0);
    const total5M = lignesFormatees.reduce((sum, l) => sum + l.total5M, 0);
    
    const pcsProdMoyen = totalQteSource > 0 
      ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
      : 0;
    
    const pourcentage5MMoyen = totalQteSource > 0
      ? Math.round((total5M / totalQteSource) * 100 * 10) / 10
      : 0;

    return {
      nombreLignes: lignesFormatees.length,
      totalQteSource,
      totalDecProduction,
      pcsProdMoyen,
      total5M,
      pourcentage5MMoyen,
      lignes: lignesFormatees
    };
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Stats des rapports de saisie
   */
  private async getRapportsSaisieStats(semaine: string, jour: string) {
    // 1. Récupérer tous les rapports pour ce jour
    const rapports = await this.saisieRapportRepository.find({
      where: { semaine, jour },
      order: { ligne: 'ASC', matricule: 'ASC' }
    });

    // 2. Récupérer le nombre total d'ouvriers
    const totalOuvriers = await this.ouvrierRepository.count();

    // 3. Extraire les matricules ayant saisi
    const matriculesAyantSaisi = new Set(rapports.map(r => r.matricule));
    const nombreRapportsSaisis = matriculesAyantSaisi.size;

    // 4. Récupérer tous les ouvriers
    const tousLesOuvriers = await this.ouvrierRepository.find({
      order: { matricule: 'ASC' }
    });

    // 5. Identifier les ouvriers n'ayant pas saisi
    const ouvriersNonSaisis = tousLesOuvriers.filter(
      ouvrier => !matriculesAyantSaisi.has(ouvrier.matricule)
    ).map(ouvrier => ({
      matricule: ouvrier.matricule,
      nomPrenom: ouvrier.nomPrenom
    }));

    // 6. Liste des ouvriers ayant saisi avec leurs détails
    const ouvriersAyantSaisi = rapports.map(rapport => ({
      matricule: rapport.matricule,
      nomPrenom: rapport.nomPrenom,
      ligne: rapport.ligne,
      totalHeures: rapport.totalHeuresJour,
      nbPhases: rapport.nbPhasesJour,
      phases: rapport.phases
    }));

    // 7. Stats par ligne
    const statsParLigne: Record<string, any> = {};
    rapports.forEach(rapport => {
      if (!statsParLigne[rapport.ligne]) {
        statsParLigne[rapport.ligne] = {
          nombreOuvriers: 0,
          totalHeures: 0,
          ouvriers: []
        };
      }
      statsParLigne[rapport.ligne].nombreOuvriers++;
      statsParLigne[rapport.ligne].totalHeures += rapport.totalHeuresJour;
      statsParLigne[rapport.ligne].ouvriers.push({
        matricule: rapport.matricule,
        nomPrenom: rapport.nomPrenom,
        heures: rapport.totalHeuresJour
      });
    });

    // 8. Calculer le taux de saisie
    const tauxSaisie = totalOuvriers > 0 
      ? Math.round((nombreRapportsSaisis / totalOuvriers) * 100 * 10) / 10
      : 0;

    return {
      nombreRapportsSaisis: nombreRapportsSaisis,
      nombreTotalRapports: rapports.length,
      nombreOuvriersTotal: totalOuvriers,
      nombreOuvriersNonSaisis: ouvriersNonSaisis.length,
      tauxSaisie: tauxSaisie,
      ouvriersNonSaisis: ouvriersNonSaisis,
      ouvriersAyantSaisi: ouvriersAyantSaisi,
      repartitionParLigne: statsParLigne
    };
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Obtenir uniquement les stats de saisie pour une date
   */
   async getRapportsSaisieParDate(getStatsDateDto: GetStatsDateDto) {
    const { date } = getStatsDateDto;
    
    console.log(`=== CALCUL RAPPORTS SAISIE POUR ${date} ===`);

    try {
      // Convertir la date en semaine et jour
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      
      console.log(`Date ${date} convertie en: semaine=${semaine}, jour=${jour}`);

      const statsRapports = await this.getRapportsSaisieStats(semaine, jour);

      return {
        message: `Statistiques de saisie pour le ${date}`,
        periode: {
          date: date,
          jour: jour,
          semaine: semaine,
          dateCalcul: new Date().toISOString()
        },
        ...statsRapports
      };

    } catch (error) {
      console.error(`Erreur dans getRapportsSaisieParDate:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors du calcul des rapports de saisie: ${error.message}`
      );
    }
  }

  /**
   * Méthode utilitaire (déjà existante dans votre code)
   */
  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 
      ? planification.qteModifiee 
      : planification.qtePlanifiee;
  }
private convertirDateEnSemaineEtJour(dateStr: string): { semaine: string; jour: string } {
  try {
    const date = new Date(dateStr);
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Date invalide: ${dateStr}`);
    }

    // 1. CALCULER LE NUMÉRO DE SEMAINE (ISO)
    // Méthode standard pour calculer la semaine ISO
    const getISOWeeks = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };

    const numeroSemaine = getISOWeeks(date);
    
    // 2. FORMATER LA SEMAINE COMME DANS VOTRE BASE : "semaine5"
    const semaine = `semaine${numeroSemaine}`;
    
    // 3. FORMATER LE JOUR EN MINUSCULE COMME DANS VOTRE BASE : "lundi"
    const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jour = joursMap[date.getDay()];

    console.log(`[CONVERSION DATE] ${dateStr} → semaine: "${semaine}", jour: "${jour}"`);
    
    return { 
      semaine,  // "semaine5" 
      jour      // "lundi"
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(`Erreur lors de la conversion de la date: ${error.message}`);
  }
}
/**
   * ✅ NOUVELLE MÉTHODE CORRIGÉE : Obtenir les stats PCS par mois pour toutes les lignes d'une année
   * L'utilisateur envoie une date et on calcule pour toute l'année
   */
  async getStatsPcsParMoisEtLigne(getStatsAnnuelDto: { date: string }) {
    const { date } = getStatsAnnuelDto;
    
    console.log(`=== CALCUL PCS PAR MOIS ET LIGNE POUR ${date} ===`);

    try {
      // 1. Extraire l'année de la date
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new BadRequestException(`Date invalide: ${date}`);
      }
      
      const annee = dateObj.getFullYear();
      console.log(`Année extraite: ${annee}`);

      // 2. Définir les 12 mois
      const moisNoms = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];

      // 3. Récupérer TOUTES les semaines de l'année
      // On filtre par dateDebut qui contient l'année
      const debutAnnee = new Date(`${annee}-01-01`);
      const finAnnee = new Date(`${annee}-12-31`);
      
      const semaines = await this.semaineRepository.find({
        where: {
          dateDebut: MoreThanOrEqual(debutAnnee) && LessThanOrEqual(finAnnee)
        }
      });

      if (semaines.length === 0) {
        throw new NotFoundException(
          `Aucune semaine trouvée pour l'année ${annee}`
        );
      }

      const nomsSemainesAnnee = semaines.map(s => s.nom);
      console.log(`Semaines trouvées: ${nomsSemainesAnnee.join(', ')}`);

      // 4. Récupérer toutes les planifications de ces semaines
      const planifications = await this.planificationRepository.find({
        where: nomsSemainesAnnee.map(semaine => ({ semaine })),
        order: { ligne: 'ASC', semaine: 'ASC' }
      });

      if (planifications.length === 0) {
        throw new NotFoundException(
          `Aucune planification trouvée pour l'année ${annee}`
        );
      }

      console.log(`Nombre total de planifications: ${planifications.length}`);

      // 5. Créer une map: semaine -> mois (1-12)
      const semaineVsMois: Record<string, number> = {};
      semaines.forEach(semaine => {
        // dateDebut est un objet Date, on doit l'extraire
        const dateDebut = semaine.dateDebut instanceof Date 
          ? semaine.dateDebut 
          : new Date(semaine.dateDebut);
        
        // Extraire le mois (1-12)
        const moisNum = dateDebut.getMonth() + 1; // getMonth() retourne 0-11, on ajoute 1
        semaineVsMois[semaine.nom] = moisNum;
      });

      // 6. Grouper par ligne et par mois
      const statsParLigneEtMois: Record<string, Record<number, {
        totalQteSource: number;
        totalDecProduction: number;
      }>> = {};

      planifications.forEach(plan => {
        const ligne = plan.ligne;
        const moisNum = semaineVsMois[plan.semaine];
        
        if (!moisNum) {
          console.warn(`Semaine ${plan.semaine} non trouvée dans la map`);
          return;
        }

        // Initialiser la ligne
        if (!statsParLigneEtMois[ligne]) {
          statsParLigneEtMois[ligne] = {};
        }

        // Initialiser le mois pour cette ligne
        if (!statsParLigneEtMois[ligne][moisNum]) {
          statsParLigneEtMois[ligne][moisNum] = {
            totalQteSource: 0,
            totalDecProduction: 0
          };
        }

        // Accumuler les totaux
        const qteSource = this.getQuantitySource(plan);
        statsParLigneEtMois[ligne][moisNum].totalQteSource += qteSource;
        statsParLigneEtMois[ligne][moisNum].totalDecProduction += plan.decProduction;
      });

      // 7. Calculer les PCS et formater la réponse
      const lignesFormatees = Object.entries(statsParLigneEtMois).map(([ligne, moisData]) => {
        // Calculer les stats pour chaque mois
        const moisStats: Record<string, {
          pcsProd: number;
          totalQteSource: number;
          totalDecProduction: number;
        }> = {};

        let totalAnnuelQteSource = 0;
        let totalAnnuelDecProduction = 0;

        // Pour chaque mois (1-12)
        for (let m = 1; m <= 12; m++) {
          const data = moisData[m];
          
          if (data && data.totalQteSource > 0) {
            const pcsProd = (data.totalDecProduction / data.totalQteSource) * 100;
            moisStats[moisNoms[m - 1]] = {
              pcsProd: Math.round(pcsProd * 100) / 100,
              totalQteSource: data.totalQteSource,
              totalDecProduction: data.totalDecProduction
            };
            totalAnnuelQteSource += data.totalQteSource;
            totalAnnuelDecProduction += data.totalDecProduction;
          } else {
            // Mois sans données
            moisStats[moisNoms[m - 1]] = {
              pcsProd: 0,
              totalQteSource: 0,
              totalDecProduction: 0
            };
          }
        }

        // Calculer la moyenne annuelle (productivité globale)
        const moyenneAnnuelle = totalAnnuelQteSource > 0
          ? Math.round((totalAnnuelDecProduction / totalAnnuelQteSource) * 100 * 100) / 100
          : 0;

        return {
          ligne,
          mois: moisStats,
          moyenneAnnuelle,
          totalAnnuelQteSource,
          totalAnnuelDecProduction
        };
      });

      // 8. Trier les lignes par ordre alphabétique
      lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

      // 9. Calculer la productivité mensuelle globale (toutes lignes confondues)
      const productiviteMensuelle: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        let totalMoisQteSource = 0;
        let totalMoisDecProduction = 0;

        lignesFormatees.forEach(ligne => {
          const moisNom = moisNoms[m - 1];
          totalMoisQteSource += ligne.mois[moisNom].totalQteSource;
          totalMoisDecProduction += ligne.mois[moisNom].totalDecProduction;
        });

        productiviteMensuelle[moisNoms[m - 1]] = totalMoisQteSource > 0
          ? Math.round((totalMoisDecProduction / totalMoisQteSource) * 100 * 100) / 100
          : 0;
      }

      // 10. Calculer la moyenne annuelle globale
      const totalGlobalQteSource = lignesFormatees.reduce((sum, l) => sum + l.totalAnnuelQteSource, 0);
      const totalGlobalDecProduction = lignesFormatees.reduce((sum, l) => sum + l.totalAnnuelDecProduction, 0);
      const moyenneAnnuelleGlobale = totalGlobalQteSource > 0
        ? Math.round((totalGlobalDecProduction / totalGlobalQteSource) * 100 * 100) / 100
        : 0;

      return {
        message: `Statistiques PCS par mois pour l'année ${annee}`,
        annee,
        dateCalcul: new Date().toISOString(),
        nombreLignes: lignesFormatees.length,
        productiviteMensuelle,
        moyenneAnnuelleGlobale,
        lignes: lignesFormatees
      };

    } catch (error) {
      console.error(`Erreur dans getStatsPcsParMoisEtLigne:`, error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors du calcul des stats PCS par mois: ${error.message}`
      );
    }
  }
  // src/stats/stats.service.ts - Ajouter cette méthode

/**
 * ✅ NOUVELLE MÉTHODE : Obtenir les stats 5M par mois pour toute l'année
 * L'utilisateur envoie une date et on calcule les 5M pour tous les mois de l'année
 */
async getStats5MParMois(getStatsAnnuelDto: { date: string }) {
  const { date } = getStatsAnnuelDto;
  
  console.log(`=== CALCUL 5M PAR MOIS POUR ${date} ===`);

  try {
    // 1. Extraire l'année de la date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Date invalide: ${date}`);
    }
    
    const annee = dateObj.getFullYear();
    console.log(`Année extraite: ${annee}`);

    // 2. Définir les 12 mois
    const moisNoms = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    // 3. Récupérer TOUTES les semaines de l'année
    const debutAnnee = new Date(`${annee}-01-01`);
    const finAnnee = new Date(`${annee}-12-31`);
    
    const semaines = await this.semaineRepository.find({
      where: {
        dateDebut: MoreThanOrEqual(debutAnnee) && LessThanOrEqual(finAnnee)
      }
    });

    if (semaines.length === 0) {
      throw new NotFoundException(
        `Aucune semaine trouvée pour l'année ${annee}`
      );
    }

    const nomsSemainesAnnee = semaines.map(s => s.nom);
    console.log(`Semaines trouvées: ${nomsSemainesAnnee.join(', ')}`);

    // 4. Récupérer toutes les planifications de ces semaines avec leurs non-conformités
    const planifications = await this.planificationRepository.find({
      where: nomsSemainesAnnee.map(semaine => ({ semaine })),
      relations: ['nonConformites'],
      order: { semaine: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour l'année ${annee}`
      );
    }

    console.log(`Nombre total de planifications: ${planifications.length}`);

    // 5. Créer une map: semaine -> mois (1-12)
    const semaineVsMois: Record<string, number> = {};
    semaines.forEach(semaine => {
      const dateDebut = semaine.dateDebut instanceof Date 
        ? semaine.dateDebut 
        : new Date(semaine.dateDebut);
      
      const moisNum = dateDebut.getMonth() + 1;
      semaineVsMois[semaine.nom] = moisNum;
    });

    // 6. Grouper par mois
    const statsParMois: Record<number, {
      totalQteSource: number;
      matierePremiere: number;
      absence: number;
      rendement: number;
      maintenance: number;
      qualite: number;
      total5M: number;
    }> = {};

    // Initialiser tous les mois
    for (let m = 1; m <= 12; m++) {
      statsParMois[m] = {
        totalQteSource: 0,
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        maintenance: 0,
        qualite: 0,
        total5M: 0
      };
    }

    // 7. Parcourir toutes les planifications
    planifications.forEach(plan => {
      const moisNum = semaineVsMois[plan.semaine];
      
      if (!moisNum) {
        console.warn(`Semaine ${plan.semaine} non trouvée dans la map`);
        return;
      }

      const qteSource = this.getQuantitySource(plan);
      statsParMois[moisNum].totalQteSource += qteSource;

      // Ajouter les non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        statsParMois[moisNum].matierePremiere += nonConf.matierePremiere;
        statsParMois[moisNum].absence += nonConf.absence;
        statsParMois[moisNum].rendement += nonConf.rendement;
        statsParMois[moisNum].maintenance += nonConf.maintenance;
        statsParMois[moisNum].qualite += nonConf.qualite;
        statsParMois[moisNum].total5M += nonConf.total;
      }
    });

    // 8. Calculer les pourcentages pour chaque mois
    const moisFormates: Record<string, any> = {};
    let totalAnnuelQteSource = 0;
    let totalAnnuel5M = 0;
    let totalAnnuelMatierePremiere = 0;
    let totalAnnuelAbsence = 0;
    let totalAnnuelRendement = 0;
    let totalAnnuelMaintenance = 0;
    let totalAnnuelQualite = 0;

    for (let m = 1; m <= 12; m++) {
      const moisNom = moisNoms[m - 1];
      const data = statsParMois[m];

      // Calculer les pourcentages par rapport à la quantité source
      const calculerPourcentage = (valeur: number): number => {
        if (data.totalQteSource <= 0) return 0;
        return Math.round((valeur / data.totalQteSource) * 100 * 100) / 100;
      };

      moisFormates[moisNom] = {
        totalQteSource: data.totalQteSource,
        total5M: data.total5M,
        pourcentageTotal5M: calculerPourcentage(data.total5M),
        matierePremiere: {
          quantite: data.matierePremiere,
          pourcentage: calculerPourcentage(data.matierePremiere)
        },
        absence: {
          quantite: data.absence,
          pourcentage: calculerPourcentage(data.absence)
        },
        rendement: {
          quantite: data.rendement,
          pourcentage: calculerPourcentage(data.rendement)
        },
        maintenance: {
          quantite: data.maintenance,
          pourcentage: calculerPourcentage(data.maintenance)
        },
        qualite: {
          quantite: data.qualite,
          pourcentage: calculerPourcentage(data.qualite)
        }
      };

      // Accumuler les totaux annuels
      totalAnnuelQteSource += data.totalQteSource;
      totalAnnuel5M += data.total5M;
      totalAnnuelMatierePremiere += data.matierePremiere;
      totalAnnuelAbsence += data.absence;
      totalAnnuelRendement += data.rendement;
      totalAnnuelMaintenance += data.maintenance;
      totalAnnuelQualite += data.qualite;
    }

    // 9. Calculer les moyennes annuelles
    const calculerPourcentageAnnuel = (valeur: number): number => {
      if (totalAnnuelQteSource <= 0) return 0;
      return Math.round((valeur / totalAnnuelQteSource) * 100 * 100) / 100;
    };

    const moyennesAnnuelles = {
      totalQteSource: totalAnnuelQteSource,
      total5M: totalAnnuel5M,
      pourcentageTotal5M: calculerPourcentageAnnuel(totalAnnuel5M),
      matierePremiere: {
        quantite: totalAnnuelMatierePremiere,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelMatierePremiere),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelMatierePremiere / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      absence: {
        quantite: totalAnnuelAbsence,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelAbsence),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelAbsence / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      rendement: {
        quantite: totalAnnuelRendement,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelRendement),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelRendement / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      maintenance: {
        quantite: totalAnnuelMaintenance,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelMaintenance),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelMaintenance / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      qualite: {
        quantite: totalAnnuelQualite,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelQualite),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelQualite / totalAnnuel5M) * 100 * 100) / 100 : 0
      }
    };

    // 10. Préparer les données pour les graphiques
    const donneesGraphiques = {
      // Pour le graphique circulaire (répartition des causes)
      graphiqueCirculaire: {
        labels: ['Matière Première', 'Absence', 'Rendement', 'Maintenance', 'Qualité'],
        values: [
          moyennesAnnuelles.matierePremiere.pourcentageDans5M,
          moyennesAnnuelles.absence.pourcentageDans5M,
          moyennesAnnuelles.rendement.pourcentageDans5M,
          moyennesAnnuelles.maintenance.pourcentageDans5M,
          moyennesAnnuelles.qualite.pourcentageDans5M
        ]
      },
      // Pour le graphique en barres (% général arrêt par mois)
      graphiqueBarres: {
        labels: moisNoms,
        values: moisNoms.map(mois => moisFormates[mois].pourcentageTotal5M)
      }
    };

    // 11. Tableau récapitulatif
    const tableauRecapitulatif = moisNoms.map(mois => ({
      mois: mois,
      matierePremiere: moisFormates[mois].matierePremiere.pourcentage,
      absence: moisFormates[mois].absence.pourcentage,
      rendement: moisFormates[mois].rendement.pourcentage,
      maintenance: moisFormates[mois].maintenance.pourcentage,
      qualite: moisFormates[mois].qualite.pourcentage,
      total5M: moisFormates[mois].pourcentageTotal5M
    }));

    console.log(`=== FIN CALCUL 5M PAR MOIS POUR ${date} ===`);

    return {
      message: `Statistiques 5M par mois pour l'année ${annee}`,
      annee,
      dateCalcul: new Date().toISOString(),
      mois: moisFormates,
      moyennesAnnuelles,
      donneesGraphiques,
      tableauRecapitulatif
    };

  } catch (error) {
    console.error(`Erreur dans getStats5MParMois:`, error);
    
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des stats 5M par mois: ${error.message}`
    );
  }
}
async getAffectationPersonnel(semaine: string) {
  try {
    console.log(`=== CALCUL AFFECTATION PERSONNEL POUR ${semaine} ===`);

    // 1. Récupérer toutes les planifications pour cette semaine avec agrégation par ligne/jour
    const planificationsAgregees = await this.planificationRepository
      .createQueryBuilder('plan')
      .select('plan.ligne', 'ligne')
      .addSelect('plan.jour', 'jour')
      .addSelect('SUM(plan.nbOperateurs)', 'totalNbOperateurs')
      .where('plan.semaine = :semaine', { semaine })
      .groupBy('plan.ligne')
      .addGroupBy('plan.jour')
      .getRawMany();

    if (planificationsAgregees.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    console.log(`Planifications agrégées trouvées: ${planificationsAgregees.length}`);

    // 2. Créer une map pour accès rapide aux planifications
    const planifMap = new Map<string, number>();
    planificationsAgregees.forEach(p => {
      const key = `${p.ligne}-${p.jour}`;
      // Arrondir le total des nbOperateurs
      const nbOp = Math.round(parseFloat(p.totalNbOperateurs) || 0);
      planifMap.set(key, nbOp);
      console.log(`  ${key}: ${nbOp} opérateurs planifiés`);
    });

    // 3. Récupérer toutes les saisies de rapport pour cette semaine
    const saisies = await this.saisieRapportRepository
      .createQueryBuilder('saisie')
      .select('saisie.ligne', 'ligne')
      .addSelect('saisie.jour', 'jour')
      .addSelect('COUNT(DISTINCT saisie.matricule)', 'nbOperateurs')
      .where('saisie.semaine = :semaine', { semaine })
      .groupBy('saisie.ligne')
      .addGroupBy('saisie.jour')
      .getRawMany();

    console.log(`Saisies trouvées: ${saisies.length}`);

    // 4. Créer une map pour accès rapide aux saisies
    const saisiesMap = new Map<string, number>();
    saisies.forEach(s => {
      const key = `${s.ligne}-${s.jour}`;
      const nbOp = parseInt(s.nbOperateurs);
      saisiesMap.set(key, nbOp);
      console.log(`  ${key}: ${nbOp} opérateurs ont saisi`);
    });

    // 5. Obtenir toutes les lignes uniques
    const lignesUniques = new Set<string>();
    planificationsAgregees.forEach(p => lignesUniques.add(p.ligne));

    // 6. Pour chaque ligne, calculer les stats par jour
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const lignes: any[] = [];
    
    lignesUniques.forEach(ligne => {
      const joursData: any[] = [];
      
      jours.forEach(jour => {
        const key = `${ligne}-${jour}`;
        
        // Récupérer le nombre d'opérateurs planifiés (somme des nbOperateurs)
        const nbPlanifie = planifMap.get(key) || 0;
        
        // Récupérer le nombre d'opérateurs qui ont saisi
        const nbSaisi = saisiesMap.get(key) || 0;
        
        // Calculer la différence
        const difference = nbSaisi - nbPlanifie;
        
        // Déterminer le statut et le message
        let statut: string;
        let message: string;
        
        if (difference === 0) {
          statut = 'CONFORME';
          message = 'Bon';
        } else if (difference > 0) {
          statut = 'NON_CONFORME';
          message = `Non-conformité : +${difference} opérateur${difference > 1 ? 's' : ''}`;
        } else {
          statut = 'NON_CONFORME';
          message = `Non-conformité : ${difference} opérateur${Math.abs(difference) > 1 ? 's' : ''}`;
        }
        
        // Ajouter les données du jour
        joursData.push({
          jour,
          nbPlanifie,
          nbSaisi,
          difference,
          statut,
          message
        });
      });
      
      lignes.push({
        ligne,
        jours: joursData
      });
    });

    // 7. Calculer les statistiques globales
    let totalPlanifie = 0;
    let totalSaisi = 0;
    let nbNonConformites = 0;
    
    lignes.forEach(ligne => {
      ligne.jours.forEach((jour: any) => {
        totalPlanifie += jour.nbPlanifie;
        totalSaisi += jour.nbSaisi;
        if (jour.statut === 'NON_CONFORME') {
          nbNonConformites++;
        }
      });
    });

    const tauxConformite = totalPlanifie > 0 
      ? Math.round(((totalPlanifie - Math.abs(totalSaisi - totalPlanifie)) / totalPlanifie) * 100 * 100) / 100
      : 0;

    console.log(`=== FIN CALCUL AFFECTATION PERSONNEL ===`);
    console.log(`Total planifié: ${totalPlanifie}, Total saisi: ${totalSaisi}`);
    console.log(`Non-conformités: ${nbNonConformites}`);

    return {
      message: `Affectation du personnel pour la semaine ${semaine}`,
      semaine,
      dateCalcul: new Date().toISOString(),
      statistiquesGlobales: {
        totalPlanifie,
        totalSaisi,
        difference: totalSaisi - totalPlanifie,
        nbNonConformites,
        tauxConformite: `${tauxConformite}%`
      },
      lignes
    };

  } catch (error) {
    console.error(`Erreur dans getAffectationPersonnel:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul de l'affectation du personnel: ${error.message}`
    );
  }
}
}