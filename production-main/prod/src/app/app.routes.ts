// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProdComponent } from './prod/prod.component';
import { PlanificationComponent } from './planification/planification.component';
import { Prod2Component } from './prod2/prod2.component';
import { ChoixComponent } from './choix/choix.component';
import { StatistiquesComponent } from './statistiques/statistiques.component';
import { MagasinComponent } from './magasin/magasin.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'planification', component: PlanificationComponent },
  { path: 'prod2', component: Prod2Component },
  { path: 'login', component: LoginComponent },
  { path: 'prod', component: ProdComponent },
  { path: 'choix', component: ChoixComponent },
  { path: 'stat', component: StatistiquesComponent },
  { path: 'magasin', component: MagasinComponent }, // Ajout de la route pour MagasinComponent
  
  
];