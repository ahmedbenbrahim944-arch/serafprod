import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  StatsService, 
  Pourcentage5MResponse,
  Pourcentage5MParLigneResponse,
  Ligne5MStats
} from './stats.service';
import { Chart, registerables } from 'chart.js';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

Chart.register(...registerables);

interface LigneStats {
  ligne: string;
  pcsProdTotal: number;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
}

interface Stats5M {
  matierePremiere: number;
  absence: number;
  rendement: number;
  maintenance: number;
  qualite: number;
}

@Component({
  selector: 'app-statistiques',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statistiques.component.html',
  styleUrls: ['./statistiques.component.css']
})
export class StatistiquesComponent implements OnInit, OnDestroy {
  // Propriétés pour le filtre par semaine
  semaineSelectionnee: string = 'semaine1';
  statsLignes: LigneStats[] = [];
  stats5M: Stats5M | null = null;
  ligneSelectionnee: string | null = null;
  isLoading: boolean = false;
  showStats: boolean = false;

  // Propriétés pour le filtre par date
  dateSelectionnee: string = '';
  maxDate: string = '';
  showStatsDate: boolean = false;
  isLoadingDate: boolean = false;
  statsDate: any = null;
  statsLignesDate: LigneStats[] = [];
  showNonSaisieList: boolean = false;
  showSaisieDetails: boolean = false;

  // Propriétés pour les 5M par ligne (semaine uniquement)
  stats5MParLigneData: Ligne5MStats[] = [];
  titre5M: string = '';

  // Charts
  private barChart: Chart | null = null;
  private barChartDate: Chart | null = null;
  private pieCharts5M: Map<string, Chart> = new Map();

  // Couleurs pour les 5M
  private readonly couleurs5M = {
    matierePremiere: '#ef4444',  // Rouge
    absence: '#f59e0b',          // Orange
    rendement: '#10b981',        // Vert
    maintenance: '#3b82f6',      // Bleu
    qualite: '#8b5cf6'           // Violet
  };

  constructor(private statsService: StatsService, private router: Router) {}

  ngOnInit(): void {
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  getSemainesArray(): number[] {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }

  /**
   * Charger les statistiques par semaine
   */
  chargerStatistiques(): void {
    if (!this.semaineSelectionnee) {
      alert('Veuillez sélectionner une semaine');
      return;
    }

    this.isLoading = true;
    this.showStats = false;
    this.showStatsDate = false; // Masquer les stats par date
    this.ligneSelectionnee = null;
    
    forkJoin({
      lignes: this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee),
      pourcentage5M: this.statsService.getPourcentage5MParSemaine(this.semaineSelectionnee),
      pourcentage5MParLigne: this.statsService.getPourcentage5MParLigne(this.semaineSelectionnee)
    }).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes.lignes;
        this.stats5MParLigneData = response.pourcentage5MParLigne.lignes;
        
        const causes = response.pourcentage5M.pourcentagesParCause;
        this.stats5M = {
          matierePremiere: causes.matierePremiere.pourcentageDansTotal5MNumber,
          absence: causes.absence.pourcentageDansTotal5MNumber,
          rendement: causes.rendement.pourcentageDansTotal5MNumber,
          maintenance: causes.maintenance.pourcentageDansTotal5MNumber,
          qualite: causes.qualite.pourcentageDansTotal5MNumber
        };

        this.titre5M = `Analyse des 5M - ${this.semaineSelectionnee}`;

        this.isLoading = false;
        this.showStats = true;
        
        setTimeout(() => {
          this.creerGraphiques();
        }, 100);
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.isLoading = false;
        alert('Erreur lors du chargement des statistiques');
      }
    });
  }

  /**
   * Charger les statistiques par date
   */
  chargerStatsParDate(): void {
    if (!this.dateSelectionnee) {
      alert('Veuillez sélectionner une date');
      return;
    }

    this.isLoadingDate = true;
    this.showStatsDate = false;
    this.showStats = false; // Masquer les stats par semaine
    
    this.statsService.getStatsParDate(this.dateSelectionnee).subscribe({
      next: (response) => {
        this.statsDate = response;
        
        // Extraire les lignes de production pour la date
        this.statsLignesDate = response.productionParLigne.map(ligne => ({
          ligne: ligne.ligne,
          pcsProdTotal: ligne.pcsProdTotal,
          nombrePlanifications: ligne.nombrePlanifications,
          nombreReferences: ligne.nombreReferences,
          totalQteSource: ligne.totalQteSource,
          totalDecProduction: ligne.totalDecProduction
        }));
        
        console.log('Stats par date:', response);
        
        this.isLoadingDate = false;
        this.showStatsDate = true;
        this.showNonSaisieList = false;
        this.showSaisieDetails = false;
        
        setTimeout(() => {
          this.creerGraphiquesDate();
        }, 100);
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.isLoadingDate = false;
        alert('Erreur lors du chargement des statistiques pour cette date');
      }
    });
  }

  /**
   * Détruire tous les graphiques
   */
  private destroyAllCharts(): void {
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
    if (this.barChartDate) {
      this.barChartDate.destroy();
      this.barChartDate = null;
    }
    this.pieCharts5M.forEach(chart => chart.destroy());
    this.pieCharts5M.clear();
  }

  /**
   * Créer les graphiques pour la semaine
   */
  creerGraphiques(): void {
    this.destroyAllCharts();
    this.creerHistogramme();
    this.creerGraphiquesCirculaires5M();
  }

  /**
   * Créer les graphiques pour la date
   */
  creerGraphiquesDate(): void {
    // Détruire uniquement le graphique date si il existe
    if (this.barChartDate) {
      this.barChartDate.destroy();
      this.barChartDate = null;
    }
    
    this.creerHistogrammeDate();
  }

  /**
   * Créer l'histogramme pour la semaine
   */
  creerHistogramme(): void {
    const ctx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsLignes.map(l => l.ligne);
    const data = this.statsLignes.map(l => l.pcsProdTotal);
    
    const colors = data.map(value => {
      if (value >= 75) return '#10b981';
      if (value >= 50) return '#22c55e';
      if (value >= 25) return '#f59e0b';
      return '#ef4444';
    });

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rendement (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => this.darkenColor(c)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Rendement (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Lignes de production'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  /**
   * Créer l'histogramme pour la date
   */
  creerHistogrammeDate(): void {
    const ctx = document.getElementById('barChartDate') as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsLignesDate.map(l => l.ligne);
    const data = this.statsLignesDate.map(l => l.pcsProdTotal);
    
    const colors = data.map(value => {
      if (value >= 75) return '#10b981';
      if (value >= 50) return '#22c55e';
      if (value >= 25) return '#f59e0b';
      return '#ef4444';
    });

    this.barChartDate = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rendement (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => this.darkenColor(c)),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Rendement (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Lignes de production'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  private darkenColor(color: string): string {
    const colors: {[key: string]: string} = {
      '#10b981': '#0da271',
      '#22c55e': '#1aa152',
      '#f59e0b': '#d6880a',
      '#ef4444': '#d33838'
    };
    return colors[color] || '#374151';
  }

  /**
   * Créer les graphiques circulaires des 5M
   */
  creerGraphiquesCirculaires5M(): void {
    if (!this.stats5M) return;

    const causes5M = [
      { nom: 'matierePremiere', valeur: this.stats5M.matierePremiere },
      { nom: 'absence', valeur: this.stats5M.absence },
      { nom: 'rendement', valeur: this.stats5M.rendement },
      { nom: 'maintenance', valeur: this.stats5M.maintenance },
      { nom: 'qualite', valeur: this.stats5M.qualite }
    ];

    causes5M.forEach((cause) => {
      const canvasId = `pieChart-${cause.nom}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) return;

      const valeur = cause.valeur;
      const reste = 100 - valeur;
      const couleur = this.couleurs5M[cause.nom as keyof typeof this.couleurs5M];

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pourcentage', 'Reste'],
          datasets: [{
            data: [valeur, reste],
            backgroundColor: [
              couleur,
              '#e5e7eb'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return context.parsed.toFixed(1) + '%';
                }
              }
            }
          }
        }
      });

      this.pieCharts5M.set(cause.nom, chart);
    });
  }

  /**
   * Sélectionner une ligne (pour le mode semaine avec 5M)
   */
  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
    
    const ligne5M = this.stats5MParLigneData.find(l => l.ligne === ligne);
    
    if (ligne5M) {
      this.titre5M = `Analyse des 5M - ${ligne}`;
      
      this.stats5M = {
        matierePremiere: ligne5M.detailParCause.matierePremiere.pourcentageDuTotal,
        absence: ligne5M.detailParCause.absence.pourcentageDuTotal,
        rendement: ligne5M.detailParCause.rendement.pourcentageDuTotal,
        maintenance: ligne5M.detailParCause.maintenance.pourcentageDuTotal,
        qualite: ligne5M.detailParCause.qualite.pourcentageDuTotal
      };
      
      setTimeout(() => {
        this.creerGraphiquesCirculaires5M();
      }, 50);
    }
  }

  getColorForPercentage(percentage: number): string {
    if (percentage >= 75) return '#10b981';
    if (percentage >= 50) return '#3b82f6';
    if (percentage >= 25) return '#f59e0b';
    return '#ef4444';
  }

  retourChoix(): void {
    this.router.navigate(['/choix']);
  }

  /**
   * Méthodes pour les statistiques de saisie
   */
  getLignesAvecSaisie(): any[] {
    if (!this.statsDate?.rapportsSaisie?.repartitionParLigne) {
      return [];
    }
    
    return Object.entries(this.statsDate.rapportsSaisie.repartitionParLigne).map(([nom, data]: [string, any]) => ({
      nom,
      nombreOuvriers: data.nombreOuvriers,
      totalHeures: data.totalHeures
    }));
  }

  toggleNonSaisieList(): void {
    this.showNonSaisieList = !this.showNonSaisieList;
  }

  toggleSaisieDetails(): void {
    this.showSaisieDetails = !this.showSaisieDetails;
  }

  notifyOuvrier(ouvrier: any): void {
    if (confirm(`Voulez-vous notifier ${ouvrier.nomPrenom} (${ouvrier.matricule}) ?`)) {
      alert(`Notification envoyée à ${ouvrier.nomPrenom}`);
    }
  }
}