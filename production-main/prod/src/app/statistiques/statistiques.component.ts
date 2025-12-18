import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsService } from './stats.service';
import { Chart, registerables } from 'chart.js';
import { Router } from '@angular/router';

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
  imports: [CommonModule, FormsModule],
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

  constructor(private statsService: StatsService ,  private router: Router) {}
  

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
    
    this.statsService.getPcsProdTotalParLigne(this.semaineSelectionnee).subscribe({
      next: (response) => {
        this.statsLignes = response.lignes;
        this.isLoading = false;
        this.showStats = true;
        
        setTimeout(() => {
          this.creerGraphiques();
        }, 100);
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.isLoading = false;
        alert('Erreur lors du chargement');
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
  
  // Couleurs en fonction du rendement (vert pour haut, orange/rouge pour bas)
  const colors = data.map(value => {
    if (value >= 75) return '#10b981'; // Vert foncé
    if (value >= 50) return '#22c55e'; // Vert
    if (value >= 25) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
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

// Méthode utilitaire pour assombrir une couleur
private darkenColor(color: string): string {
  const colors: {[key: string]: string} = {
    '#10b981': '#0da271', // Vert foncé assombri
    '#22c55e': '#1aa152', // Vert assombri
    '#f59e0b': '#d6880a', // Orange assombri
    '#ef4444': '#d33838'  // Rouge assombri
  };
  return colors[color] || '#374151';
}

 creerGraphiquesCirculaires(): void {
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
            '#10b981', // Vert pour le rendement
            '#ef4444'  // Rouge pour l'écart
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    this.pieCharts.set(ligne.ligne, chart);
  });
}

  selectionnerLigne(ligne: string): void {
    this.ligneSelectionnee = ligne;
    // Logique supplémentaire si nécessaire
  }

  getColorForPercentage(percentage: number): string {
    if (percentage >= 75) return '#10b981'; // Vert
    if (percentage >= 50) return '#3b82f6'; // Bleu
    if (percentage >= 25) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  }
   retourChoix() {
    this.router.navigate(['/choix']);
  }
}