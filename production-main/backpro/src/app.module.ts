// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { Admin } from './admin/entities/admin.entity';
import { User } from './user/entities/user.entity';
import { ProductModule } from './product/product.module';
import { SemaineModule } from './semaine/semaine.module';
import { OuvrierModule } from './ouvrier/ouvrier.module';
import { TempsSecModule } from './temps-sec/temps-sec.module';
import { Phase } from './phase/entities/phase.entity';
import { PhaseModule } from './phase/phase.module';
import { MatierePremierModule } from './matiere-premier/matiere-premier.module';
import { SaisieRapportModule } from './saisie-rapport/saisie-rapport.module';
import { NonConfModule } from './non-conf/non-conf.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    // Configuration TypeORM directement ici
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3307,
      username: 'root', // Change selon ta config
      password: '', // Change selon ta config  
      database: 'production', // Change le nom de ta base
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // ⚠️ Mettre à false en production
      logging: true, // Pour voir les requêtes SQL
      autoLoadEntities: true,
    }),
    AdminModule,
    UserModule,
    AuthModule,
    ProductModule,
    SemaineModule,
    OuvrierModule,
    TempsSecModule,
    PhaseModule,
    MatierePremierModule,
    SaisieRapportModule,
    NonConfModule,
    StatsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
