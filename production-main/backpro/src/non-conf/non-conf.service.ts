// src/non-conf/non-conf.service.ts
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonConformite } from './entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { CreateOrUpdateNonConfDto } from './dto/create-or-update-non-conf.dto';
import { GetNonConfDto } from './dto/get-non-conf.dto';

@Injectable()
export class NonConfService {
  constructor(
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    // ✅ SUPPRIMÉ : Plus besoin du repository Admin
  ) {}

  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  // ✅ MODIFIÉ : Suppression du paramètre user
  async createOrUpdateNonConformite(createOrUpdateNonConfDto: CreateOrUpdateNonConfDto) {
    const { semaine, jour, ligne, reference, referenceMatierePremiere } = createOrUpdateNonConfDto;

    console.log('=== DÉBUT createOrUpdateNonConformite ===');
    console.log('DTO reçu:', createOrUpdateNonConfDto);

    try {
      // 1. Trouver la planification
      const planification = await this.planificationRepository.findOne({
        where: { semaine, jour, ligne, reference },
        relations: ['semaineEntity']
      });

      if (!planification) {
        console.error('Planification non trouvée:', { semaine, jour, ligne, reference });
        throw new NotFoundException('Planification non trouvée');
      }

      console.log('Planification trouvée:', {
        id: planification.id,
        qtePlanifiee: planification.qtePlanifiee,
        qteModifiee: planification.qteModifiee,
        decProduction: planification.decProduction
      });

      // 2. Calculer le deltaProd actuel
      const quantiteSource = this.getQuantitySource(planification);
      const deltaProd = planification.decProduction - quantiteSource;

      console.log('Calculs:', {
        quantiteSource,
        decProduction: planification.decProduction,
        deltaProd
      });

      // 3. Vérifier si un delta négatif existe
      if (deltaProd >= 0) {
        console.warn('DeltaProd positif ou nul, pas de non-conformité:', deltaProd);
        throw new BadRequestException('Aucune non-conformité à déclarer (deltaProd positif ou nul)');
      }

      // 4. Extraire les valeurs du DTO
      const matierePremiere = createOrUpdateNonConfDto.matierePremiere || 0;
      const absence = createOrUpdateNonConfDto.absence || 0;
      const rendement = createOrUpdateNonConfDto.rendement || 0;
      const maintenance = createOrUpdateNonConfDto.maintenance || 0;
      const qualite = createOrUpdateNonConfDto.qualite || 0;
      
      console.log('Valeurs extraites du DTO:', {
        matierePremiere,
        absence,
        rendement,
        maintenance,
        qualite,
        referenceMatierePremiere
      });

      // 5. Calculer le total des 5M
      const total5M = matierePremiere + absence + rendement + maintenance + qualite;
      const deltaAbsolu = Math.abs(deltaProd);
      const tolerance = 1;

      console.log('Totaux:', {
        total5M,
        deltaAbsolu,
        difference: Math.abs(total5M - deltaAbsolu)
      });

      // 6. Vérifier la correspondance avec deltaProd
      if (Math.abs(total5M - deltaAbsolu) > tolerance) {
        throw new BadRequestException(
          `Le total des 5M (${total5M}) ne correspond pas au deltaProd (${deltaAbsolu}). ` +
          `Différence: ${Math.abs(total5M - deltaAbsolu)}`
        );
      }

      // 7. Vérifier si un rapport existe déjà
      const existingNonConf = await this.nonConfRepository.findOne({
        where: { planification: { id: planification.id } },
        relations: ['planification'] // ✅ MODIFIÉ : Plus de 'declarePar'
      });

      const isUpdate = !!existingNonConf;
      console.log(isUpdate ? 'Mise à jour de rapport existant' : 'Création nouveau rapport');

      // 8. Gestion du total = 0 (suppression)
      if (total5M === 0) {
        if (isUpdate) {
          await this.nonConfRepository.remove(existingNonConf);
          console.log('Rapport supprimé (toutes valeurs à 0)');
          return {
            message: 'Rapport de non-conformité supprimé (toutes les valeurs sont à 0)',
            action: 'deleted',
            data: { 
              semaine, 
              jour, 
              ligne, 
              reference,
              quantiteSource,
              decProduction: planification.decProduction,
              deltaProd 
            }
          };
        } else {
          throw new BadRequestException('Impossible de créer un rapport avec toutes les valeurs à 0');
        }
      }

      // 9. Créer ou mettre à jour l'entité
      let nonConf: NonConformite;
      
      if (isUpdate) {
        nonConf = existingNonConf;
        console.log('Rapport existant trouvé, ID:', nonConf.id);
      } else {
        nonConf = new NonConformite();
        nonConf.planification = planification;
        // ✅ SUPPRIMÉ : Plus d'assignation de declarePar
        console.log('Nouveau rapport créé');
      }
      
      // 10. Mettre à jour les champs
      nonConf.matierePremiere = matierePremiere;
      nonConf.absence = absence;
      nonConf.rendement = rendement;
      nonConf.maintenance = maintenance;
      nonConf.qualite = qualite;
      nonConf.total = total5M;
      
      // 11. Gestion de la référence matière première
      if (matierePremiere > 0 && referenceMatierePremiere && referenceMatierePremiere.trim() !== '') {
        nonConf.referenceMatierePremiere = referenceMatierePremiere;
        console.log('Référence MP définie:', referenceMatierePremiere);
      } else {
        nonConf.referenceMatierePremiere = null;
        console.log('Référence MP mise à null');
      }
      
      // 12. Gestion du commentaire
      if (createOrUpdateNonConfDto.commentaire !== undefined) {
        nonConf.commentaire = createOrUpdateNonConfDto.commentaire;
      } else if (!isUpdate) {
        nonConf.commentaire = null;
      }

      nonConf.updatedAt = new Date();

      console.log('Entité avant sauvegarde:', {
        matierePremiere: nonConf.matierePremiere,
        referenceMatierePremiere: nonConf.referenceMatierePremiere,
        absence: nonConf.absence,
        rendement: nonConf.rendement,
        maintenance: nonConf.maintenance,
        qualite: nonConf.qualite,
        total: nonConf.total
      });

      // 13. Sauvegarder
      const savedNonConf = await this.nonConfRepository.save(nonConf);
      
      console.log('Sauvegarde réussie, ID:', savedNonConf.id);

      // 14. Préparer la réponse
      const actionMessage = isUpdate ? 'mis à jour' : 'créé';
      const response = {
        message: `Rapport de non-conformité ${actionMessage} avec succès`,
        action: isUpdate ? 'updated' : 'created',
        data: {
          id: savedNonConf.id,
          semaine,
          jour,
          ligne,
          reference,
          quantiteSource,
          decProduction: planification.decProduction,
          deltaProd,
          total5M: savedNonConf.total,
          details: {
            matierePremiere: savedNonConf.matierePremiere,
            referenceMatierePremiere: savedNonConf.referenceMatierePremiere,
            absence: savedNonConf.absence,
            rendement: savedNonConf.rendement,
            maintenance: savedNonConf.maintenance,
            qualite: savedNonConf.qualite
          },
          commentaire: savedNonConf.commentaire,
          // ✅ SUPPRIMÉ : Plus de champs declarePar/updatedBy
          createdAt: isUpdate ? existingNonConf?.createdAt : savedNonConf.createdAt,
          updatedAt: savedNonConf.updatedAt
        }
      };

      console.log('=== FIN createOrUpdateNonConformite - Succès ===');
      return response;

    } catch (error) {
      console.error('=== ERREUR dans createOrUpdateNonConformite ===');
      console.error('Erreur:', error);
      console.error('Stack:', error.stack);
      console.error('DTO qui a causé l\'erreur:', createOrUpdateNonConfDto);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la sauvegarde du rapport: ${error.message}`
      );
    }
  }

  // ==================== RÉCUPÉRER LES RAPPORTS ====================
  async getNonConformites(getNonConfDto: GetNonConfDto) {
    const { semaine, jour, ligne, reference } = getNonConfDto;
    
    const queryBuilder = this.nonConfRepository
      .createQueryBuilder('nonConf')
      .leftJoinAndSelect('nonConf.planification', 'planification')
      // ✅ SUPPRIMÉ : Plus de jointure avec declarePar
      .orderBy('nonConf.createdAt', 'DESC');

    if (semaine) {
      queryBuilder.andWhere('planification.semaine = :semaine', { semaine });
    }
    
    if (jour) {
      queryBuilder.andWhere('planification.jour = :jour', { jour });
    }
    
    if (ligne) {
      queryBuilder.andWhere('planification.ligne = :ligne', { ligne });
    }
    
    if (reference) {
      queryBuilder.andWhere('planification.reference = :reference', { reference });
    }

    const nonConfs = await queryBuilder.getMany();

    const formattedResults = nonConfs.map(nonConf => {
      const plan = nonConf.planification;
      const quantiteSource = this.getQuantitySource(plan);
      
      return {
        id: nonConf.id,
        semaine: plan.semaine,
        jour: plan.jour,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of,
        quantiteSource,
        decProduction: plan.decProduction,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`,
        total5M: nonConf.total,
        details: {
          matierePremiere: nonConf.matierePremiere,
          referenceMatierePremiere: nonConf.referenceMatierePremiere,
          absence: nonConf.absence,
          rendement: nonConf.rendement,
          maintenance: nonConf.maintenance,
          qualite: nonConf.qualite
        },
        commentaire: nonConf.commentaire,
        // ✅ SUPPRIMÉ : Plus de champ declarePar
        createdAt: nonConf.createdAt,
        updatedAt: nonConf.updatedAt
      };
    });

    const totals = {
      matierePremiere: formattedResults.reduce((sum, item) => sum + item.details.matierePremiere, 0),
      absence: formattedResults.reduce((sum, item) => sum + item.details.absence, 0),
      rendement: formattedResults.reduce((sum, item) => sum + item.details.rendement, 0),
      maintenance: formattedResults.reduce((sum, item) => sum + item.details.maintenance, 0),
      qualite: formattedResults.reduce((sum, item) => sum + item.details.qualite, 0),
      total5M: formattedResults.reduce((sum, item) => sum + item.total5M, 0)
    };

    return {
      message: 'Rapports de non-conformité récupérés',
      filters: { semaine, jour, ligne, reference },
      total: formattedResults.length,
      totals,
      rapports: formattedResults
    };
  }

  // ==================== RÉCUPÉRER UN RAPPORT PAR ID ====================
  async getNonConformiteById(id: number) {
    const nonConf = await this.nonConfRepository.findOne({
      where: { id },
      relations: ['planification'] // ✅ MODIFIÉ : Plus de 'declarePar'
    });

    if (!nonConf) {
      throw new NotFoundException('Rapport de non-conformité non trouvé');
    }

    const planification = nonConf.planification;
    const quantiteSource = this.getQuantitySource(planification);

    return {
      id: nonConf.id,
      semaine: planification.semaine,
      jour: planification.jour,
      ligne: planification.ligne,
      reference: planification.reference,
      of: planification.of,
      quantiteSource,
      decProduction: planification.decProduction,
      deltaProd: planification.deltaProd,
      pcsProd: `${planification.pcsProd}%`,
      total5M: nonConf.total,
      details: {
        matierePremiere: nonConf.matierePremiere,
        referenceMatierePremiere: nonConf.referenceMatierePremiere,
        absence: nonConf.absence,
        rendement: nonConf.rendement,
        maintenance: nonConf.maintenance,
        qualite: nonConf.qualite
      },
      commentaire: nonConf.commentaire,
      // ✅ SUPPRIMÉ : Plus de champ declarePar
      createdAt: nonConf.createdAt,
      updatedAt: nonConf.updatedAt
    };
  }

  // ==================== RÉCUPÉRER UN RAPPORT PAR CRITÈRES ====================
  async getNonConformiteByCriteria(semaine: string, jour: string, ligne: string, reference: string) {
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    const nonConf = await this.nonConfRepository.findOne({
      where: { planification: { id: planification.id } },
      relations: ['planification'] // ✅ MODIFIÉ : Plus de 'declarePar'
    });

    const quantiteSource = this.getQuantitySource(planification);

    if (!nonConf) {
      return {
        message: 'Aucun rapport de non-conformité trouvé',
        exists: false,
        planification: {
          semaine,
          jour,
          ligne,
          reference,
          quantiteSource,
          decProduction: planification.decProduction,
          deltaProd: planification.deltaProd,
          pcsProd: `${planification.pcsProd}%`
        }
      };
    }

    return {
      message: 'Rapport de non-conformité trouvé',
      exists: true,
      data: {
        id: nonConf.id,
        semaine: planification.semaine,
        jour: planification.jour,
        ligne: planification.ligne,
        reference: planification.reference,
        of: planification.of,
        quantiteSource,
        decProduction: planification.decProduction,
        deltaProd: planification.deltaProd,
        pcsProd: `${planification.pcsProd}%`,
        total5M: nonConf.total,
        details: {
          matierePremiere: nonConf.matierePremiere,
          referenceMatierePremiere: nonConf.referenceMatierePremiere,
          absence: nonConf.absence,
          rendement: nonConf.rendement,
          maintenance: nonConf.maintenance,
          qualite: nonConf.qualite
        },
        commentaire: nonConf.commentaire,
        // ✅ SUPPRIMÉ : Plus de champ declarePar
        createdAt: nonConf.createdAt,
        updatedAt: nonConf.updatedAt
      }
    };
  }

  // ==================== SUPPRIMER UN RAPPORT ====================
  async deleteNonConformite(id: number) {
    const nonConf = await this.nonConfRepository.findOne({
      where: { id }
    });

    if (!nonConf) {
      throw new NotFoundException('Rapport de non-conformité non trouvé');
    }

    await this.nonConfRepository.remove(nonConf);

    return {
      message: 'Rapport de non-conformité supprimé',
      id
    };
  }

  // ==================== SUPPRIMER PAR CRITÈRES ====================
  async deleteNonConformiteByCriteria(semaine: string, jour: string, ligne: string, reference: string) {
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    const nonConf = await this.nonConfRepository.findOne({
      where: { planification: { id: planification.id } }
    });

    if (!nonConf) {
      throw new NotFoundException('Rapport de non-conformité non trouvé');
    }

    await this.nonConfRepository.remove(nonConf);

    return {
      message: 'Rapport de non-conformité supprimé',
      semaine,
      jour,
      ligne,
      reference
    };
  }

  // ==================== STATISTIQUES ====================
  async getStats(semaine?: string) {
    const queryBuilder = this.nonConfRepository
      .createQueryBuilder('nonConf')
      .leftJoinAndSelect('nonConf.planification', 'planification');

    if (semaine) {
      queryBuilder.where('planification.semaine = :semaine', { semaine });
    }

    const nonConfs = await queryBuilder.getMany();
    const total = nonConfs.length;

    const statsParCause = {
      matierePremiere: nonConfs.reduce((sum, nc) => sum + nc.matierePremiere, 0),
      absence: nonConfs.reduce((sum, nc) => sum + nc.absence, 0),
      rendement: nonConfs.reduce((sum, nc) => sum + nc.rendement, 0),
      maintenance: nonConfs.reduce((sum, nc) => sum + nc.maintenance, 0),
      qualite: nonConfs.reduce((sum, nc) => sum + nc.qualite, 0),
      total5M: nonConfs.reduce((sum, nc) => sum + nc.total, 0)
    };

    const rapportsParSemaine = await this.nonConfRepository
      .createQueryBuilder('nonConf')
      .leftJoin('nonConf.planification', 'planification')
      .select('planification.semaine', 'semaine')
      .addSelect('COUNT(nonConf.id)', 'nombreRapports')
      .addSelect('SUM(nonConf.total)', 'totalQuantite')
      .groupBy('planification.semaine')
      .orderBy('planification.semaine', 'DESC')
      .getRawMany();

    return {
      message: 'Statistiques des non-conformités',
      periode: semaine || 'Toutes semaines',
      totalRapports: total,
      statsParCause,
      rapportsParSemaine
    };
  }
}