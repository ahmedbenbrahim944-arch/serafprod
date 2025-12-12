// prod2.component.ts - VERSION COMPLÈTE
import { Component, signal, computed, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SemaineService,WeekInfo } from '../prod/semaine.service';
import { ProductService , ProductLine } from '../prod/product.service';
import { NonConfService } from './non-conf.service';
import { SaisieRapportService } from './saisie-rapport.service';
import { OuvrierService } from '../prod/ouvrier.service';
import { PhaseService } from '../prod/phase.service';
import { MatierePremierService } from '../prod2/matiere-premier.service';
import { AuthService } from '../login/auth.service';


// Interfaces
interface ProductionLine {
  ligne: string;
  referenceCount: number;
  imageUrl: string;
  references: string[];
  isActive: boolean;
}

interface MatierePremiere {
  reference: string;
  quantite: number;
}

interface Causes5M {
  m1MatierePremiere: number;
  m1References: MatierePremiere[];
  m2Absence: number;
  m2Rendement: number;
  m4Maintenance: number;
  m5Qualite: number;
}

interface DayEntry {
  of: string;
  nbOperateurs: number;
  c: number;        // qtePlanifiee
  m: number;        // qteModifiee
  dp: number;       // decProduction
  dm: number;       // decMagasin
  delta: number;    // pcsProd
  causes?: Causes5M;
}

interface ReferenceProduction {
  reference: string;
  ligne?: string;
  [key: string]: string | DayEntry | undefined;
  lundi?: DayEntry;
  mardi?: DayEntry;
  mercredi?: DayEntry;
  jeudi?: DayEntry;
  vendredi?: DayEntry;
  samedi?: DayEntry;
}

interface WeekPlanification {
  weekNumber: number;
  ligne: string;
  startDate: Date;
  endDate: Date;
  references: ReferenceProduction[];
}

interface ReferenceDetail {
  reference: string;
  [key: string]: string | DayDetail | undefined;
  lundi?: DayDetail;
  mardi?: DayDetail;
  mercredi?: DayDetail;
  jeudi?: DayDetail;
  vendredi?: DayDetail;
  samedi?: DayDetail;
}

interface DayDetail {
  qPro: number;
  nbBac: number;
  tPiece: number;
  tProdH: number;
  tProdMin: number;
}

interface Operator {
  matricule: string; // Format: "1001" ou "EMP001"
  nom: string;
  prenom: string;
  selected?: boolean;
  nomPrenom?: string; // Optionnel: nom complet
}

interface WorkPhase {
  phase: string;
  heures: number;
  ligne?: string;
}

interface ProductionRecord {
  id: string;
  matricule: string;
  nomPrenom: string;
  date: string;
  ligne1: string;
  phasesLigne1: WorkPhase[];
  ligne2: string;
  phasesLigne2: WorkPhase[];
  totalHeures: number;
}

interface OperatorFormData {
  matricule: string;
  nomPrenom: string;
  ligne1: string;
  phases: string[]; // Tableau de 3 phases max
  heuresPhases: number[]; // Tableau des heures par phase
  totalHeures: number;
}

interface PhaseHeure {
  phase: string;
  heures: number;
}

@Component({
  selector: 'app-prod2',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './prod2.component.html',
  styleUrls: ['./prod2.component.css']
})
export class Prod2Component implements AfterViewInit, OnInit {
  @ViewChild('scrollWrapper') scrollWrapper!: ElementRef;
  @ViewChild('tableContainer') tableContainer!: ElementRef;

  // Signals
  sidebarVisible = signal(true);
  loading = signal(false);
  selectedLigne = signal<ProductionLine | null>(null);
  selectedWeek = signal<number | null>(null);
  availableLines = signal<ProductionLine[]>([]);
  weekPlanification = signal<WeekPlanification | null>(null);
  showSuccess = signal(false);
  successMessage = signal('');
  particles = signal<any[]>([]);
  isEditing = signal(false);
  searchLineQuery = signal('');
  searchReferenceQuery = signal('');
  selectedReferenceDetails = signal<ReferenceDetail | null>(null);
  currentMPReference = signal<string>('');
  currentMPQuantite = signal<number>(0);
  availableWeeksSignal = signal<WeekInfo[]>([]);

  // Modal des causes
  showCausesModal = signal(false);
  selectedEntryForCauses = signal<{
    reference: ReferenceProduction;
    day: string;
    entry: DayEntry;
  } | null>(null);
  
  currentCauses = signal<Causes5M>({
    m1MatierePremiere: 0,
    m1References: [],
    m2Absence: 0,
    m2Rendement: 0,
    m4Maintenance: 0,
    m5Qualite: 0
  });

  // Modal des références MP
  matieresPremieres = signal<any[]>([]);
filteredMPRefs = signal<string[]>([]);
searchMPQuery = signal('');
showMPSuggestions = signal(false);

  // Modal de production
  showProductionForm = signal(false);
  selectedDayForProduction = signal<string>('');
  productionRecords = signal<ProductionRecord[]>([]);
  currentDate = signal<string>('');
  searchRecordQuery = signal('');

  // Opérateurs
  operators = signal<Operator[]>([]);
  operatorsFormData = signal<Map<string, OperatorFormData>>(new Map());
  availablePhases = signal<string[]>([]);
  selectedMatricules = signal<string[]>([]);
  filteredOperatorsForSelection = signal<Operator[]>([]);

  // Panneaux
  showRecordsPanel = signal<boolean>(false);
  showRecordsDetails = signal<boolean>(false);
  selectedRecordForDetails = signal<ProductionRecord | null>(null);

  // Gestion du scroll
  isScrollable = signal(false);
  isScrolled = signal(false);
  isScrolledEnd = signal(false);
  showScrollIndicator = signal(true);

  private isTouchScrolling = false;
  private touchStartX = 0;
  private scrollLeftStart = 0;

  // Données
  weekDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  constructor(
    private router: Router,
    private semaineService: SemaineService,
    private productService: ProductService,
    private nonConfService: NonConfService,
    private saisieRapportService: SaisieRapportService,
    private ouvrierService: OuvrierService, // AJOUTER
    private phaseService: PhaseService ,
     private authService: AuthService,
    private matierePremierService: MatierePremierService   
  ) {
    this.generateParticles();
  }

  ngOnInit(): void {
    this.loadProductionLines();
    this.loadAvailableOperators();
    this.loadExistingProductionRecords();
  }

  // ==================== INITIALISATION ====================

  private generateParticles(): void {
    const particles = Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 6 + 2}px`,
      animationDelay: `${Math.random() * 10}s`,
      opacity: `${Math.random() * 0.3 + 0.1}`
    }));
    this.particles.set(particles);
  }
  private getImageUrl(productLine: ProductLine): string {
  if (productLine.imageUrl) {
    return this.productService.getImageUrl(productLine.imageUrl);
  }
  return this.getDefaultImageUrl(productLine.ligne);
}
handleImageError(event: Event, line: ProductionLine): void {
  const img = event.target as HTMLImageElement;
  img.src = this.getDefaultImageUrl(line.ligne);
}

  private loadProductionLines(): void {
  this.loading.set(true);
  
  this.productService.getAllLines().subscribe({
    next: (response) => {
      if (response && response.lines && Array.isArray(response.lines)) {
        const lines: ProductionLine[] = response.lines.map((productLine: ProductLine) => {
          return {
            ligne: productLine.ligne,
            referenceCount: productLine.referenceCount || productLine.references?.length || 0,
            imageUrl: this.getImageUrl(productLine), // ðŸ"´ CHANGEMENT ICI
            references: productLine.references || [],
            isActive: true
          };
        });
        
        this.availableLines.set(lines);
      } else {
        this.loadMockProductionLines();
      }
      this.loading.set(false);
    },
    error: (error) => {
      console.error('Erreur chargement lignes:', error);
      this.loadMockProductionLines();
      this.loading.set(false);
    }
  });
}
  // Méthode pour charger les matières premières par ligne
private loadMatieresPremieres(ligne: string): void {
  this.loading.set(true);
  
  this.matierePremierService.findByLigne(ligne).subscribe({
    next: (response: any) => {
      console.log('Matieres premières chargées pour', ligne, ':', response);
      
      let mpList: string[] = [];
      
      if (Array.isArray(response)) {
        mpList = response.map((mp: any) => {
          if (typeof mp === 'string') {
            return mp;
          } else if (mp.refMatierePremier) {
            return mp.refMatierePremier;
          } else if (mp.reference) {
            return mp.reference;
          }
          return '';
        }).filter((ref: string) => ref !== '');
      } else if (response && Array.isArray(response.data)) {
        mpList = response.data.map((mp: any) => mp.refMatierePremier || mp.reference).filter(Boolean);
      }
      
      console.log('Références MP extraites:', mpList);
      
      if (mpList.length === 0) {
        // Références par défaut
        const defaultMPRefs: { [key: string]: string[] } = {
          'L04:RXT1': ['8', '16', '60', '75', '110', '136', '212', '264', '344', '360', '377', '404'],
          'L07:COM A1': ['COM001', 'COM002', 'COM003', 'COM004'],
          'L09:COMXT2': ['COM101', 'COM102', 'COM103'],
          'L10:RS3': ['RS001', 'RS002', 'RS003'],
          'L14:CD XT1': ['CD001', 'CD002', 'CD003'],
          'L15:MTSA3': ['MT001', 'MT002', 'MT003'],
          'L42:RA1': ['RA001', 'RA002', 'RA003']
        };
        
        mpList = defaultMPRefs[ligne] || [
          '8', '16', '60', '75', '110', '136', '212', '264', '344', '360', '377', '404'
        ];
      }
      
      this.matieresPremieres.set(mpList);
      this.filteredMPRefs.set(mpList);
      this.loading.set(false);
    },
    
      
     
    
  });
}

// Méthode pour filtrer les références MP
filterMPRefs(query: string): void {
  this.searchMPQuery.set(query);
  
  const allRefs = this.matieresPremieres();
  if (!query.trim()) {
    this.filteredMPRefs.set(allRefs);
    this.showMPSuggestions.set(false);
    return;
  }
  
  const filtered = allRefs.filter(ref => 
    ref.toLowerCase().includes(query.toLowerCase())
  );
  
  this.filteredMPRefs.set(filtered);
  this.showMPSuggestions.set(filtered.length > 0);
}

// Méthode pour gérer la recherche MP
onSearchMPChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  // Mettre à jour la référence sélectionnée
  this.currentMPReference.set(value);
  
  // Filtrer les suggestions
  this.filterMPRefs(value);
}

// Méthode pour sélectionner une référence MP depuis les suggestions
selectMPReference(ref: string): void {
  this.currentMPReference.set(ref);
  this.searchMPQuery.set('');
  this.showMPSuggestions.set(false);
  this.filteredMPRefs.set(this.matieresPremieres());
  
  // Focus sur le champ quantité après sélection
  setTimeout(() => {
    const quantiteInput = document.querySelector('.mp-quantite-input') as HTMLInputElement;
    if (quantiteInput) {
      quantiteInput.focus();
      quantiteInput.select();
    }
  }, 100);
}

// Méthode pour fermer les suggestions
closeMPSuggestions(): void {
  setTimeout(() => {
    this.showMPSuggestions.set(false);
  }, 200);
}

  private loadMockProductionLines(): void {
    const lines: ProductionLine[] = [
      {
        ligne: 'L04:RXT1',
        referenceCount: 13,
        imageUrl: 'assets/images/unnamed.jpg',
        references: ['RA5246801', 'RA5246802', 'RA5246803'],
        isActive: true
      },
      {
        ligne: 'L07:COM A1',
        referenceCount: 4,
        imageUrl: 'assets/images/unnamed (1).jpg',
        references: ['COM001', 'COM002', 'COM003', 'COM004'],
        isActive: true
      }
    ];
    this.availableLines.set(lines);
  }

  private getDefaultImageUrl(ligne: string): string {
    const imageMap: { [key: string]: string } = {
      'L04:RXT1': 'assets/images/unnamed.jpg',
      'L07:COM A1': 'assets/images/unnamed (1).jpg',
      'L09:COMXT2': 'assets/images/unnamed (2).jpg',
      'L10:RS3': 'assets/images/unnamed (3).jpg',
      'L14:CD XT1': 'assets/images/unnamed (4).jpg',
      'L15:MTSA3': 'assets/images/unnamed (5).jpg'
    };
    return imageMap[ligne] || 'assets/images/default-line.jpg';
  }

  private loadAvailableOperators(): void {
  this.loading.set(true);
  
  this.ouvrierService.findAll().subscribe({
    next: (ouvriers: any) => {
      console.log('Ouvriers chargés depuis API:', ouvriers);
      
      // Transformer les données d'ouvrier en format Operator
      const operators: Operator[] = ouvriers.map((ouvrier: any) => {
        // Extraire nom et prénom du champ nomPrenom
        let nom = '';
        let prenom = '';
        
        if (ouvrier.nomPrenom) {
          const parts = ouvrier.nomPrenom.split(' ');
          if (parts.length >= 2) {
            nom = parts[0]; // Premier mot = nom
            prenom = parts.slice(1).join(' '); // Reste = prénom
          } else {
            nom = ouvrier.nomPrenom;
          }
        }
        
        return {
          matricule: ouvrier.matricule.toString(),
          nom: nom,
          prenom: prenom,
          selected: false
        };
      });
      
      this.operators.set(operators);
      this.updateFilteredOperators();
      this.loading.set(false);
    },
    
  });
}

  private loadExistingProductionRecords(): void {
    // Charger les rapports existants depuis l'API
    // Pour l'instant, on charge des données mockées
    const sampleRecords: ProductionRecord[] = [
      {
        id: '1',
        matricule: 'EMP001',
        nomPrenom: 'DUPONT Jean',
        date: new Date().toLocaleDateString('fr-FR'),
        ligne1: 'L04:RXT1',
        phasesLigne1: [{ phase: '4101', heures: 4, ligne: 'L04:RXT1' }],
        ligne2: '',
        phasesLigne2: [],
        totalHeures: 4
      }
    ];
    this.productionRecords.set(sampleRecords);
  }

  // ==================== FILTRES ====================

  filteredLines = computed(() => {
    const query = this.searchLineQuery().toLowerCase();
    if (!query) return this.availableLines();
    return this.availableLines().filter(line => 
      line.ligne.toLowerCase().includes(query)
    );
  });

  filteredWeekPlanification = computed(() => {
    const planif = this.weekPlanification();
    const query = this.searchReferenceQuery().toLowerCase();
    if (!planif || !query) return planif;
    
    return {
      ...planif,
      references: planif.references.filter(ref => 
        ref.reference.toLowerCase().includes(query)
      )
    };
  });

  filteredProductionRecords = computed(() => {
    const records = this.productionRecords();
    const query = this.searchRecordQuery().toLowerCase();
    const currentDate = this.currentDate();
    
    if (!query) {
      return records.filter(record => record.date === currentDate);
    }
    
    return records.filter(record => 
      record.date === currentDate && 
      (record.matricule.toLowerCase().includes(query) ||
       record.nomPrenom.toLowerCase().includes(query) ||
       record.ligne1.toLowerCase().includes(query))
    );
  });

  // ==================== SEMAINES ====================

  private loadAvailableWeeks(): void {
    this.loading.set(true);
    
    this.semaineService.getSemainesPublic().subscribe({
      next: (response: any) => {
        let semainesArray: any[] = [];
        
        if (response && response.semaines && Array.isArray(response.semaines)) {
          semainesArray = response.semaines;
        } else if (Array.isArray(response)) {
          semainesArray = response;
        }
        
        const weeks: WeekInfo[] = [];
        
        semainesArray.forEach((semaine: any) => {
          let weekNumber = 0;
          if (semaine.nom && typeof semaine.nom === 'string') {
            const match = semaine.nom.match(/semaine(\d+)/i);
            if (match && match[1]) {
              weekNumber = parseInt(match[1], 10);
            }
          }
          
          if (weekNumber > 0) {
            weeks.push({
              number: weekNumber,
              startDate: semaine.dateDebut ? new Date(semaine.dateDebut) : new Date(),
              endDate: semaine.dateFin ? new Date(semaine.dateFin) : new Date(),
              display: semaine.nom || `semaine${weekNumber}`,
              data: semaine
            });
          }
        });
        
        weeks.sort((a, b) => b.number - a.number);
        this.availableWeeksSignal.set(weeks);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement semaines:', error);
        this.availableWeeksSignal.set([]);
        this.loading.set(false);
      }
    });
  }

  getAvailableWeeks(): WeekInfo[] {
    return this.availableWeeksSignal();
  }

  // ==================== SÉLECTION LIGNE/SEMAINE ====================

  toggleSidebar(): void {
    this.sidebarVisible.set(!this.sidebarVisible());
  }

 onLigneSelected(line: ProductionLine): void {
  console.log('Line selected:', line.ligne);
  
  // Réinitialiser les phases et données avant de charger la nouvelle ligne
  
  this.selectedLigne.set(line);
  this.selectedWeek.set(null);
  this.weekPlanification.set(null);
  this.isEditing.set(false);
  this.selectedReferenceDetails.set(null);
  
  // Charger les phases IMMÉDIATEMENT quand une ligne est sélectionnée
  this.loadAvailablePhases(line.ligne);
  
  // Charger les semaines disponibles
  this.loadAvailableWeeks();
}
  onWeekSelected(weekNumber: number): void {
    const line = this.selectedLigne();
    if (line && weekNumber) {
      this.selectedWeek.set(weekNumber);
      const selectedWeekData = this.getAvailableWeeks().find(w => w.number === weekNumber);
      const semaineNom = selectedWeekData?.display || `semaine${weekNumber}`;
      this.loadWeekPlanificationFromAPI(semaineNom, line);
      this.isEditing.set(false);
      this.selectedReferenceDetails.set(null);
    }
  }

  backToLines(): void {
    this.selectedLigne.set(null);
    this.selectedWeek.set(null);
    this.weekPlanification.set(null);
    this.isEditing.set(false);
    this.selectedReferenceDetails.set(null);
  }

  goBackToLogin(): void {
    this.router.navigate(['/login']);
  }

  // ==================== CHARGEMENT PLANIFICATION ====================

  private loadWeekPlanificationFromAPI(semaineNom: string, line: ProductionLine): void {
    this.loading.set(true);
    
    this.semaineService.getPlanificationsForWeek(semaineNom).subscribe({
      next: (response) => {
        const planificationsLigne = response.planifications?.filter(
          (p: any) => p.ligne === line.ligne
        ) || [];
        
        const references: ReferenceProduction[] = [];
        const refsMap = new Map<string, ReferenceProduction>();
        
        line.references.forEach(reference => {
          refsMap.set(reference, {
            reference: reference,
            ligne: line.ligne
          });
        });
        
        const ofByReference = new Map<string, string>();
        planificationsLigne.forEach((plan: any) => {
          if (plan.of && !ofByReference.has(plan.reference)) {
            ofByReference.set(plan.reference, plan.of);
          }
        });
        
        planificationsLigne.forEach((plan: any) => {
          const refKey = plan.reference;
          if (refsMap.has(refKey)) {
            const refObj = refsMap.get(refKey)!;
            const jour = plan.jour.toLowerCase();
            const ofForThisRef = ofByReference.get(refKey) || '';
            
            refObj[jour] = {
              of: ofForThisRef,
              nbOperateurs: plan.nbOperateurs || 0,
              c: plan.qtePlanifiee || 0,
              m: plan.qteModifiee || 0,
              dp: plan.decProduction || 0,
              dm: plan.decMagasin || 0,
              delta: plan.pcsProd || 0
            };
          }
        });
        
        refsMap.forEach((refObj) => {
          const ofForThisRef = ofByReference.get(refObj.reference) || '';
          this.weekDays.forEach(day => {
            if (!refObj[day]) {
              refObj[day] = {
                of: ofForThisRef,
                nbOperateurs: 0,
                c: 0,
                m: 0,
                dp: 0,
                dm: 0,
                delta: 0
              };
            }
          });
          references.push(refObj);
        });
        
        const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);
        
        this.weekPlanification.set({
          weekNumber: this.selectedWeek() || 0,
          ligne: line.ligne,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          references
        });
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement planifications:', error);
        this.createEmptyPlanifications(line);
        this.loading.set(false);
      }
    });
  }

  private getWeekDates(year: number, weekNumber: number): WeekInfo {
    return this.semaineService.getWeekDates(year, weekNumber);
  }

  private createEmptyPlanifications(line: ProductionLine): void {
    const references = line.references.map((reference) => {
      const refData: ReferenceProduction = { reference, ligne: line.ligne };
      this.weekDays.forEach(day => {
        refData[day] = {
          of: '',
          nbOperateurs: 0,
          c: 0,
          m: 0,
          dp: 0,
          dm: 0,
          delta: 0
        };
      });
      return refData;
    });
    
    const weekInfo = this.getWeekDates(new Date().getFullYear(), this.selectedWeek() || 1);
    
    this.weekPlanification.set({
      weekNumber: this.selectedWeek() || 0,
      ligne: line.ligne,
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
      references
    });
  }

  // ==================== MODIFICATION PLANIFICATION ====================

  toggleEditMode(): void {
    const currentEditingState = this.isEditing();
    if (!currentEditingState) {
      console.log('Mode édition activé');
    } else {
      this.savePlanificationsToAPI();
    }
    this.isEditing.set(!currentEditingState);
  }

  updateDayEntry(reference: ReferenceProduction, day: string, field: string, value: any): void {
    if (this.weekPlanification()) {
      const updatedPlanif = { ...this.weekPlanification()! };
      const refIndex = updatedPlanif.references.findIndex(r => r.reference === reference.reference);
      
      if (refIndex !== -1) {
        const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
        if (dayEntry) {
          if (field === 'of') {
            dayEntry.of = value;
            this.weekDays.forEach(otherDay => {
              const otherDayEntry = updatedPlanif.references[refIndex][otherDay] as DayEntry;
              if (otherDayEntry) {
                otherDayEntry.of = value;
              }
            });
          } else {
            (dayEntry as any)[field] = +value;
          }
          
          if (field === 'c' || field === 'm' || field === 'dp') {
            const quantiteSource = dayEntry.m > 0 ? dayEntry.m : dayEntry.c;
            dayEntry.delta = quantiteSource > 0 ? 
              Math.round((dayEntry.dp / quantiteSource) * 100) : 0;
          }
        }
        this.weekPlanification.set(updatedPlanif);
      }
    }
  }

  private savePlanificationsToAPI(): void {
    if (!this.semaineService.isAuthenticated()) {
      this.showSuccessMessage('Vous devez être connecté pour sauvegarder');
      return;
    }

    const planif = this.weekPlanification();
    if (!planif) {
      this.showSuccessMessage('Aucune planification à sauvegarder');
      return;
    }

    const semaineNom = `semaine${planif.weekNumber}`;
    const ligne = planif.ligne;
    
    const planificationsToSave: any[] = [];
    
    planif.references.forEach((ref) => {
      this.weekDays.forEach(day => {
        const entry = ref[day] as DayEntry;
        if (entry) {
          const planificationData = this.semaineService.formatWeekForAPI({
            semaine: semaineNom,
            jour: day,
            ligne: ligne,
            reference: ref.reference,
            nbOperateurs: entry.nbOperateurs,
            of: entry.of,
            qtePlanifiee: entry.c,
            qteModifiee: entry.m,
            decProduction: entry.dp,
            decMagasin: entry.dm
          });
          
          planificationsToSave.push(planificationData);
        }
      });
    });
    
    if (planificationsToSave.length === 0) {
      this.showSuccessMessage('Aucune donnée à sauvegarder');
      return;
    }
    
    this.showSuccessMessage(`Sauvegarde de ${planificationsToSave.length} modifications...`);
    
    const savePromises = planificationsToSave.map((planData) => {
      return new Promise<void>((resolve, reject) => {
        this.semaineService.updateProductionPlanification(planData).subscribe({
          next: () => resolve(),
          error: (error) => reject(error)
        });
      });
    });
    
    Promise.all(savePromises.map(p => p.catch(e => e)))
      .then(results => {
        const successful = results.filter(r => !(r instanceof Error)).length;
        this.showSuccessMessage(`${successful} modifications enregistrées`);
      })
      .catch(() => {
        this.showSuccessMessage('Erreur lors de la sauvegarde');
      });
  }

  // ==================== RAPPORTS DE PRODUCTION ====================

  onPersonIconClick(day: string): void {
  console.log('Opening production form for day:', day);
  
  const currentLine = this.selectedLigne();
  if (!currentLine) {
    alert('Veuillez sélectionner une ligne d\'abord');
    return;
  }
  
  // Vérifier que les phases sont chargées
  if (this.availablePhases().length === 0) {
    console.log('Phases non chargées, chargement en cours...');
    this.loadAvailablePhases(currentLine.ligne);
    
    // Attendre un peu pour le chargement
    setTimeout(() => {
      this.openProductionForm(day);
    }, 500);
  } else {
    this.openProductionForm(day);
  }
}
// Remplacez la méthode openProductionForm par cette version
private openProductionForm(day: string): void {
  console.log(`Ouverture formulaire production pour: ${day}`);
  
  const currentLine = this.selectedLigne();
  if (!currentLine) {
    alert('Veuillez sélectionner une ligne d\'abord');
    return;
  }

  // Calculer et afficher la date CORRECTE
  const correctDate = this.getCorrectDateForDay(day);
  console.log(`Date calculée: ${correctDate}`);
  this.currentDate.set(correctDate);
  
  this.selectedDayForProduction.set(day);
  this.showProductionForm.set(true);
  this.showRecordsPanel.set(false);
  
  this.selectedMatricules.set([]);
  this.searchRecordQuery.set('');
  this.updateFilteredOperators();
  this.loadExistingRapportsForDay(day);
  
  // Charger les phases pour la ligne
  console.log('Chargement des phases pour la ligne:', currentLine.ligne);
  this.loadAvailablePhases(currentLine.ligne);
}

// Remplacez la méthode setCorrectDate par cette version corrigée
private setCorrectDate(day: string): void {
  const planif = this.weekPlanification();
  if (!planif) {
    this.setDefaultDate(day);
    return;
  }

  const dayIndex = this.weekDays.indexOf(day);
  if (dayIndex === -1) {
    this.setDefaultDate(day);
    return;
  }

  // Obtenir la date du lundi de cette semaine
  const weekStartDate = new Date(planif.startDate);
  
  // S'assurer que startDate est bien un lundi
  // getDay(): 0 = dimanche, 1 = lundi, 2 = mardi, etc.
  const dayOfWeek = weekStartDate.getDay();
  
  // Si startDate n'est pas un lundi, ajuster
  if (dayOfWeek !== 1) {
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    weekStartDate.setDate(weekStartDate.getDate() + daysToMonday);
  }

  // Calculer la date exacte du jour sélectionné
  const exactDate = new Date(weekStartDate);
  exactDate.setDate(weekStartDate.getDate() + dayIndex);

  const formattedDate = this.formatDate(exactDate);
  console.log(`Date calculée pour ${day}: ${formattedDate} (index: ${dayIndex})`);
  this.currentDate.set(formattedDate);
}

private formatDateToFrench(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

 private setDefaultDate(day: string): void {
  const planif = this.weekPlanification();
  if (!planif) return;

  const dayIndex = this.weekDays.indexOf(day);
  
  // S'assurer que startDate est un lundi
  const startDate = new Date(planif.startDate);
  const dayOfWeek = startDate.getDay(); // 0=dimanche, 1=lundi, 2=mardi...
  
  // Si ce n'est pas un lundi, ajuster
  if (dayOfWeek !== 1) {
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + daysToMonday);
  }
  
  // Ajouter les jours
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayIndex);
  
  const formattedDate = this.formatDate(date);
  this.currentDate.set(formattedDate);
}

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private loadExistingRapportsForDay(day: string): void {
    const planif = this.weekPlanification();
    if (!planif || !this.selectedLigne()) return;

    const semaineNom = `semaine${planif.weekNumber}`;
    
    this.saisieRapportService.getRapportsBySemaineJour(semaineNom, day).subscribe({
      next: (response) => {
        console.log('Rapports existants:', response);
        // Transformer les rapports en ProductionRecord
        const records: ProductionRecord[] = response.rapports?.map((rapport: any) => {
          const phasesLigne1: WorkPhase[] = rapport.phases?.map((phase: any) => ({
            phase: phase.phase,
            heures: phase.heures,
            ligne: rapport.ligne
          })) || [];
          
          return {
            id: rapport.id.toString(),
            matricule: rapport.matricule.toString(),
            nomPrenom: rapport.nomPrenom,
            date: this.currentDate(),
            ligne1: rapport.ligne,
            phasesLigne1: phasesLigne1,
            ligne2: '',
            phasesLigne2: [],
            totalHeures: rapport.totalHeuresJour
          };
        }) || [];
        
        this.productionRecords.set(records);
      },
      error: (error) => {
        console.error('Erreur chargement rapports:', error);
      }
    });
  }

  private loadAvailablePhases(ligne: string): void {
  console.log('Chargement des phases pour la ligne:', ligne);
  
  // Vider les phases actuelles pendant le chargement
  this.availablePhases.set([]);
  
  this.phaseService.findByLigne(ligne).subscribe({
    next: (response: any) => {
      console.log('Réponse API phases pour', ligne, ':', response);
      
      let phaseList: string[] = [];
      
      // Gérer différents formats de réponse
      if (Array.isArray(response)) {
        // Format 1: Tableau direct de phases
        phaseList = response.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          } else if (phase.nom) {
            return phase.nom;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      } else if (response && Array.isArray(response.phases)) {
        // Format 2: { phases: [...] }
        phaseList = response.phases.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      } else if (response && response.data && Array.isArray(response.data)) {
        // Format 3: { data: [...] }
        phaseList = response.data.map((phase: any) => {
          if (typeof phase === 'string') {
            return phase;
          } else if (phase.phase) {
            return phase.phase;
          }
          return '';
        }).filter((phase: string) => phase !== '');
      }
      
      console.log('Phases extraites pour', ligne, ':', phaseList);
      
      // IMPORTANT: Mettre à jour les phases disponibles
      this.availablePhases.set(phaseList);
      
      // Réinitialiser les sélections de phases pour tous les opérateurs
      if (this.operatorsFormData().size > 0) {
        const updatedFormData = new Map(this.operatorsFormData());
        updatedFormData.forEach((formData, matricule) => {
          formData.phases = ['', '', '']; // Réinitialiser les phases
          formData.heuresPhases = [0, 0, 0]; // Réinitialiser les heures
          formData.totalHeures = 0;
        });
        this.operatorsFormData.set(updatedFormData);
      }
      
      console.log('Phases disponibles mises à jour:', phaseList);
    },
    error: (error) => {
      console.error('Erreur chargement phases pour', ligne, ':', error);
      
      // Phases par défaut pour les lignes communes
      const defaultPhases: { [key: string]: string[] } = {
        'L04:RXT1': ['4101', '4102', '4103'],
        'L07:COM A1': ['5101', '5102', '5103'],
        'L09:COMXT2': ['6101', '6102', '6103'],
        'L10:RS3': ['7101', '7102', '7103'],
        'L14:CD XT1': ['8101', '8102', '8103'],
        'L15:MTSA3': ['9101', '9102', '9103'],
        'L42:RA1': ['4201', '4202', '4203']
      };
      
      const fallbackPhases = defaultPhases[ligne] || ['Phase1', 'Phase2', 'Phase3'];
      console.log('Utilisation des phases par défaut:', fallbackPhases);
      this.availablePhases.set(fallbackPhases);
    }
  });
}

  // ==================== GESTION OPÉRATEURS ====================

  updateFilteredOperators(): void {
    const query = this.searchRecordQuery().toLowerCase();
    const allOperators = this.operators();
    
    if (!query) {
      this.filteredOperatorsForSelection.set(allOperators);
      return;
    }
    
    const filtered = allOperators.filter(op => 
      op.matricule.toLowerCase().includes(query) ||
      op.nom.toLowerCase().includes(query) ||
      op.prenom.toLowerCase().includes(query)
    );
    this.filteredOperatorsForSelection.set(filtered);
  }

  toggleMatriculeSelection(matricule: string): void {
    const currentSelection = this.selectedMatricules();
    if (currentSelection.includes(matricule)) {
      this.selectedMatricules.set(currentSelection.filter(m => m !== matricule));
      const formData = this.operatorsFormData();
      formData.delete(matricule);
      this.operatorsFormData.set(new Map(formData));
    } else {
      this.selectedMatricules.set([...currentSelection, matricule]);
      this.initializeOperatorFormData(matricule);
    }
  }

  selectAllOperators(): void {
    const allMatricules = this.filteredOperatorsForSelection().map(op => op.matricule);
    this.selectedMatricules.set(allMatricules);
    allMatricules.forEach(matricule => this.initializeOperatorFormData(matricule));
  }

  deselectAllOperators(): void {
    this.selectedMatricules.set([]);
    this.operatorsFormData.set(new Map());
  }

 // Modifier la méthode initializeOperatorFormData:
initializeOperatorFormData(matricule: string): void {
  const currentLine = this.selectedLigne();
  if (!currentLine) return;

  // Trouver l'ouvrier dans la liste chargée
  const operator = this.operators().find(op => op.matricule === matricule);
  if (!operator) {
    console.error(`Ouvrier ${matricule} non trouvé`);
    return;
  }

  const currentFormData = this.operatorsFormData();
  
  if (!currentFormData.has(matricule)) {
    const newFormData = new Map(currentFormData);
    newFormData.set(matricule, {
      matricule: operator.matricule,
      nomPrenom: `${operator.nom} ${operator.prenom}`.trim(),
      ligne1: currentLine.ligne,
      phases: ['', '', ''],
      heuresPhases: [0, 0, 0],
      totalHeures: 0
    });
    this.operatorsFormData.set(newFormData);
  }
  
  // Charger les phases spécifiques à cette ligne
  this.loadAvailablePhases(currentLine.ligne);
}

  getSafeOperatorFormData(matricule: string): OperatorFormData {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) {
      return {
        matricule: matricule,
        nomPrenom: '',
        ligne1: this.selectedLigne()?.ligne || '',
        phases: ['', '', ''],
        heuresPhases: [0, 0, 0],
        totalHeures: 0
      };
    }
    return formData;
  }

  getOperatorFormData(matricule: string): OperatorFormData | undefined {
    return this.operatorsFormData().get(matricule);
  }

  updateOperatorPhaseHeures(matricule: string, phaseIndex: number, value: string): void {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) return;

    const heures = parseFloat(value) || 0;
    if (heures > 8) {
      alert('Les heures par phase ne peuvent pas dépasser 8h');
      return;
    }

    const updatedHeuresPhases = [...formData.heuresPhases];
    updatedHeuresPhases[phaseIndex] = heures;

    const totalHeures = updatedHeuresPhases.reduce((sum, heures) => sum + heures, 0);
    if (totalHeures > 8) {
      alert(`Le total des heures (${totalHeures}h) dépasse 8 heures`);
      return;
    }

    const updatedFormData: OperatorFormData = {
      ...formData,
      heuresPhases: updatedHeuresPhases,
      totalHeures: totalHeures
    };

    this.operatorsFormData().set(matricule, updatedFormData);
    this.operatorsFormData.set(new Map(this.operatorsFormData()));
  }

  getOperatorPhaseHeures(matricule: string, phaseIndex: number): number {
    const formData = this.getOperatorFormData(matricule);
    if (!formData || !formData.heuresPhases || phaseIndex >= formData.heuresPhases.length) {
      return 0;
    }
    return formData.heuresPhases[phaseIndex];
  }

  getOperatorPhaseValue(matricule: string, phaseIndex: number): string {
    const formData = this.getOperatorFormData(matricule);
    if (!formData || phaseIndex >= formData.phases.length) return '';
    return formData.phases[phaseIndex];
  }

  updateOperatorPhase(matricule: string, phaseIndex: number, value: string): void {
    const formData = this.getOperatorFormData(matricule);
    if (!formData) return;

    const updatedPhases = [...formData.phases];
    updatedPhases[phaseIndex] = value;

    const updatedFormData: OperatorFormData = {
      ...formData,
      phases: updatedPhases
    };

    this.operatorsFormData().set(matricule, updatedFormData);
    this.operatorsFormData.set(new Map(this.operatorsFormData()));
  }

  // ==================== SAUVEGARDE RAPPORTS ====================

 // Dans la méthode saveAllProductionRecords(), modifier la création du DTO:
// Modifiez la création du DTO dans saveAllProductionRecords()
saveAllProductionRecords(): void {
  const selectedMatricules = this.selectedMatricules();
  if (selectedMatricules.length === 0) {
    alert('Veuillez sélectionner au moins un opérateur');
    return;
  }

  const planif = this.weekPlanification();
  if (!planif || !this.selectedLigne() || !this.selectedDayForProduction()) {
    alert('Données manquantes');
    return;
  }

  const semaineNom = `semaine${planif.weekNumber}`;
  const jour = this.selectedDayForProduction();
  const ligne = this.selectedLigne()!.ligne;

  let savedCount = 0;
  let hasErrors = false;

  const savePromises = selectedMatricules.map(matricule => {
    return new Promise<void>((resolve, reject) => {
      const formData = this.getOperatorFormData(matricule);
      if (!formData || formData.totalHeures === 0) {
        console.log(`Aucune donnée pour ${matricule}`);
        resolve();
        return;
      }

      if (formData.totalHeures > 8) {
        alert(`Le total des heures pour ${formData.nomPrenom} ne peut pas dépasser 8 heures (${formData.totalHeures}h)`);
        hasErrors = true;
        reject(new Error(`Heures dépassées pour ${matricule}`));
        return;
      }

      const phases: PhaseHeure[] = formData.phases
        .filter((phase, index) => phase !== '' && formData.heuresPhases[index] > 0)
        .map((phase, index) => ({
          phase: phase,
          heures: formData.heuresPhases[index]
        }));

      if (phases.length === 0) {
        console.log(`Aucune phase valide pour ${matricule}`);
        resolve();
        return;
      }

      // IMPORTANT: Convertir le matricule en nombre
      let matriculeNumber: number;
      
      if (matricule.startsWith('EMP')) {
        matriculeNumber = parseInt(matricule.replace('EMP', ''), 10);
      } else {
        matriculeNumber = parseInt(matricule, 10);
      }

      if (isNaN(matriculeNumber)) {
        console.error(`Matricule invalide: ${matricule}`);
        reject(new Error(`Matricule invalide: ${matricule}`));
        return;
      }

      // CRITIQUE: Créer le DTO SANS nomPrenom
      const dto = {
        semaine: semaineNom,
        jour: jour,
        ligne: ligne,
        matricule: matriculeNumber,  // Seulement le nombre
        phases: phases               // Seulement le tableau de phases
        // NE PAS inclure nomPrenom
      };

      console.log('Envoi du rapport:', dto);

      this.saisieRapportService.createRapport(dto).subscribe({
        next: (response) => {
          console.log(`Rapport sauvegardé pour ${matricule}:`, response);
          
          // Récupérer le nomPrenom de l'ouvrier pour l'affichage local
          const ouvrier = this.operators().find(op => op.matricule === matricule);
          const nomPrenom = ouvrier ? `${ouvrier.nom} ${ouvrier.prenom}` : formData.nomPrenom;
          
          // Ajouter au tableau local
          const newRecord: ProductionRecord = {
            id: Date.now().toString() + savedCount,
            matricule: matricule,
            nomPrenom: nomPrenom,
            date: this.currentDate(),
            ligne1: ligne,
            phasesLigne1: phases.map(p => ({ 
              phase: p.phase, 
              heures: p.heures,
              ligne: ligne 
            })),
            phasesLigne2: [],
            ligne2: '',
            totalHeures: formData.totalHeures
          };
          
          this.productionRecords.update(records => [newRecord, ...records]);
          savedCount++;
          resolve();
        },
        error: (error) => {
          console.error(`Erreur sauvegarde ${matricule}:`, error);
          
          const ouvrier = this.operators().find(op => op.matricule === matricule);
          const nomPrenom = ouvrier ? `${ouvrier.nom} ${ouvrier.prenom}` : formData?.nomPrenom || matricule;
          
          let errorMessage = `Erreur sauvegarde pour ${nomPrenom}: `;
          if (error.error?.message) {
            errorMessage += error.error.message;
          } else if (error.status === 404) {
            errorMessage += 'Ouvrier non trouvé dans la base de données';
          } else if (error.status === 409) {
            errorMessage += 'Un rapport existe déjà pour cet ouvrier ce jour';
          } else if (error.status === 400) {
            // Erreur de validation DTO
            if (error.error?.message?.includes('nomPrenom')) {
              errorMessage += 'Problème de format des données';
            } else {
              errorMessage += error.error?.message || 'Données invalides';
            }
          } else {
            errorMessage += 'Erreur serveur';
          }
          
          alert(errorMessage);
          reject(error);
        }
      });
    });
  });

  Promise.all(savePromises.map(p => p.catch(e => e)))
    .then(() => {
      if (hasErrors) return;
      
      if (savedCount > 0) {
        this.showSuccessMessage(`${savedCount} rapport(s) sauvegardé(s) avec succès`);
        this.closeProductionForm();
      } else {
        alert('Aucun rapport à sauvegarder');
      }
    })
    .catch(() => {
      this.showSuccessMessage('Erreurs lors de la sauvegarde');
    });
}

  closeProductionForm(): void {
    this.showProductionForm.set(false);
    this.selectedMatricules.set([]);
    this.operatorsFormData.set(new Map());
  }

  toggleRecordsPanel(): void {
    this.showRecordsPanel.set(!this.showRecordsPanel());
  }

  showRecordDetails(record: ProductionRecord): void {
    this.selectedRecordForDetails.set(record);
    this.showRecordsDetails.set(true);
  }

  closeRecordDetails(): void {
    this.showRecordsDetails.set(false);
    this.selectedRecordForDetails.set(null);
  }

  // ==================== NON-CONFORMITÉS (CAUSES 5M) ====================

 openCausesModal(ref: ReferenceProduction, day: string): void {
  const entry = this.getDayEntry(ref, day);
  if (!entry) return;

  this.selectedEntryForCauses.set({ reference: ref, day, entry });
  
  const planif = this.weekPlanification();
  if (!planif || !this.selectedLigne()) return;

  const ligne = this.selectedLigne()!.ligne;
  
  // Réinitialiser les champs MP
  this.currentMPReference.set('');
  this.currentMPQuantite.set(0);
  this.searchMPQuery.set('');
  this.showMPSuggestions.set(false);
  
  // Charger les matières premières pour cette ligne
  this.loadMatieresPremieres(ligne);

  // Vérifier si une non-conformité existe déjà
  const dto = {
    semaine: `semaine${planif.weekNumber}`,
    jour: day,
    ligne: ligne,
    reference: ref.reference
  };

  this.nonConfService.checkNonConformiteExists(dto).subscribe({
    next: (response) => {
      if (response.exists && response.data) {
        this.currentCauses.set({
          m1MatierePremiere: response.data.details.matierePremiere || 0,
          m1References: response.data.details.referenceMatierePremiere 
            ? [{ reference: response.data.details.referenceMatierePremiere, quantite: response.data.details.matierePremiere || 0 }]
            : [],
          m2Absence: response.data.details.absence || 0,
          m2Rendement: response.data.details.rendement || 0,
          m4Maintenance: response.data.details.maintenance || 0,
          m5Qualite: response.data.details.qualite || 0
        });
      } else {
        this.currentCauses.set({
          m1MatierePremiere: 0,
          m1References: [],
          m2Absence: 0,
          m2Rendement: 0,
          m4Maintenance: 0,
          m5Qualite: 0
        });
      }
      this.showCausesModal.set(true);
    },
    error: (error) => {
      console.error('Erreur vérification non-conformité:', error);
      this.currentCauses.set({
        m1MatierePremiere: 0,
        m1References: [],
        m2Absence: 0,
        m2Rendement: 0,
        m4Maintenance: 0,
        m5Qualite: 0
      });
      this.showCausesModal.set(true);
    }
  });
}
  closeCausesModal(): void {
    this.showCausesModal.set(false);
    this.selectedEntryForCauses.set(null);
  }

  addMatierePremiereReference(): void {
    const reference = this.currentMPReference().trim();
    const quantite = this.currentMPQuantite();
    
    if (!reference || quantite <= 0) {
      alert('Veuillez saisir une référence valide et une quantité supérieure à 0');
      return;
    }

    this.currentCauses.update(causes => ({
      ...causes,
      m1References: [...causes.m1References, { reference, quantite }]
    }));

    this.currentMPReference.set('');
    this.currentMPQuantite.set(0);
  }

  removeMatierePremiereReference(index: number): void {
    this.currentCauses.update(causes => ({
      ...causes,
      m1References: causes.m1References.filter((_, i) => i !== index)
    }));
  }

  updateMPReference(value: string): void {
    this.currentMPReference.set(value);
  }

  updateMPQuantite(value: string): void {
    const numValue = Math.max(0, parseInt(value) || 0);
    this.currentMPQuantite.set(numValue);
  }

  hasMatierePremierReferences(): boolean {
    return this.currentCauses().m1References.length > 0;
  }

  getTotalM1References(): number {
    return this.currentCauses().m1References.reduce((sum, ref) => sum + ref.quantite, 0);
  }

  updateCause(causeKey: keyof Causes5M, value: string): void {
    if (causeKey === 'm1References') return;
    
    const numValue = Math.max(0, parseInt(value) || 0);
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: numValue
    }));
  }

  incrementCause(causeKey: keyof Causes5M, amount: number = 100): void {
    if (causeKey === 'm1References') return;
    
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: (causes[causeKey] as number) + amount
    }));
  }

  decrementCause(causeKey: keyof Causes5M, amount: number = 100): void {
    if (causeKey === 'm1References') return;
    
    this.currentCauses.update(causes => ({
      ...causes,
      [causeKey]: Math.max(0, (causes[causeKey] as number) - amount)
    }));
  }

  getTotalCauses(): number {
    const causes = this.currentCauses();
    const totalReferences = this.getTotalM1References();
    return totalReferences + causes.m2Absence + causes.m2Rendement + causes.m4Maintenance + causes.m5Qualite;
  }

  getEcartCDP(): number {
    const selected = this.selectedEntryForCauses();
    if (!selected) return 0;
    return Math.abs(selected.entry.c - selected.entry.dp);
  }

  getDifferenceRestante(): number {
    return this.getEcartCDP() - this.getTotalCauses();
  }

 saveCauses(): void {
  const selected = this.selectedEntryForCauses();
  if (!selected || !this.selectedLigne() || !this.selectedWeek()) return;

  const planif = this.weekPlanification();
  if (!planif) return;

  // Vérifier que l'utilisateur est authentifié
  const token = this.authService.getToken(); // Assurez-vous d'avoir injecté AuthService
  if (!token) {
    alert('Vous devez être connecté pour sauvegarder');
    return;
  }

  const totalM1 = this.getTotalM1References();
  
  // Créer le DTO exactement comme attendu par le backend
  const dto: any = {
    semaine: `semaine${planif.weekNumber}`,
    jour: selected.day,
    ligne: this.selectedLigne()!.ligne,
    reference: selected.reference.reference,
  };

  // Ajouter les causes seulement si > 0
  if (totalM1 > 0) {
    dto.matierePremiere = totalM1;
    
    // Ajouter la référence MP seulement si elle existe
    if (this.currentCauses().m1References.length > 0) {
      dto.referenceMatierePremiere = this.currentCauses().m1References[0].reference;
    }
  }
  
  if (this.currentCauses().m2Absence > 0) {
    dto.absence = this.currentCauses().m2Absence;
  }
  
  if (this.currentCauses().m2Rendement > 0) {
    dto.rendement = this.currentCauses().m2Rendement;
  }
  
  if (this.currentCauses().m4Maintenance > 0) {
    dto.maintenance = this.currentCauses().m4Maintenance;
  }
  
  if (this.currentCauses().m5Qualite > 0) {
    dto.qualite = this.currentCauses().m5Qualite;
  }

  // Vérifier qu'au moins une cause est > 0
  const totalCauses = this.getTotalCauses();
  if (totalCauses === 0) {
    alert('Veuillez ajouter au moins une cause');
    return;
  }

  // Vérifier que le total correspond à l'écart
  const ecart = this.getEcartCDP();
  if (Math.abs(totalCauses - ecart) > 1) { // Tolérance de 1
    alert(`Le total des causes (${totalCauses}) ne correspond pas à l'écart (${ecart})`);
    return;
  }

  console.log('DTO envoyé au backend:', dto);
  console.log('Headers:', this.nonConfService.getAuthHeaders()); // À ajouter au service

  this.nonConfService.createOrUpdateNonConformite(dto).subscribe({
    next: (response) => {
      console.log('Causes sauvegardées avec succès:', response);
      
      // Mettre à jour localement
      const updatedPlanif = { ...planif };
      const refIndex = updatedPlanif.references.findIndex(
        r => r.reference === selected.reference.reference
      );

      if (refIndex !== -1) {
        const dayEntry = updatedPlanif.references[refIndex][selected.day] as DayEntry;
        if (dayEntry) {
          dayEntry.causes = { 
            ...this.currentCauses(),
            m1MatierePremiere: totalM1
          };
        }
        this.weekPlanification.set(updatedPlanif);
      }

      this.showSuccessMessage('Causes sauvegardées avec succès');
      this.closeCausesModal();
    },
    error: (error) => {
      console.error('Erreur détaillée sauvegarde causes:', error);
      
      let errorMessage = 'Erreur lors de la sauvegarde: ';
      
      if (error.status === 0) {
        errorMessage += 'Impossible de se connecter au serveur. Vérifiez que le backend est en cours d\'exécution sur localhost:3000';
      } else if (error.status === 401) {
        errorMessage += 'Non autorisé. Veuillez vous reconnecter.';
      } else if (error.status === 400) {
        errorMessage += error.error?.message || 'Données invalides';
      } else if (error.status === 404) {
        errorMessage += 'Planification non trouvée';
      } else if (error.status === 409) {
        errorMessage += 'Un rapport existe déjà';
      } else if (error.status === 500) {
        errorMessage += 'Erreur interne du serveur. Vérifiez les logs du backend.';
        console.error('Erreur backend:', error.error);
      }
      
      this.showSuccessMessage(errorMessage);
      
      // Afficher plus de détails pour le débogage
      console.error('Erreur complète:', error);
      console.error('DTO qui a causé l\'erreur:', dto);
    }
  });
}

  getSelectedC(): number {
    const selected = this.selectedEntryForCauses();
    return selected?.entry.c || 0;
  }

  getSelectedDP(): number {
    const selected = this.selectedEntryForCauses();
    return selected?.entry.dp || 0;
  }

  // ==================== UTILITAIRES ====================

  getDayEntry(ref: ReferenceProduction, day: string): DayEntry | undefined {
    return ref[day] as DayEntry | undefined;
  }

  

  formatPhases(phases: WorkPhase[]): string {
    return phases.map(p => `${p.phase}(${p.heures}h)`).join(', ');
  }

  onSearchLineChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchLineQuery.set(target.value);
  }

  onSearchReferenceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchReferenceQuery.set(target.value);
  }

  onSearchRecordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchRecordQuery.set(target.value);
    this.updateFilteredOperators();
  }

  clearLineSearch(): void {
    this.searchLineQuery.set('');
  }

  clearReferenceSearch(): void {
    this.searchReferenceQuery.set('');
  }

  clearRecordSearch(): void {
    this.searchRecordQuery.set('');
  }

  private showSuccessMessage(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3000);
  }

  // ==================== GESTION DU SCROLL ====================

  onTableScroll(event: Event): void {
    const wrapper = event.target as HTMLElement;
    this.updateScrollState(wrapper);
    this.onFirstScroll();
  }

  onTouchStart(event: TouchEvent): void {
    const wrapper = this.scrollWrapper.nativeElement;
    this.isTouchScrolling = true;
    this.touchStartX = event.touches[0].pageX;
    this.scrollLeftStart = wrapper.scrollLeft;
    wrapper.style.cursor = 'grabbing';
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isTouchScrolling) return;
    
    event.preventDefault();
    const wrapper = this.scrollWrapper.nativeElement;
    const x = event.touches[0].pageX;
    const walk = (x - this.touchStartX) * 2;
    wrapper.scrollLeft = this.scrollLeftStart - walk;
    
    this.updateScrollState(wrapper);
  }

  onTouchEnd(): void {
    this.isTouchScrolling = false;
    const wrapper = this.scrollWrapper.nativeElement;
    wrapper.style.cursor = 'grab';
  }

  private updateScrollState(wrapper: HTMLElement): void {
    const scrollLeft = wrapper.scrollLeft;
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    
    this.isScrolled.set(scrollLeft > 10);
    this.isScrolledEnd.set(scrollLeft >= maxScroll - 10);
    this.isScrollable.set(wrapper.scrollWidth > wrapper.clientWidth);
  }

  scrollToStart(): void {
    if (this.scrollWrapper?.nativeElement) {
      this.scrollWrapper.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  hideScrollIndicator(): void {
    this.showScrollIndicator.set(false);
  }

  onFirstScroll(): void {
    this.hideScrollIndicator();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.scrollWrapper?.nativeElement) {
        const wrapper = this.scrollWrapper.nativeElement;
        this.updateScrollState(wrapper);
      }
    }, 100);
  }

  // Dans Prod2Component

getDayDate(dayIndex: number): Date {
  const planif = this.weekPlanification();
  if (!planif) return new Date();
  
  const date = new Date(planif.startDate);
  
  // Correction: Vérifier si startDate est bien un lundi
  // Si ce n'est pas un lundi, ajuster au lundi précédent
  if (date.getDay() !== 1) { // 0=dimanche, 1=lundi
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    date.setDate(date.getDate() + daysToMonday);
  }
  
  // Ajouter le nombre de jours
  date.setDate(date.getDate() + dayIndex);
  return date;
}

// Alternative: Méthode plus robuste qui utilise les dates de la semaine API
getDayDateCorrected(day: string, dayIndex: number): Date {
  const planif = this.weekPlanification();
  if (!planif) return new Date();
  
  // Si nous avons les dates exactes de l'API, les utiliser
  const semaineData = this.getAvailableWeeks().find(w => w.number === planif.weekNumber);
  
  if (semaineData && semaineData.startDate) {
    // S'assurer que startDate est un lundi
    const startDate = new Date(semaineData.startDate);
    
    // Ajuster au lundi si nécessaire
    const dayOfWeek = startDate.getDay(); // 0=dimanche, 1=lundi
    if (dayOfWeek !== 1) {
      const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
      startDate.setDate(startDate.getDate() + daysToMonday);
    }
    
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayIndex);
    return date;
  }
  
  // Fallback: utiliser l'ancienne méthode
  return this.getDayDate(dayIndex);
}
// Ajoutez cette méthode dans Prod2Component
// Version corrigée de getCorrectDateForDay
private getCorrectDateForDay(day: string): string {
  const planif = this.weekPlanification();
  if (!planif) {
    console.error('Aucune planification disponible');
    return this.formatDate(new Date()); // Fallback à la date actuelle
  }

  const dayIndex = this.weekDays.indexOf(day);
  if (dayIndex === -1) {
    console.error(`Jour invalide: ${day}`);
    return this.formatDate(new Date());
  }

  // Utiliser la méthode de calcul de date existante
  const targetDate = this.getDayDateCorrected(day, dayIndex);
  console.log(`Date calculée pour ${day}: ${targetDate}`);
  
  return this.formatDate(targetDate);
}
// Ajouter ces méthodes dans prod2.component.ts

/**
 * Obtient le nombre d'opérateurs depuis la première référence valide
 * (Le nbOperateurs est le même pour toutes les références d'un jour donné)
 */
getAverageOperators(day: string): string {
  const planif = this.filteredWeekPlanification();
  if (!planif || !planif.references || planif.references.length === 0) {
    return '0';
  }

  // Chercher la première référence avec un nbOperateurs défini pour ce jour
  for (const ref of planif.references) {
    const dayEntry = this.getDayEntry(ref, day);
    if (dayEntry && dayEntry.nbOperateurs !== undefined && dayEntry.nbOperateurs !== null) {
      return dayEntry.nbOperateurs.toString();
    }
  }

  return '0';
}

/**
 * Obtient le nombre d'opérateurs pour une référence et un jour spécifiques
 */
getOperatorsForDay(ref: ReferenceProduction, day: string): number {
  const dayEntry = this.getDayEntry(ref, day);
  return dayEntry?.nbOperateurs || 0;
}

/**
 * Met à jour le nombre d'opérateurs pour une entrée spécifique
 */
updateNbOperateurs(reference: ReferenceProduction, day: string, value: string): void {
  if (this.weekPlanification()) {
    const updatedPlanif = { ...this.weekPlanification()! };
    const refIndex = updatedPlanif.references.findIndex(r => r.reference === reference.reference);
    
    if (refIndex !== -1) {
      const dayEntry = updatedPlanif.references[refIndex][day] as DayEntry;
      if (dayEntry) {
        dayEntry.nbOperateurs = parseInt(value) || 0;
      }
      this.weekPlanification.set(updatedPlanif);
    }
  }
}

/**
 * Obtient le total des opérateurs pour un jour donné
 */
getTotalOperatorsForDay(day: string): number {
  const planif = this.filteredWeekPlanification();
  if (!planif || !planif.references) {
    return 0;
  }

  let total = 0;
  planif.references.forEach(ref => {
    const dayEntry = this.getDayEntry(ref, day);
    if (dayEntry && dayEntry.nbOperateurs) {
      total += dayEntry.nbOperateurs;
    }
  });

  return total;
}

/**
 * Met à jour le nbOperateurs pour TOUTES les références d'un jour donné
 * (Le nbOperateurs est partagé par toutes les références du même jour)
 */
updateAllReferencesOperators(day: string, value: string): void {
  const nbOp = parseInt(value, 10) || 0;
  
  if (nbOp < 0 || nbOp > 50) {
    console.warn('Nombre d\'opérateurs invalide:', nbOp);
    return;
  }

  const planif = this.weekPlanification();
  if (!planif) return;

  const updatedPlanif = { ...planif };
  
  // Mettre à jour toutes les références pour ce jour
  updatedPlanif.references = updatedPlanif.references.map(ref => {
    const updatedRef = { ...ref };
    const dayEntry = updatedRef[day] as DayEntry;
    
    if (dayEntry) {
      dayEntry.nbOperateurs = nbOp;
    }
    
    return updatedRef;
  });

  this.weekPlanification.set(updatedPlanif);
  console.log(`NB Opérateurs mis à jour pour ${day}: ${nbOp}`);
}

/**
 * Obtient le nombre moyen d'opérateurs en tant que nombre
 * Utilisé pour les conditions ngClass
 */
getAverageOperatorsNumber(day: string): number {
  const value = this.getAverageOperators(day);
  return parseInt(value, 10) || 0;
}
}