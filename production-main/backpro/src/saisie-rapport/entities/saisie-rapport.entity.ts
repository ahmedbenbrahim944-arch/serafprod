// src/saisie-rapport/entities/saisie-rapport.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index 
} from 'typeorm';

// src/saisie-rapport/entities/saisie-rapport.entity.ts
@Entity('saisie_rapports')
@Index(['semaine', 'jour', 'ligne', 'matricule'], { unique: true })
export class SaisieRapport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  semaine: string;

  @Column({ type: 'varchar', length: 20 })
  jour: string;

  @Column({ type: 'varchar', length: 50 })
  ligne: string;

  @Column({ type: 'int' })
  matricule: number;

  @Column({ type: 'varchar', length: 100 })
  nomPrenom: string;

  // Stocker les phases et heures comme JSON
  @Column({ type: 'json' })
  phases: { phase: string; heures: number }[];

  // Champs de résumé
  @Column({ type: 'float' })
  totalHeuresJour: number;

  @Column({ type: 'float' })
  heuresRestantes: number;

  @Column({ type: 'int' })
  nbPhasesJour: number;

  // NOUVEAU : Pourcentage de rendement (PCsProd) de la ligne
  @Column({ type: 'float', default: 0 })
  pcsProdLigne: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}