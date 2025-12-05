// src/saisie-rapport/saisie-rapport.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaisieRapport } from './entities/saisie-rapport.entity';
import { CreateSaisieRapportDto } from './dto/create-saisie-rapport.dto';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Phase } from '../phase/entities/phase.entity';
import { Planification } from '../semaine/entities/planification.entity';

@Injectable()
export class SaisieRapportService {
  constructor(
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
  ) {}

  /**
   * Créer un nouveau rapport de phase
   */
  async createRapport(createSaisieRapportDto: CreateSaisieRapportDto) {
  const { semaine, jour, ligne, matricule, phases } = createSaisieRapportDto;

  console.log('=== DÉBUT CRÉATION RAPPORT PHASE MULTIPLE ===');
  console.log('Données reçues:', { semaine, jour, ligne, matricule, phases });

  // 1. Vérifier si l'ouvrier existe
  const ouvrier = await this.ouvrierRepository.findOne({ 
    where: { matricule } 
  });
  
  if (!ouvrier) {
    throw new NotFoundException(`Ouvrier avec le matricule ${matricule} introuvable`);
  }

  // 2. Vérifier s'il y a une planification pour cette semaine/jour/ligne
  const planificationExiste = await this.planificationRepository.findOne({
    where: { semaine, jour, ligne }
  });

  if (!planificationExiste) {
    throw new BadRequestException(`Aucune planification trouvée pour la semaine "${semaine}", jour "${jour}", ligne "${ligne}"`);
  }

  // 3. RÉCUPÉRER LE PCsProd TOTAL DE LA LIGNE POUR CETTE SEMAINE
  const planificationsLigneSemaine = await this.planificationRepository.find({
    where: { semaine, ligne }
  });

  // Calculer le PCsProd total pour la ligne dans cette semaine
  let totalQteSource = 0;
  let totalDecProduction = 0;
  
  for (const plan of planificationsLigneSemaine) {
    // Utiliser qteModifiee si > 0, sinon qtePlanifiee
    const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
    totalQteSource += quantiteSource;
    totalDecProduction += plan.decProduction;
  }

  // Calculer le PCsProd total de la ligne
  const pcsProdLigne = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

  console.log(`PCsProd total pour la ligne ${ligne} semaine ${semaine}: ${pcsProdLigne.toFixed(2)}%`);

  // 4. Vérifier les phases
  for (const phaseHeure of phases) {
    const phaseExiste = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseHeure.phase } 
    });
    
    if (!phaseExiste) {
      throw new NotFoundException(`Phase "${phaseHeure.phase}" introuvable pour la ligne "${ligne}"`);
    }
  }

  // 5. Vérifier si cet ouvrier a déjà un rapport ce jour-là
  const rapportExistant = await this.saisieRapportRepository.findOne({
    where: { semaine, jour, matricule }
  });

  if (rapportExistant) {
    throw new ConflictException(
      `Cet ouvrier a déjà un rapport ce ${jour}. Utilisez la mise à jour ou supprimez le rapport existant.`
    );
  }

  // 6. Calculer les totaux
  const totalHeuresNouvelles = phases.reduce((total, phase) => total + phase.heures, 0);
  
  if (totalHeuresNouvelles > 8) {
    throw new BadRequestException(
      `Total des heures (${totalHeuresNouvelles}h) dépasse la limite de 8h par jour`
    );
  }

  // 7. Vérifier le nombre de phases
  if (phases.length > 3) {
    throw new BadRequestException(
      `Nombre de phases (${phases.length}) dépasse la limite de 3 phases par jour`
    );
  }

  try {
    // Créer UN SEUL rapport avec toutes les phases
    const nouveauRapport = new SaisieRapport();
    nouveauRapport.semaine = semaine;
    nouveauRapport.jour = jour;
    nouveauRapport.ligne = ligne;
    nouveauRapport.matricule = matricule;
    nouveauRapport.nomPrenom = ouvrier.nomPrenom;
    nouveauRapport.phases = phases; // Stocker le tableau JSON
    nouveauRapport.totalHeuresJour = totalHeuresNouvelles;
    nouveauRapport.heuresRestantes = 8 - totalHeuresNouvelles;
    nouveauRapport.nbPhasesJour = phases.length;
    // NOUVEAU : Ajouter le PCsProd de la ligne
    nouveauRapport.pcsProdLigne = Math.round(pcsProdLigne * 100) / 100; // Arrondir à 2 décimales

    const rapportSauvegarde = await this.saisieRapportRepository.save(nouveauRapport);

    console.log('Rapport créé avec succès:', rapportSauvegarde);

    return {
      message: 'Rapport de phase créé avec succès',
      rapport: {
        id: rapportSauvegarde.id,
        semaine: rapportSauvegarde.semaine,
        jour: rapportSauvegarde.jour,
        ligne: rapportSauvegarde.ligne,
        matricule: rapportSauvegarde.matricule,
        nomPrenom: rapportSauvegarde.nomPrenom,
        phases: rapportSauvegarde.phases,
        totalHeuresJour: rapportSauvegarde.totalHeuresJour,
        heuresRestantes: rapportSauvegarde.heuresRestantes,
        nbPhasesJour: rapportSauvegarde.nbPhasesJour,
        pcsProdLigne: `${rapportSauvegarde.pcsProdLigne}%`, // Formaté en pourcentage
        createdAt: rapportSauvegarde.createdAt,
        updatedAt: rapportSauvegarde.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur création rapport:', error);
    throw new InternalServerErrorException('Erreur lors de la création du rapport de phase');
  }
}

  /**
   * Récupérer tous les rapports
   */
  async findAll() {
    try {
      const rapports = await this.saisieRapportRepository.find({
        order: { semaine: 'DESC', jour: 'ASC', ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par semaine
   */
  async findBySemaine(semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine },
        order: { jour: 'ASC', ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        semaine,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par semaine:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par semaine et jour
   */
  async findBySemaineJour(semaine: string, jour: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine, jour },
        order: { ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        semaine,
        jour,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par semaine/jour:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par matricule
   */
  async findByMatricule(matricule: number) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { matricule },
        order: { semaine: 'DESC', jour: 'ASC' }
      });

      return {
        matricule,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par matricule:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par ligne
   */
  async findByLigne(ligne: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { ligne },
        order: { semaine: 'DESC', jour: 'ASC', matricule: 'ASC' }
      });

      return {
        ligne,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par ligne:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer un rapport par ID
   */
  async findOne(id: number) {
    const rapport = await this.saisieRapportRepository.findOne({ 
      where: { id } 
    });
    
    if (!rapport) {
      throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
    }

    return {
      id: rapport.id,
      semaine: rapport.semaine,
      jour: rapport.jour,
      ligne: rapport.ligne,
      matricule: rapport.matricule,
      nomPrenom: rapport.nomPrenom,
      phases: rapport.phases,
      totalHeuresJour: rapport.totalHeuresJour,
      heuresRestantes: rapport.heuresRestantes,
      nbPhasesJour: rapport.nbPhasesJour,
      createdAt: rapport.createdAt,
      updatedAt: rapport.updatedAt
    };
  }

  /**
   * Mettre à jour un rapport
   */
 async update(id: number, updateSaisieRapportDto: CreateSaisieRapportDto) {
  const rapport = await this.saisieRapportRepository.findOne({ 
    where: { id } 
  });
  
  if (!rapport) {
    throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
  }

  const { semaine, jour, ligne, matricule, phases } = updateSaisieRapportDto;

  // Vérifier les phases
  for (const phaseHeure of phases) {
    const phaseExiste = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseHeure.phase } 
    });
    
    if (!phaseExiste) {
      throw new NotFoundException(`Phase "${phaseHeure.phase}" introuvable pour la ligne "${ligne}"`);
    }
  }

  // RECALCULER LE PCsProd TOTAL DE LA LIGNE
  const planificationsLigneSemaine = await this.planificationRepository.find({
    where: { semaine, ligne }
  });

  let totalQteSource = 0;
  let totalDecProduction = 0;
  
  for (const plan of planificationsLigneSemaine) {
    const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
    totalQteSource += quantiteSource;
    totalDecProduction += plan.decProduction;
  }

  const pcsProdLigne = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

  // Calculer les totaux
  const totalHeuresNouvelles = phases.reduce((total, phase) => total + phase.heures, 0);
  
  if (totalHeuresNouvelles > 8) {
    throw new BadRequestException(
      `Total des heures (${totalHeuresNouvelles}h) dépasse la limite de 8h par jour`
    );
  }

  if (phases.length > 3) {
    throw new BadRequestException(
      `Nombre de phases (${phases.length}) dépasse la limite de 3 phases par jour`
    );
  }

  try {
    // Mettre à jour le rapport
    rapport.semaine = semaine;
    rapport.jour = jour;
    rapport.ligne = ligne;
    rapport.matricule = matricule;
    rapport.phases = phases;
    rapport.totalHeuresJour = totalHeuresNouvelles;
    rapport.heuresRestantes = 8 - totalHeuresNouvelles;
    rapport.nbPhasesJour = phases.length;
    rapport.pcsProdLigne = Math.round(pcsProdLigne * 100) / 100; // Mettre à jour le PCsProd

    const rapportMisAJour = await this.saisieRapportRepository.save(rapport);

    return {
      message: 'Rapport mis à jour avec succès',
      rapport: {
        id: rapportMisAJour.id,
        semaine: rapportMisAJour.semaine,
        jour: rapportMisAJour.jour,
        ligne: rapportMisAJour.ligne,
        matricule: rapportMisAJour.matricule,
        nomPrenom: rapportMisAJour.nomPrenom,
        phases: rapportMisAJour.phases,
        totalHeuresJour: rapportMisAJour.totalHeuresJour,
        heuresRestantes: rapportMisAJour.heuresRestantes,
        nbPhasesJour: rapportMisAJour.nbPhasesJour,
        pcsProdLigne: `${rapportMisAJour.pcsProdLigne}%`,
        updatedAt: rapportMisAJour.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur mise à jour rapport:', error);
    throw new InternalServerErrorException('Erreur lors de la mise à jour du rapport');
  }
}

  /**
   * Supprimer un rapport
   */
  async remove(id: number) {
    const rapport = await this.saisieRapportRepository.findOne({ 
      where: { id } 
    });
    
    if (!rapport) {
      throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
    }

    try {
      await this.saisieRapportRepository.remove(rapport);

      return {
        message: 'Rapport supprimé avec succès',
        rapport: {
          id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule
        }
      };
    } catch (error) {
      console.error('Erreur suppression rapport:', error);
      throw new InternalServerErrorException('Erreur lors de la suppression du rapport');
    }
  }

  /**
   * Obtenir les statistiques d'un ouvrier pour une semaine
   */
  async getStatsOuvrierSemaine(matricule: number, semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { matricule, semaine },
        order: { jour: 'ASC' }
      });

      const statsParJour = rapports.map(rapport => ({
        jour: rapport.jour,
        totalHeures: rapport.totalHeuresJour,
        nbPhases: rapport.nbPhasesJour,
        ligne: rapport.ligne,
        phases: rapport.phases
      }));

      const totalSemaine = rapports.reduce((total, rapport) => total + rapport.totalHeuresJour, 0);
      const moyenneParJour = rapports.length > 0 ? totalSemaine / rapports.length : 0;

      return {
        matricule,
        semaine,
        statsParJour,
        totalSemaine: {
          totalHeures: totalSemaine,
          moyenneParJour: Math.round(moyenneParJour * 100) / 100,
          nbJours: rapports.length
        }
      };
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * Obtenir les statistiques globales d'une semaine
   */
  async getStatsSemaine(semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine }
      });

      const stats = {
        totalRapports: rapports.length,
        totalOuvriers: new Set(rapports.map(r => r.matricule)).size,
        totalLignes: new Set(rapports.map(r => r.ligne)).size,
        totalHeures: rapports.reduce((total, rapport) => total + rapport.totalHeuresJour, 0),
        statsParJour: {} as any,
        statsParLigne: {} as any
      };

      // Stats par jour
      rapports.forEach(rapport => {
        if (!stats.statsParJour[rapport.jour]) {
          stats.statsParJour[rapport.jour] = {
            totalRapports: 0,
            totalHeures: 0,
            totalOuvriers: new Set()
          };
        }
        stats.statsParJour[rapport.jour].totalRapports++;
        stats.statsParJour[rapport.jour].totalHeures += rapport.totalHeuresJour;
        stats.statsParJour[rapport.jour].totalOuvriers.add(rapport.matricule);
      });

      // Stats par ligne
      rapports.forEach(rapport => {
        if (!stats.statsParLigne[rapport.ligne]) {
          stats.statsParLigne[rapport.ligne] = {
            totalRapports: 0,
            totalHeures: 0,
            totalOuvriers: new Set()
          };
        }
        stats.statsParLigne[rapport.ligne].totalRapports++;
        stats.statsParLigne[rapport.ligne].totalHeures += rapport.totalHeuresJour;
        stats.statsParLigne[rapport.ligne].totalOuvriers.add(rapport.matricule);
      });

      return {
        semaine,
        ...stats
      };
    } catch (error) {
      console.error('Erreur récupération statistiques semaine:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des statistiques');
    }
  }
}