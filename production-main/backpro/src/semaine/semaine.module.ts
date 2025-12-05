// src/semaine/semaine.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemaineService } from './semaine.service';
import { SemaineController } from './semaine.controller';
import { Semaine } from './entities/semaine.entity';
import { Planification } from './entities/planification.entity';
import { Product } from '../product/entities/product.entity';
import { TempsSec } from '../temps-sec/entities/temps-sec.entity'; // AJOUTER
import { TempsSecModule } from '../temps-sec/temps-sec.module'; // AJOUTER

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Semaine,  
      Planification, 
      Product,
      TempsSec // AJOUTER CETTE LIGNE
    ]),
    TempsSecModule // AJOUTER CETTE LIGNE POUR IMPORTER LE MODULE
  ],
  controllers: [SemaineController],
  providers: [SemaineService],
  exports: [SemaineService]
})
export class SemaineModule {}