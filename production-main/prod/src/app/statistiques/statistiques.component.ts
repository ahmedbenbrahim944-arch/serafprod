import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsService } from './stats.service';
import { Chart, registerables } from 'chart.js';
import { RouterModule } from '@angular/router';

Chart.register(...registerables);

interface LigneStats {
  ligne: string;
  pcsProdTotal: number;
  nombrePlanifications: number;
  nombreReferences: number;
  totalQteSource: number;
  totalDecProduction: number;
}

@Component({
  selector: 'app-statistiques',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './statistiques.component.html',
  styleUrls: ['./statistiques.component.css']
})
export class StatistiquesComponent implements OnInit, OnDestroy {
  semaineSelectionnee: string = 'semaine1';
  statsLignes: LigneStats[] = [];
  ligneSelectionnee: string | null = null;
  isLoading: boolean = false;
  showStats: boolean = false;

  private barChart: Chart | null = null;
  private pieCharts: Map<string, Chart> = new Map();

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    // Ne pas charger automatiquement
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  /**
   * Génère un tableau de 1 à 52 pour les semaines
   */
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
    
    this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes;
        this.isLoading = false;
        this.showStats = true;
        
        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
          this.creerGraphiques();
        }, 100);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
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
    this.pieCharts.forEach(chart => chart.destroy());
    this.pieCharts.clear();
  }

  creerGraphiques(): void {
    this.destroyAllCharts();
    this.creerHistogramme();
    this.creerGraphiquesCirculaires();
  }

  creerHistogramme(): void {
    const ctx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsLignes.map(l => l.ligne);
    const data = this.statsLignes.map(l => l.pcsProdTotal);
    const colors = data.map(value => this.getColorForPercentage(value));

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rendement (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%',
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `Rendement: ${value.toFixed(2)}%`;
              }
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 13
            }
          }
        }
      }
    });
  }

  creerGraphiquesCirculaires(): void {
    this.statsLignes.forEach(ligne => {
      const canvasId = `pieChart-${ligne.ligne}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) return;

      const rendement = ligne.pcsProdTotal;
      const ecart = 100 - rendement;
      
      // Couleurs dégradées dynamiques
      const getGradientColors = (perc: number) => {
        if (perc >= 75) return ['#43e97b', '#38f9d7'];
        if (perc >= 50) return ['#4facfe', '#00f2fe'];
        return ['#00f2fe', '#667eea'];
      };
      
      const [color1, color2] = getGradientColors(rendement);

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Rendement', 'Écart'],
          datasets: [{
            data: [rendement, ecart],
            backgroundColor: [
              color1,
              'rgba(255, 255, 255, 0.15)'
            ],
            borderWidth: 0,
            borderRadius: 8
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
                label: (context) => {
                  const value = context.parsed ?? 0;
                  return `${context.label}: ${value.toFixed(2)}%`;
                }
              },
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 10
            }
          }
        }
      });

      this.pieCharts.set(ligne.ligne, chart);
    });
  }

  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
    // Vous pouvez ajouter une navigation ou afficher plus de détails
  }

  getColorForPercentage(percentage: number): string {
    // Dégradé fluide entre bleu et vert
    if (percentage >= 75) return '#43e97b'; // Vert éclatant
    if (percentage >= 50) return '#38f9d7'; // Turquoise
    if (percentage >= 25) return '#4facfe'; // Bleu clair
    return '#00f2fe'; // Cyan
  }
}