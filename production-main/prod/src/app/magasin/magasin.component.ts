import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SemaineService, Semaine } from '../prod/semaine.service';
import { ProductService, ProductLine } from '../prod/product.service';
import { MagasinService, PlanificationMagasin, GetPlanificationRequest } from './magasin.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-magasin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './magasin.component.html',
  styleUrls: ['./magasin.component.css']
})
export class MagasinComponent implements OnInit {
  semaines: Semaine[] = [];
  lignes: ProductLine[] = [];
  
  selectedSemaine: string = '';
  selectedLigne: string = '';
  
  planifications: PlanificationMagasin[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  
  // Pour le tableau organisé comme le PDF
  tableData: any[] = [];
  
  // Nouvelle structure pour le tableau horizontal
  horizontalTableData: any[] = [];
  weekDays: string[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  
  constructor(
    private semaineService: SemaineService,
    private productService: ProductService,
    private magasinService: MagasinService
  ) {}
  
  ngOnInit(): void {
    this.loadSemaines();
    this.loadLignes();
  }
  
  // Charger les semaines disponibles
  loadSemaines(): void {
    this.semaines = this.getWeeksList().map(nom => ({
      nom: nom,
      dateDebut: '',
      dateFin: ''
    }));
    
    if (this.semaines.length > 0) {
      this.selectedSemaine = this.semaines[0].nom;
    }
  }
  
  onSemaineChange(): void {
    this.errorMessage = '';
    this.planifications = [];
    this.tableData = [];
    this.horizontalTableData = [];
  }
  
  // Charger les lignes disponibles
  loadLignes(): void {
    this.productService.getAllLines().subscribe({
      next: (response) => {
        if (response && response.lines) {
          this.lignes = response.lines;
          if (this.lignes.length > 0) {
            this.selectedLigne = this.lignes[0].ligne;
          }
        }
      },
      error: (error) => {
        console.error('Erreur chargement lignes:', error);
        this.errorMessage = 'Erreur lors du chargement des lignes';
      }
    });
  }
  
  // Charger les données magasin
  loadMagasinData(): void {
    if (!this.selectedSemaine || !this.selectedLigne) {
      this.errorMessage = 'Veuillez sélectionner une semaine et une ligne';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    
    const request: GetPlanificationRequest = {
      ligne: this.selectedLigne,
      semaine: this.selectedSemaine
    };
    
    this.magasinService.getPlanificationsMagasin(request).subscribe({
      next: (response) => {
        this.planifications = response.details || [];
        this.organizeDataForTable();
        this.organizeDataForHorizontalTable(); // Organiser pour le tableau horizontal
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur chargement données magasin:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des données';
        this.isLoading = false;
        this.planifications = [];
        this.tableData = [];
        this.horizontalTableData = [];
      }
    });
  }
  
  // Organiser les données pour le tableau comme le PDF
  organizeDataForTable(): void {
    this.tableData = [];
    
    const groupedData: { [key: string]: any } = {};
    
    this.planifications.forEach(item => {
      if (item.quantiteSource > 0) {
        const key = `${item.reference}_${item.jour}`;
        
        if (!groupedData[key]) {
          groupedData[key] = {
            reference: item.reference,
            jour: item.jour,
            quantiteSource: item.quantiteSource,
            decMagasin: item.decMagasin || 0,
            typeQuantite: item.typeQuantite,
            qtePlanifiee: item.qtePlanifiee,
            qteModifiee: item.qteModifiee
          };
        }
      }
    });
    
    this.tableData = Object.values(groupedData).sort((a: any, b: any) => 
      a.reference.localeCompare(b.reference)
    );
  }
  
  // Nouvelle méthode: Organiser les données pour le tableau horizontal
  organizeDataForHorizontalTable(): void {
    this.horizontalTableData = [];
    
    // Grouper par référence
    const refMap = new Map<string, any>();
    
    this.planifications.forEach(item => {
      if (item.quantiteSource > 0) {
        if (!refMap.has(item.reference)) {
          refMap.set(item.reference, {
            reference: item.reference,
            lundi: { quantiteSource: 0, decMagasin: 0 },
            mardi: { quantiteSource: 0, decMagasin: 0 },
            mercredi: { quantiteSource: 0, decMagasin: 0 },
            jeudi: { quantiteSource: 0, decMagasin: 0 },
            vendredi: { quantiteSource: 0, decMagasin: 0 },
            samedi: { quantiteSource: 0, decMagasin: 0 }
          });
        }
        
        const refData = refMap.get(item.reference);
        const day = item.jour.toLowerCase();
        
        if (refData[day]) {
          refData[day] = {
            quantiteSource: item.quantiteSource,
            decMagasin: item.decMagasin || 0
          };
        }
      }
    });
    
    // Convertir en tableau et trier
    this.horizontalTableData = Array.from(refMap.values()).sort((a, b) => 
      a.reference.localeCompare(b.reference)
    );
  }
  
  // Mettre à jour la déclaration magasin
  updateDecMagasin(item: any, newValue: number, day?: string): void {
    const request = {
      semaine: this.selectedSemaine,
      jour: day || item.jour,
      ligne: this.selectedLigne,
      reference: item.reference,
      decMagasin: newValue
    };
    
    this.magasinService.updateDeclarationMagasin(request).subscribe({
      next: (response) => {
        console.log('Déclaration mise à jour:', response);
        
        // Mettre à jour les deux structures de données
        if (day) {
          // Pour le tableau horizontal
          const horizontalItem = this.horizontalTableData.find(
            data => data.reference === item.reference
          );
          if (horizontalItem && horizontalItem[day]) {
            horizontalItem[day].decMagasin = newValue;
          }
        } else {
          // Pour le tableau vertical
          item.decMagasin = newValue;
        }
      },
      error: (error) => {
        console.error('Erreur mise à jour déclaration:', error);
        this.errorMessage = 'Erreur lors de la mise à jour de la déclaration';
      }
    });
  }
  
  // Générer et télécharger le PDF
  downloadPDF(): void {
    if (this.horizontalTableData.length === 0) {
      this.errorMessage = 'Aucune donnée à exporter en PDF';
      return;
    }
    
    this.generateHorizontalPDF();
  }
  
  // Nouvelle méthode: Générer le PDF avec tableau horizontal
 private generateHorizontalPDF(): void {
  try {
    const doc = new jsPDF('landscape');
    
    // Titre
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`PLANIFICATION MAGASIN`, 14, 15);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ligne: ${this.selectedLigne}`, 14, 25);
    doc.text(`Semaine: ${this.selectedSemaine}`, 14, 32);
    
    // Préparer les données pour le tableau
    const headers = [
      'RÉFÉRENCE',
      'LUNDI C',
      'LUNDI DM',
      'MARDI C', 
      'MARDI DM',
      'MERCREDI C',
      'MERCREDI DM',
      'JEUDI C',
      'JEUDI DM',
      'VENDREDI C',
      'VENDREDI DM',
      'SAMEDI C',
      'SAMEDI DM'
    ];
    
    const tableData = this.horizontalTableData.map(item => [
      item.reference,
      item.lundi?.quantiteSource || 0,
      item.lundi?.decMagasin || '',
      item.mardi?.quantiteSource || 0,
      item.mardi?.decMagasin || '',
      item.mercredi?.quantiteSource || 0,
      item.mercredi?.decMagasin || '',
      item.jeudi?.quantiteSource || 0,
      item.jeudi?.decMagasin || '',
      item.vendredi?.quantiteSource || 0,
      item.vendredi?.decMagasin || '',
      item.samedi?.quantiteSource || 0,
      item.samedi?.decMagasin || ''
    ]);
    
    // Générer le tableau manuellement (sans autoTable)
    this.generateManualTable(doc, headers, tableData);
    
    // Télécharger
    doc.save(`Magasin-${this.selectedLigne}-${this.selectedSemaine}-Tableau.pdf`);
    
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    this.errorMessage = 'Erreur lors de la génération du PDF';
  }
}

private generateManualTable(doc: jsPDF, headers: string[], data: any[][], startY: number = 40): number {
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - margin * 2) / headers.length;
  let y = startY;
  
  // Styles pour l'en-tête
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(41, 128, 185);
  doc.setTextColor(255, 255, 255);
  
  // Dessiner l'en-tête
  let x = margin;
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidth, 10, 'F');
    doc.text(header, x + 2, y + 7);
    x += colWidth;
  });
  
  y += 10;
  
  // Styles pour le corps
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  // Dessiner les données
  data.forEach((row, rowIndex) => {
    // Alterner les couleurs de fond
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 245, 245);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    
    // Dessiner la ligne
    x = margin;
    row.forEach((cell, cellIndex) => {
      doc.rect(x, y, colWidth, 8, 'F');
      
      // Alignement différent pour la première colonne (référence)
      if (cellIndex === 0) {
        doc.text(String(cell), x + 2, y + 6);
      } else {
        doc.text(String(cell), x + colWidth / 2, y + 6, { align: 'center' });
      }
      
      x += colWidth;
    });
    
    y += 8;
    
    // Vérifier si besoin d'une nouvelle page
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage('landscape');
      y = margin;
    }
  });
  
  return y;
}
  
  // Méthode alternative: Générer le PDF manuellement (sans autoTable)
  private generateManualHorizontalPDF(): void {
    try {
      const doc = new jsPDF('landscape');
      
      // Configuration
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;
      
      // Titre
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`PLANIFICATION MAGASIN`, pageWidth / 2, y, { align: 'center' });
      y += 10;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ligne: ${this.selectedLigne} | Semaine: ${this.selectedSemaine}`, pageWidth / 2, y, { align: 'center' });
      y += 15;
      
      // En-tête du tableau
      const colWidth = 20;
      const refColWidth = 30;
      let x = margin;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      
      // Première ligne d'en-tête
      doc.text('RÉFÉRENCE', x, y);
      x += refColWidth;
      
      this.weekDays.forEach(day => {
        doc.text(day.toUpperCase(), x + colWidth / 2, y, { align: 'center' });
        x += colWidth * 2; // 2 colonnes par jour (C et DM)
      });
      
      y += 8;
      x = margin;
      
      // Deuxième ligne d'en-tête (C/DM)
      doc.text('', x, y);
      x += refColWidth;
      
      this.weekDays.forEach(day => {
        doc.text('C', x, y);
        doc.text('DM', x + colWidth, y);
        x += colWidth * 2;
      });
      
      y += 8;
      
      // Ligne séparatrice
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      // Données
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      this.horizontalTableData.forEach((item, index) => {
        x = margin;
        
        // Référence
        doc.text(item.reference, x, y);
        x += refColWidth;
        
        // Données par jour
        this.weekDays.forEach(day => {
          const dayData = item[day] || { quantiteSource: 0, decMagasin: 0 };
          
          // C
          doc.text(dayData.quantiteSource.toString(), x + colWidth / 2, y, { align: 'center' });
          
          // DM
          const dmText = dayData.decMagasin > 0 ? dayData.decMagasin.toString() : '';
          doc.text(dmText, x + colWidth + colWidth / 2, y, { align: 'center' });
          
          x += colWidth * 2;
        });
        
        y += 8;
        
        // Ligne séparatrice entre les références
        if (index < this.horizontalTableData.length - 1) {
          doc.line(margin, y - 2, pageWidth - margin, y - 2);
          y += 2;
        }
        
        // Nouvelle page si nécessaire
        if (y > pageHeight - 20) {
          doc.addPage('landscape');
          y = margin;
        }
      });
      
      // Pied de page
      doc.setFontSize(9);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10);
      
      // Télécharger
      doc.save(`Magasin-${this.selectedLigne}-${this.selectedSemaine}.pdf`);
      
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }
  
  getWeeksList(): string[] {
    const weeks = [];
    for (let i = 1; i <= 52; i++) {
      weeks.push(`semaine${i}`);
    }
    return weeks;
  }
}