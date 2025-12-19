import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { GetPlanificationMagasinDto } from './dto/get-planification-magasin.dto';
import { UpdateDeclarationMagasinDto } from './dto/update-declaration-magasin.dto';

@Injectable()
export class MagasinService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,
  ) {}

  // Méthode utilitaire pour obtenir la quantité source
  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  // Récupérer les planifications pour le magasin
  async getPlanificationsMagasin(getPlanificationDto: GetPlanificationMagasinDto) {
  const { ligne, semaine } = getPlanificationDto;

  console.log(`=== MAGASIN - ${ligne} - ${semaine} ===`);

  // Vérifier si la semaine existe
  const semaineEntity = await this.semaineRepository.findOne({
    where: { nom: semaine }
  });

  if (!semaineEntity) {
    throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
  }

  // Récupérer toutes les planifications pour cette ligne et semaine
  const planifications = await this.planificationRepository.find({
    where: { 
      semaine: semaine,
      ligne: ligne
    },
    order: { reference: 'ASC', jour: 'ASC' }
  });

  if (planifications.length === 0) {
    return {
      message: `Aucune planification trouvée pour la ligne ${ligne} dans la semaine ${semaine}`,
      semaine: semaine,
      ligne: ligne,
      planifications: []
    };
  }

  // FILTRER: ne garder que les planifications avec qtePlanifiee > 0 OU qteModifiee > 0
  const planificationsFiltrees = planifications.filter(plan => 
    plan.qtePlanifiee > 0 || plan.qteModifiee > 0
  );

  if (planificationsFiltrees.length === 0) {
    return {
      message: `Aucune planification avec quantité planifiée ou modifiée > 0 pour la ligne ${ligne} dans la semaine ${semaine}`,
      semaine: semaine,
      ligne: ligne,
      planifications: [],
      references: []
    };
  }

  // Grouper par référence pour une vue consolidée
  const referencesMap = new Map<string, any>();

  planificationsFiltrees.forEach(plan => {
    const key = plan.reference;
    const quantiteSource = this.getQuantitySource(plan);
    
    // Vérifier si cette référence a au moins une planification avec quantité > 0
    if (!referencesMap.has(key)) {
      referencesMap.set(key, {
        reference: plan.reference,
        qtePlanifiee: 0,
        qteModifiee: 0,
        quantiteSource: 0,
        decMagasin: 0,
        detailsParJour: [],
        // Nouveaux champs pour indiquer le type de quantité
        aQtePlanifiee: false,
        aQteModifiee: false
      });
    }

    const refData = referencesMap.get(key);
    
    // Ajouter aux totaux
    refData.qtePlanifiee += plan.qtePlanifiee;
    refData.qteModifiee += plan.qteModifiee;
    refData.quantiteSource += quantiteSource;
    refData.decMagasin += plan.decMagasin;

    // Mettre à jour les indicateurs
    if (plan.qtePlanifiee > 0) refData.aQtePlanifiee = true;
    if (plan.qteModifiee > 0) refData.aQteModifiee = true;

    // Détails par jour (seulement si quantité > 0)
    if (plan.qtePlanifiee > 0 || plan.qteModifiee > 0) {
      refData.detailsParJour.push({
        jour: plan.jour,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: quantiteSource,
        decMagasin: plan.decMagasin,
        of: plan.of,
        emballage: plan.emballage,
        // Indicateur pour savoir quelle quantité est utilisée
        typeQuantite: plan.qteModifiee > 0 ? 'MODIFIEE' : 'PLANIFIEE'
      });
    }
  });

  // Convertir la Map en tableau et trier par référence
  const references = Array.from(referencesMap.values())
    .sort((a, b) => a.reference.localeCompare(b.reference));

  // Calculer les totaux (seulement pour les références filtrées)
  const totals = {
    totalQtePlanifiee: references.reduce((sum, ref) => sum + ref.qtePlanifiee, 0),
    totalQteModifiee: references.reduce((sum, ref) => sum + ref.qteModifiee, 0),
    totalQuantiteSource: references.reduce((sum, ref) => sum + ref.quantiteSource, 0),
    totalDecMagasin: references.reduce((sum, ref) => sum + ref.decMagasin, 0),
    nombreReferences: references.length,
    nombrePlanifications: planificationsFiltrees.length,
    // Statistiques supplémentaires
    referencesAvecQtePlanifiee: references.filter(ref => ref.aQtePlanifiee).length,
    referencesAvecQteModifiee: references.filter(ref => ref.aQteModifiee).length
  };

  return {
    message: `Planifications magasin pour ${ligne} - ${semaine} (quantités > 0 seulement)`,
    semaine: {
      id: semaineEntity.id,
      nom: semaineEntity.nom,
      dateDebut: semaineEntity.dateDebut,
      dateFin: semaineEntity.dateFin
    },
    ligne: ligne,
    filtre: "Seules les références avec qtePlanifiee > 0 OU qteModifiee > 0 sont affichées",
    totals: totals,
    references: references,
    // Version détaillée par planification (filtrée)
    details: planificationsFiltrees.map(plan => ({
      id: plan.id,
      semaine: plan.semaine,
      jour: plan.jour,
      ligne: plan.ligne,
      reference: plan.reference,
      of: plan.of,
      qtePlanifiee: plan.qtePlanifiee,
      qteModifiee: plan.qteModifiee,
      quantiteSource: this.getQuantitySource(plan),
      decMagasin: plan.decMagasin,
      emballage: plan.emballage,
      typeQuantite: plan.qteModifiee > 0 ? 'MODIFIEE' : (plan.qtePlanifiee > 0 ? 'PLANIFIEE' : 'VIDE'),
      updatedAt: plan.updatedAt
    }))
  };
}

  // Mettre à jour la déclaration magasin
  async updateDeclarationMagasin(updateDto: UpdateDeclarationMagasinDto, username: string) {
    const { semaine, jour, ligne, reference, decMagasin } = updateDto;

    // Trouver la planification
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    // Mettre à jour DM
    planification.decMagasin = decMagasin;
    planification.updatedAt = new Date();

    const updatedPlanification = await this.planificationRepository.save(planification);


    // });

    return {
      message: 'Déclaration magasin mise à jour',
      planification: {
        id: updatedPlanification.id,
        semaine: updatedPlanification.semaine,
        jour: updatedPlanification.jour,
        ligne: updatedPlanification.ligne,
        reference: updatedPlanification.reference,
        qtePlanifiee: updatedPlanification.qtePlanifiee,
        qteModifiee: updatedPlanification.qteModifiee,
        quantiteSource: this.getQuantitySource(updatedPlanification),
        decMagasin: updatedPlanification.decMagasin,
        updatedAt: updatedPlanification.updatedAt
      }
    };
  }
}