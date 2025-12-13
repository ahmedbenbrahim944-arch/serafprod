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
      'Authorization': `Bearer ${this.getToken()}` // Ajouter le token JWT
    });

    // Utilisation de la route GET avec query params
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
   * Récupère le token JWT depuis le localStorage
   */
  private getToken(): string {
    return localStorage.getItem('access_token') || '';
  }
}