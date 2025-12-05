// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProdComponent } from './prod/prod.component';
import { PlanificationComponent } from './planification/planification.component';
import { Prod2Component } from './prod2/prod2.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'planification', component: PlanificationComponent },
  { path: 'prod2', component: Prod2Component },
  { path: 'login', component: LoginComponent },
  { path: 'prod', component: ProdComponent },
  
  
];