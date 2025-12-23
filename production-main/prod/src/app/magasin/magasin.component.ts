import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SemaineService, Semaine } from '../prod/semaine.service';
import { MagasinService, PlanificationMagasin, GetPlanificationRequest } from './magasin.service';
import { jsPDF } from 'jspdf';

interface LigneData {
  ligne: string;
  horizontalTableData: any[];
  daysWithData: string[];
  totals?: any;
}

@Component({
  selector: 'app-magasin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './magasin.component.html',
  styleUrls: ['./magasin.component.css']
})
export class MagasinComponent implements OnInit {
  semaines: Semaine[] = [];
  selectedSemaine: string = '';
  
  // Structure pour stocker les données groupées par ligne
  lignesData: Map<string, LigneData> = new Map();
  isLoading: boolean = false;
  errorMessage: string = '';
  
  weekDays: string[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  
  constructor(
    private semaineService: SemaineService,
    private magasinService: MagasinService
  ) {}
  
  ngOnInit(): void {
    this.loadSemaines();
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
    this.lignesData.clear();
  }
  
  loadMagasinData(): void {
    if (!this.selectedSemaine) {
      this.errorMessage = 'Veuillez sélectionner une semaine';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.lignesData.clear();
    
    const request: GetPlanificationRequest = {
      ligne: '', // On n'envoie plus de ligne spécifique
      semaine: this.selectedSemaine
    };
    
    this.magasinService.getPlanificationsMagasin(request).subscribe({
      next: (response) => {
        // Le backend retourne response.details avec toutes les planifications
        if (response.details && response.details.length > 0) {
          // Grouper les planifications par ligne
          const lignesMap = new Map<string, PlanificationMagasin[]>();
          
          response.details.forEach((planif: PlanificationMagasin) => {
            if (!lignesMap.has(planif.ligne)) {
              lignesMap.set(planif.ligne, []);
            }
            lignesMap.get(planif.ligne)!.push(planif);
          });
          
          // Organiser les données pour chaque ligne
          lignesMap.forEach((planifications, ligneName) => {
            const ligneData = this.organizeDataForLigne(ligneName, planifications);
            this.lignesData.set(ligneName, ligneData);
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur chargement données magasin:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des données';
        this.isLoading = false;
        this.lignesData.clear();
      }
    });
  }
  
  organizeDataForLigne(ligneName: string, planifications: PlanificationMagasin[]): LigneData {
    const horizontalTableData: any[] = [];
    const daysWithData: string[] = [];
    const refMap = new Map<string, any>();
    const daysSet = new Set<string>();
    
    // Traiter les planifications de la ligne
    planifications.forEach((item: PlanificationMagasin) => {
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
    
    const sortedData = Array.from(refMap.values()).sort((a, b) => 
      a.reference.localeCompare(b.reference)
    );
    
    const filteredDays = this.weekDays.filter(day => daysSet.has(day));
    
    return {
      ligne: ligneName,
      horizontalTableData: sortedData,
      daysWithData: filteredDays
    };
  }
  
  // Obtenir toutes les lignes sous forme de tableau pour l'affichage
  get allLignesArray(): LigneData[] {
    return Array.from(this.lignesData.values()).sort((a, b) => 
      a.ligne.localeCompare(b.ligne)
    );
  }
  
  downloadPDF(): void {
    if (this.lignesData.size === 0) {
      this.errorMessage = 'Aucune donnée à exporter en PDF';
      return;
    }
    
    this.generateMultiLignesPDF();
  }
  
  private generateMultiLignesPDF(): void {
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      
      let isFirstPage = true;
      
      // Trier les lignes par ordre alphabétique
      const sortedLignes = Array.from(this.lignesData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      sortedLignes.forEach(([ligneName, ligneData]) => {
        // Ajouter une nouvelle page pour chaque ligne (sauf la première)
        if (!isFirstPage) {
          doc.addPage('portrait');
        }
        isFirstPage = false;
        
        // Générer le contenu pour cette ligne
        this.generatePageForLigne(doc, ligneName, ligneData, pageWidth, pageHeight, margin);
      });
      
      // Ajouter les numéros de page
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
      const fileName = `Magasin-ToutesLignes-${this.selectedSemaine}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }
  
  private generatePageForLigne(
    doc: any, 
    ligneName: string, 
    ligneData: LigneData, 
    pageWidth: number, 
    pageHeight: number, 
    margin: number
  ): void {
    // Titre principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DÉCLARATION MAGASIN', pageWidth / 2, 15, { align: 'center' });
    
    // Informations de la ligne et semaine
    doc.setFontSize(12);
    doc.text(`Ligne: ${ligneName}`, margin, 25);
    doc.text(`Semaine: ${this.selectedSemaine}`, pageWidth - margin, 25, { align: 'right' });
    
    // Séparateur
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);
    
    const horizontalTableData = ligneData.horizontalTableData || [];
    const daysWithData = ligneData.daysWithData || [];
    
    if (daysWithData.length === 0 || horizontalTableData.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text('Aucune donnée disponible pour cette ligne', pageWidth / 2, pageHeight / 2, { align: 'center' });
      return;
    }
    
    // Calcul dynamique des largeurs
    const refColWidth = 45;
    const cdmColWidth = 15;
    const availableWidth = pageWidth - (2 * margin) - refColWidth - cdmColWidth;
    const dayColWidth = availableWidth / daysWithData.length;
    
    let currentY = 35;
    
    // En-tête du tableau
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
    
    // Cellules des jours
    daysWithData.forEach((day: string) => {
      doc.rect(currentX, currentY, dayColWidth, 8);
      const dayLabel = this.getFrenchDayAbbreviation(day);
      doc.setTextColor(0, 0, 0); 
      doc.text(dayLabel, currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
      currentX += dayColWidth;
    });
    
    currentY += 8;
    
    // Données
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    horizontalTableData.forEach((item: any, index: number) => {
      // Nouvelle page si nécessaire
      if (currentY > pageHeight - 30) {
        doc.addPage('portrait');
        currentY = margin;
        
        // Répéter l'en-tête
        currentX = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
        
        doc.rect(currentX, currentY, refColWidth, 8);
        doc.text('REF', currentX + refColWidth / 2, currentY + 5, { align: 'center' });
        currentX += refColWidth;
        
        doc.rect(currentX, currentY, cdmColWidth, 8);
        doc.text('C/DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
        currentX += cdmColWidth;
        
        daysWithData.forEach((day: string) => {
          doc.rect(currentX, currentY, dayColWidth, 8);
          const dayLabel = this.getFrenchDayAbbreviation(day);
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
      const refText = item.reference.length > 15 ? item.reference.substring(0, 15) + '...' : item.reference;
      doc.text(refText, currentX + 2, currentY + 10);
      currentX += refColWidth;
      
      // Cellule C
      doc.rect(currentX, currentY, cdmColWidth, 8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 100, 0);
      doc.text('C', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
      currentX += cdmColWidth;
      
      // Valeurs C pour chaque jour
      daysWithData.forEach((day: string) => {
        doc.rect(currentX, currentY, dayColWidth, 8);
        const value = item[day]?.quantiteSource || 0;
        if (value > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
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
      doc.setTextColor(0, 100, 0);
      doc.text('DM', currentX + cdmColWidth / 2, currentY + 5, { align: 'center' });
      currentX += cdmColWidth;
      
      // Valeurs DM pour chaque jour
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      daysWithData.forEach((day: string) => {
        doc.rect(currentX, currentY, dayColWidth, 8);
        const dmValue = item[day]?.decMagasin || 0;
        if (dmValue > 0) {
          doc.text(dmValue.toString(), currentX + dayColWidth / 2, currentY + 5, { align: 'center' });
        }
        currentX += dayColWidth;
      });
      
      currentY += 8;
      
      // Ligne séparatrice entre les références
      if (index < horizontalTableData.length - 1) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 2;
      }
    });
  }
  
  // Rendre la méthode publique pour l'utiliser dans le template
  getFrenchDayAbbreviation(day: string): string {
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