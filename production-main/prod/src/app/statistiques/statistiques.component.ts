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
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './statistiques.component.html',
  styleUrls: ['./statistiques.component.css']
})
export class StatistiquesComponent implements OnInit, OnDestroy {
  semaineSelectionnee: string = 'semaine4';
  statsLignes: LigneStats[] = [];
  ligneSelectionnee: string | null = null;
  isLoading: boolean = false;

  private barChart: Chart | null = null;
  private pieCharts: Map<string, Chart> = new Map();

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.chargerStatistiques();
  }

  ngOnDestroy(): void {
    // Détruire tous les graphiques lors de la destruction du composant
    if (this.barChart) {
      this.barChart.destroy();
    }
    this.pieCharts.forEach(chart => chart.destroy());
    this.pieCharts.clear();
  }

  chargerStatistiques(): void {
    this.isLoading = true;
    
    this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes;
        this.isLoading = false;
        
        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
          this.creerGraphiques();
        }, 100);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
        this.isLoading = false;
      }
    });
  }

  creerGraphiques(): void {
    this.creerHistogramme();
    this.creerGraphiquesCirculaires();
  }

  creerHistogramme(): void {
    // Détruire le graphique existant
    if (this.barChart) {
      this.barChart.destroy();
    }

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
          label: 'PCS Prod Total (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 2
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
              callback: (value) => value + '%'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `Rendement: ${context.parsed.y}%`
            }
          }
        }
      }
    });
  }

  creerGraphiquesCirculaires(): void {
    // Détruire les graphiques existants
    this.pieCharts.forEach(chart => chart.destroy());
    this.pieCharts.clear();

    this.statsLignes.forEach(ligne => {
      const canvasId = `pieChart-${ligne.ligne}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!ctx) return;

      const rendement = ligne.pcsProdTotal;
      const ecart = 100 - rendement;

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Rendement', 'Écart'],
          datasets: [{
            data: [rendement, ecart],
            backgroundColor: [
              this.getColorForPercentage(rendement),
              '#2c3e50'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${context.parsed}%`
              }
            }
          }
        }
      });

      this.pieCharts.set(ligne.ligne, chart);
    });
  }

  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
  }

  getColorForPercentage(percentage: number): string {
    if (percentage >= 70) return 'rgba(107, 144, 128, 0.7)';
    if (percentage >= 50) return 'rgba(107, 144, 128, 0.85)';
    if (percentage >= 30) return 'rgba(107, 144, 128, 0.6)';
    return 'rgba(107, 144, 128, 0.4)';
  }
}