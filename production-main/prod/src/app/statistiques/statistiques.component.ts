import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsService, Pourcentage5MResponse } from './stats.service';
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
  semaineSelectionnee: string = 'semaine1';
  statsLignes: LigneStats[] = [];
  stats5M: Stats5M | null = null;
  ligneSelectionnee: string | null = null;
  isLoading: boolean = false;
  showStats: boolean = false;

  private barChart: Chart | null = null;
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
    // Ne pas charger automatiquement
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  getSemainesArray(): number[] {
    return Array.from({ length: 52 }, (_, i) => i + 1);
  }

  chargerStatistiques(): void {
    if (!this.semaineSelectionnee) {
      alert('Veuillez sélectionner une semaine');
      return;
    }

    this.isLoading = true;
    this.showStats = false;
    
    // Charger les deux APIs en parallèle
    forkJoin({
      lignes: this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee),
      pourcentage5M: this.statsService.getPourcentage5MParSemaine(this.semaineSelectionnee)
    }).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes.lignes;
        
        // Extraire les pourcentages dans le total 5M
        const causes = response.pourcentage5M.pourcentagesParCause;
        this.stats5M = {
          matierePremiere: causes.matierePremiere.pourcentageDansTotal5MNumber,
          absence: causes.absence.pourcentageDansTotal5MNumber,
          rendement: causes.rendement.pourcentageDansTotal5MNumber,
          maintenance: causes.maintenance.pourcentageDansTotal5MNumber,
          qualite: causes.qualite.pourcentageDansTotal5MNumber
        };

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

  private destroyAllCharts(): void {
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
    this.pieCharts5M.forEach(chart => chart.destroy());
    this.pieCharts5M.clear();
  }

  creerGraphiques(): void {
    this.destroyAllCharts();
    this.creerHistogramme();
    this.creerGraphiquesCirculaires5M();
  }

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

  private darkenColor(color: string): string {
    const colors: {[key: string]: string} = {
      '#10b981': '#0da271',
      '#22c55e': '#1aa152',
      '#f59e0b': '#d6880a',
      '#ef4444': '#d33838'
    };
    return colors[color] || '#374151';
  }

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
              '#e5e7eb'  // Gris clair pour le reste
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

  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
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
}