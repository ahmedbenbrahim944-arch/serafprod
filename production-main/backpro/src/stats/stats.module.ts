// src/stats/stats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { Semaine } from '../semaine/entities/semaine.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Planification, NonConformite, Semaine]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService]
})
export class StatsModule {}