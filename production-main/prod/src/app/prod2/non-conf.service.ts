// src/app/services/non-conf.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../login/auth.service';

export interface CreateOrUpdateNonConfDto {
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  matierePremiere?: number;
  absence?: number;
  rendement?: number;
  maintenance?: number;
  qualite?: number;
  referenceMatierePremiere?: string;
  commentaire?: string;
}

export interface GetNonConfDto {
  semaine?: string;
  jour?: string;
  ligne?: string;
  reference?: string;
}

export interface NonConformiteResponse {
  id: number;
  semaine: string;
  jour: string;
  ligne: string;
  reference: string;
  total5M: number;
  details: {
    matierePremiere: number;
    referenceMatierePremiere: string;
    absence: number;
    rendement: number;
    maintenance: number;
    qualite: number;
  };
  commentaire: string;
  declarePar: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NonConfService {
  private apiUrl = 'http://localhost:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  public getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    
    if (!token) {
      console.warn('Aucun token d\'authentification trouvé');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ==================== UPSERT ====================
  createOrUpdateNonConformite(dto: CreateOrUpdateNonConfDto): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/nonconf`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== GET BY CRITERIA ====================
  getNonConformiteByCriteria(dto: GetNonConfDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/nonconf/recherche`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== CHECK EXISTS ====================
  checkNonConformiteExists(dto: GetNonConfDto): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/nonconf/exists`,
      dto,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== GET ALL ====================
  getNonConformites(dto: GetNonConfDto): Observable<any> {
    const params: any = {};
    if (dto.semaine) params.semaine = dto.semaine;
    if (dto.jour) params.jour = dto.jour;
    if (dto.ligne) params.ligne = dto.ligne;
    if (dto.reference) params.reference = dto.reference;

    return this.http.get<any>(
      `${this.apiUrl}/nonconf`,
      { 
        headers: this.getAuthHeaders(),
        params: params 
      }
    );
  }

  // ==================== DELETE ====================
  deleteNonConformite(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/nonconf/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== STATISTIQUES ====================
  getStats(semaine?: string): Observable<any> {
    const params: any = {};
    if (semaine) params.semaine = semaine;

    return this.http.get<any>(
      `${this.apiUrl}/nonconf/stats/total`,
      { 
        headers: this.getAuthHeaders(),
        params: params 
      }
    );
  }
}