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
  
  tableData: any[] = [];
  horizontalTableData: any[] = [];
  weekDays: string[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  daysWithData: string[] = [];
  
  constructor(
    private semaineService: SemaineService,
    private productService: ProductService,
    private magasinService: MagasinService
  ) {}
  
  ngOnInit(): void {
    this.loadSemaines();
    this.loadLignes();
  }
  
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
    this.daysWithData = [];
  }
  
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
        this.organizeDataForHorizontalTable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur chargement données magasin:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des données';
        this.isLoading = false;
        this.planifications = [];
        this.tableData = [];
        this.horizontalTableData = [];
        this.daysWithData = [];
      }
    });
  }
  
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
  
  organizeDataForHorizontalTable(): void {
    this.horizontalTableData = [];
    this.daysWithData = [];
    const refMap = new Map<string, any>();
    const daysSet = new Set<string>();
    
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
          
          if (item.quantiteSource > 0 || item.decMagasin > 0) {
            daysSet.add(day);
          }
        }
      }
    });
    
    this.horizontalTableData = Array.from(refMap.values()).sort((a, b) => 
      a.reference.localeCompare(b.reference)
    );
    
    this.daysWithData = this.weekDays.filter(day => daysSet.has(day));
  }
  
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
        
        if (day) {
          const horizontalItem = this.horizontalTableData.find(
            data => data.reference === item.reference
          );
          if (horizontalItem && horizontalItem[day]) {
            horizontalItem[day].decMagasin = newValue;
          }
        } else {
          item.decMagasin = newValue;
        }
      },
      error: (error) => {
        console.error('Erreur mise à jour déclaration:', error);
        this.errorMessage = 'Erreur lors de la mise à jour de la déclaration';
      }
    });
  }
  
  downloadPDF(): void {
    if (this.horizontalTableData.length === 0) {
      this.errorMessage = 'Aucune donnée à exporter en PDF';
      return;
    }
    
    this.generateFormattedPDF();
  }
  
  private generateFormattedPDF(): void {
    try {
      // Format portrait A4
      const doc = new jsPDF('portrait', 'mm', 'a4');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      
      // Titre principal - Couleur noire pour meilleure visibilité
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('DÉCLARATION MAGASIN', pageWidth / 2, 15, { align: 'center' });
      
      // Informations de la ligne et semaine
      doc.setFontSize(12);
      doc.text(`Ligne: ${this.selectedLigne}`, margin, 25);
      doc.text(`Semaine: ${this.selectedSemaine}`, pageWidth - margin, 25, { align: 'right' });
      
      // Séparateur
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, 30, pageWidth - margin, 30);
      
      if (this.daysWithData.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(255, 0, 0);
        doc.text('Aucune donnée disponible', pageWidth / 2, pageHeight / 2, { align: 'center' });
        
        const fileName = `Magasin-${this.selectedLigne}-${this.selectedSemaine}.pdf`;
        doc.save(fileName);
        return;
      }
      
      // Calcul dynamique des largeurs
      const refColWidth = 45;
      const cdmColWidth = 15;
      const availableWidth = pageWidth - (2 * margin) - refColWidth - cdmColWidth;
      const dayColWidth = availableWidth / this.daysWithData.length;
      
      let currentY = 35;
      
      // En-tête du tableau - Couleur de fond blanche
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      let currentX = margin;
      
      // Cellule REF
      doc.rect(currentX, currentY, refColWidth, 8);
      doc.text('REF', currentX + refColWidth / 2, currentY + 5, { align: 'center' });
      currentX += refColWidth;
      
      // Cellule C/DM
      doc.rect(currentX, currentY, cdmColWidth, 8);
      doc.text('C/DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
      currentX += cdmColWidth;
      
      // Cellules des jours - Texte noir sans fond
      this.daysWithData.forEach(day => {
        doc.rect(currentX, currentY, dayColWidth, 8);
        const dayLabel = this.getFrenchDayAbbreviation(day);
        // Texte noir pour les jours
        doc.setTextColor(0, 0, 0); 
        doc.text(dayLabel, currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
        currentX += dayColWidth;
      });
      
      currentY += 8;
      
      // Données
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      this.horizontalTableData.forEach((item, index) => {
        // Nouvelle page si nécessaire
        if (currentY > pageHeight - 20) {
          doc.addPage('portrait');
          currentY = margin;
          
          // Répéter l'en-tête sur nouvelle page
          currentX = margin;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setFillColor(255, 255, 255);
          doc.setTextColor(0, 0, 0);
          
          // Cellule REF
          doc.rect(currentX, currentY, refColWidth, 8);
          doc.text('REF', currentX + refColWidth / 2, currentY + 5, { align: 'center' });
          currentX += refColWidth;
          
          doc.rect(currentX, currentY, cdmColWidth, 8);
          doc.text('C/DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
          currentX += cdmColWidth;
          
          this.daysWithData.forEach(day => {
            doc.rect(currentX, currentY, dayColWidth, 8);
            const dayLabel = this.getFrenchDayAbbreviation(day);
            // Texte noir pour les jours
            doc.setTextColor(0, 0, 0);
            doc.text(dayLabel, currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
            currentX += dayColWidth;
          });
          
          currentY += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
        }
        
        // Ligne C
        currentX = margin;
        
        // Cellule REF (fusionnée pour C et DM)
        doc.rect(currentX, currentY, refColWidth, 16);
        doc.setTextColor(0, 0, 0);
        // Couper la référence si trop longue
        const refText = item.reference.length > 15 ? item.reference.substring(0, 15) + '...' : item.reference;
        doc.text(refText, currentX + 2, currentY + 10);
        currentX += refColWidth;
        
        // Cellule C
        doc.rect(currentX, currentY, cdmColWidth, 8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 100, 0); // Orange pour C
        doc.text('C', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
        currentX += cdmColWidth;
        
        // Valeurs C pour chaque jour
        this.daysWithData.forEach(day => {
          doc.rect(currentX, currentY, dayColWidth, 8);
          const value = item[day]?.quantiteSource || 0;
          if (value > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0); // Noir pour les valeurs
            doc.text(value.toString(), currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
          }
          doc.setFont('helvetica', 'normal');
          currentX += dayColWidth;
        });
        
        currentY += 8;
        
        // Ligne DM
        currentX = margin + refColWidth;
        
        // Cellule DM
        doc.rect(currentX, currentY, cdmColWidth, 8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 100, 0); // Vert pour DM
        doc.text('DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
        currentX += cdmColWidth;
        
        // Valeurs DM pour chaque jour
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        this.daysWithData.forEach(day => {
          doc.rect(currentX, currentY, dayColWidth, 8);
          const dmValue = item[day]?.decMagasin || 0;
          if (dmValue > 0) {
            doc.text(dmValue.toString(), currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
          }
          currentX += dayColWidth;
        });
        
        currentY += 8;
        
        // Ligne séparatrice entre les références
        if (index < this.horizontalTableData.length - 1) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.line(margin, currentY, pageWidth - margin, currentY);
          currentY += 2;
        }
      });
      
      // Ajouter le numéro de page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} / ${pageCount}`, 
                pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
      
      // Télécharger
      const fileName = `Magasin-${this.selectedLigne}-${this.selectedSemaine}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }
  
  // Fonction pour obtenir l'abréviation française des jours
  private getFrenchDayAbbreviation(day: string): string {
    const abbreviations: { [key: string]: string } = {
      'lundi': 'Lun',
      'mardi': 'Mar',
      'mercredi': 'Mer',
      'jeudi': 'Jeu',
      'vendredi': 'Ven',
      'samedi': 'Sam'
    };
    return abbreviations[day.toLowerCase()] || day.substring(0, 3);
  }
  
  getWeeksList(): string[] {
    const weeks = [];
    for (let i = 1; i <= 52; i++) {
      weeks.push(`semaine${i}`);
    }
    return weeks;
  }
}