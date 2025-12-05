// src/saisie-rapport/saisie-rapport.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaisieRapportService } from './saisie-rapport.service';
import { SaisieRapportController } from './saisie-rapport.controller';
import { SaisieRapport } from './entities/saisie-rapport.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Phase } from '../phase/entities/phase.entity';
import { Planification } from '../semaine/entities/planification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaisieRapport, Ouvrier, Phase, Planification])
  ],
  controllers: [SaisieRapportController],
  providers: [SaisieRapportService],
})
export class SaisieRapportModule {}