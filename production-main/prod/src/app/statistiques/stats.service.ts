import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneStats {
  ligne: string;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
  pcsProdTotal: number;
  references: ReferenceStats[];
}

export interface ReferenceStats {
  reference: string;
  pcsProd: number;
}

export interface StatsResponse {
  message: string;
  semaine: string;
  dateCalcul: string;
  nombreLignes: number;
  lignes: LigneStats[];
}

export interface Pourcentage5MCause {
  total: number;
  pourcentage: string;
  pourcentageNumber: number;
  pourcentageDansTotal5M: string;
  pourcentageDansTotal5MNumber: number;
}

export interface OuvrierSaisie {
  matricule: string;
  nomPrenom: string;
  ligne?: string;
  totalHeures?: number;
  nbPhases?: number;
  phases?: any;
}
// stats.service.ts (Angular - À ajouter aux méthodes existantes)

// Interface pour l'affectation du personnel
export interface JourAffectation {
  jour: string;
  nbPlanifie: number;
  nbSaisi: number;
  difference: number;
  statut: 'CONFORME' | 'NON_CONFORME';
  message: string;
}

export interface LigneAffectation {
  ligne: string;
  jours: JourAffectation[];
}

export interface AffectationPersonnelResponse {
  message: string;
  semaine: string;
  dateCalcul: string;
  statistiquesGlobales: {
    totalPlanifie: number;
    totalSaisi: number;
    difference: number;
    nbNonConformites: number;
    tauxConformite: string;
  };
  lignes: LigneAffectation[];
}



export interface StatsSaisieResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
  nombreRapportsSaisis: number;
  nombreTotalRapports: number;
  nombreOuvriersTotal: number;
  nombreOuvriersNonSaisis: number;
  tauxSaisie: number;
  ouvriersNonSaisis: OuvrierSaisie[];
  ouvriersAyantSaisi: OuvrierSaisie[];
  repartitionParLigne: {
    [ligne: string]: {
      nombreOuvriers: number;
      totalHeures: number;
      ouvriers: Array<{
        matricule: string;
        nomPrenom: string;
        heures: number;
      }>;
    };
  };
}



export interface StatsParDateResponse {
  message: string;
  periode: {
    date: string;
    jour: string;
    semaine: string;
    dateCalcul: string;
  };
  productionParLigne: Array<{
    ligne: string;
    nombrePlanifications: number;
    nombreReferences: number;
    totalQteSource: number;
    totalDecProduction: number;
    pcsProdTotal: number;
    total5M: number;
    pourcentage5M: number;
    references: Array<any>;
  }>;
  resumeProduction: {
    nombreLignes: number;
    totalQteSource: number;
    totalDecProduction: number;
    pcsProdMoyen: number;
    total5M: number;
    pourcentage5MMoyen: number;
  };
  rapportsSaisie: StatsSaisieResponse;
}

export interface Pourcentage5MResponse {
  message: string;
  periode: {
    semaine: string;
    dateCalcul: string;
    nombrePlanifications: number;
  };
  resume: {
    totalQuantitePlanifiee: number;
    total5M: number;
    pourcentageTotal5M: string;
    pourcentageTotal5MNumber: number;
  };
  pourcentagesParCause: {
    matierePremiere: Pourcentage5MCause;
    absence: Pourcentage5MCause;
    rendement: Pourcentage5MCause;
    maintenance: Pourcentage5MCause;
    qualite: Pourcentage5MCause;
  };
  resumeTableau: Array<{
    cause: string;
    total: number;
    pourcentage: number;
    pourcentageDans5M: number;
  }>;
}

// Nouvelle interface pour les 5M par ligne
export interface DetailParCause {
  quantite: number;
  pourcentage: number;
  pourcentageDuTotal: number;
}

export interface Ligne5MStats {
  ligne: string;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQuantiteSource: number;
  total5M: number;
  pourcentage5M: number;
  detailParCause: {
    matierePremiere: DetailParCause;
    absence: DetailParCause;
    rendement: DetailParCause;
    maintenance: DetailParCause;
    qualite: DetailParCause;
  };
}

export interface Pourcentage5MParLigneResponse {
  message: string;
  periode: {
    semaine: string;
    dateCalcul: string;
    nombreTotalPlanifications: number;
    nombreLignes: number;
  };
  resumeGlobal: {
    totalQuantiteSource: number;
    total5M: number;
    pourcentage5MGlobal: number;
  };
  lignes: Ligne5MStats[];
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private apiUrl = 'http://localhost:3000/stats';

  constructor(private http: HttpClient) {}

  /**
   * Récupère le PCS Prod Total par ligne pour une semaine donnée
   */
  getPcsProdTotalParLigne(semaine: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<StatsResponse>(`${this.apiUrl}/lignes`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST
   */
  getPcsProdTotalParLignePost(semaine: string): Observable<StatsResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<StatsResponse>(`${this.apiUrl}/lignes`, 
      { semaine },
      { headers }
    );
  }

  /**
   * Récupère les statistiques détaillées pour une ligne et une semaine
   */
  getStatsBySemaineAndLigne(semaine: string, ligne: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<any>(this.apiUrl, 
      { semaine, ligne },
      { headers }
    );
  }

  /**
   * Récupère les pourcentages des 5M pour une semaine donnée
   */
  getPourcentage5MParSemaine(semaine: string): Observable<Pourcentage5MResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST pour les pourcentages 5M
   */
  getPourcentage5MParSemainePost(semaine: string): Observable<Pourcentage5MResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<Pourcentage5MResponse>(`${this.apiUrl}/pourcentage-5m`, 
      { semaine },
      { headers }
    );
  }

  /**
   * NOUVELLE MÉTHODE: Récupère les pourcentages des 5M par ligne pour une semaine donnée
   */
  getPourcentage5MParLigne(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`, {
      params: { semaine },
      headers
    });
  }

  /**
   * Alternative: Utilisation de la route POST pour les pourcentages 5M par ligne
   */
  getPourcentage5MParLignePost(semaine: string): Observable<Pourcentage5MParLigneResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.post<Pourcentage5MParLigneResponse>(`${this.apiUrl}/pourcentage-5m-ligne`, 
      { semaine },
      { headers }
    );
  }

  /**
   * Récupère le token JWT depuis le localStorage
   */
  private getToken(): string {
    return localStorage.getItem('access_token') || '';
  }

  getStatsParDate(date: string): Observable<StatsParDateResponse> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.get<StatsParDateResponse>(`${this.apiUrl}/par-date`, {
    params: { date },
    headers
  });
}

getStatsParDatePost(date: string): Observable<StatsParDateResponse> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.post<StatsParDateResponse>(`${this.apiUrl}/par-date`, 
    { date },
    { headers }
  );
}

getRapportsSaisieParDate(date: string): Observable<StatsSaisieResponse> {
  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.getToken()}`
  });

  return this.http.get<StatsSaisieResponse>(`${this.apiUrl}/rapports-saisie-date`, {
    params: { date },
    headers
  });
}
getAffectationPersonnel(semaine: string): Observable<AffectationPersonnelResponse> {
  return this.http.get<AffectationPersonnelResponse>(
    `${this.apiUrl}/affectation-personnel?semaine=${semaine}`
  );
}
}