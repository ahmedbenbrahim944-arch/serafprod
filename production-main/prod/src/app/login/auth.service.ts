// src/app/login/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';

export interface LoginCredentials {
  nom: string;
  password: string;
}

export interface RegisterData {
  nom: string;
  prenom: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: number;
    nom: string;
    prenom: string;
    type: 'admin' | 'user';
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000'; // Changez selon votre configuration
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'current_user';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /**
   * Connexion Admin
   */
  adminLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/admin/login`, credentials)
      .pipe(
        tap(response => {
          this.saveAuthData(response);
          this.router.navigate(['/prod']); // Route pour admin
        }),
        catchError(error => {
          console.error('Admin login error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Connexion User (Chef Secteur)
   */
  userLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/user/login`, credentials)
      .pipe(
        tap(response => {
          this.saveAuthData(response);
          this.router.navigate(['/choix']); // Route pour user
        }),
        catchError(error => {
          console.error('User login error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Inscription Admin (première création)
   */
  registerAdmin(data: RegisterData): Observable<any> {
    return this.http.post(`${this.API_URL}/admin/register`, data)
      .pipe(
        catchError(error => {
          console.error('Register error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Sauvegarder les données d'authentification
   */
  private saveAuthData(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
  }

  /**
   * Récupérer le token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Récupérer les infos utilisateur
   */
  getCurrentUser(): any {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Récupérer le type d'utilisateur
   */
  getUserType(): 'admin' | 'user' | null {
    const user = this.getCurrentUser();
    return user ? user.type : null;
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.getUserType() === 'admin';
  }

  /**
   * Vérifier si l'utilisateur est user (chef secteur)
   */
  isUser(): boolean {
    return this.getUserType() === 'user';
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.router.navigate(['/login']);
  }

  /**
   * Obtenir les headers avec le token
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
}