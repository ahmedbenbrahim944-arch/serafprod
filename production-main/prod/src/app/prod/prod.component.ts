// src/app/prod/prod.component.ts
import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { ProductService, ProductLine } from './product.service';
import { AuthService } from '../login/auth.service';
import { TempsSecService } from './temps-sec.service';
import { OuvrierService } from './ouvrier.service';
import { PhaseService } from './phase.service';
import { SemaineService } from './semaine.service';
import { UserService } from './user.service';

interface CreateLineForm {
  ligne: string;
  references: string;
  image: File | null;
  imagePreview: string | null;
  errors: {
    ligne?: string;
    references?: string;
    image?: string;
  };
}

interface AddReferencesForm {
  selectedLine: string; // Changez de 'ligne' à 'selectedLine' pour plus de clarté
  references: string;
  errors: {
    selectedLine?: string;
    references?: string;
  };
}

interface WeekForm {
  nom: string; // Changez weekNumber en nom
  dateDebut: string;
  dateFin: string;
  errors: {
    nom?: string;
    dateDebut?: string;
    dateFin?: string;
  };
}

interface UserForm {
  nom: string;
  prenom: string;
  password: string;
  errors: {
    nom?: string;
    prenom?: string;
    password?: string;
  };
}

interface TimeForm {
  selectedLine: string; // Changez de 'ligne' à 'selectedLine'
  selectedReference: string; // Changez de 'reference' à 'selectedReference'
  seconde: number;
  errors: {
    selectedLine?: string;
    selectedReference?: string;
    seconde?: string;
  };
}

interface WorkerForm {
  matricule: number | null;
  nomPrenom: string;
  errors: {
    matricule?: string;
    nomPrenom?: string;
  };
}

interface PhaseForm {
  mode: 'add' | 'edit'; // Nouveau : mode add ou edit
  selectedLine: string;
  phase: string;
  errors: {
    selectedLine?: string;
    phase?: string;
  };
}

interface User {
  id?: number; // Rendre id optionnel pour correspondre au service
  nom: string;
  prenom: string;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  createdBy?: any;
}

@Component({
  selector: 'app-prod',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './prod.component.html',
  styleUrls: ['./prod.component.css']
})
export class ProdComponent implements OnInit {
  // Services injectés
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private tempsSecService = inject(TempsSecService);
  private ouvrierService = inject(OuvrierService);
  private phaseService = inject(PhaseService);
  private semaineService = inject(SemaineService);
  private userService = inject(UserService);

  showImageUploadModal = false;
  selectedLineImage: File | null = null;
  lineImagePreview: string | null = null;
  imageUploadError: string | null = null;

  // Signals pour la réactivité
  loading = signal(false);
  lines = signal<ProductLine[]>([]);
  searchQuery = signal('');
  activeTab = signal('view');
  selectedLine = signal<ProductLine | null>(null);
  showSuccess = signal(false);
  successMessage = signal('');
  particles = signal<any[]>([]);
  users = signal<User[]>([]);
  errorMessage = signal<string | null>(null);
  
  


  // Formulaires
  createForm: CreateLineForm = {
    ligne: '',
    references: '',
    image: null,
    imagePreview: null,
    errors: {}
  };

  addRefForm: AddReferencesForm = {
  selectedLine: '', // Vide initialement
  references: '',
  errors: {}
};

  weekForm: WeekForm = {
  nom: '', // Au lieu de weekNumber
  dateDebut: '',
  dateFin: '',
  errors: {}
};

  userForm: UserForm = {
    nom: '',
    prenom: '',
    password: '',
    errors: {}
  };

  timeForm: TimeForm = {
  selectedLine: '',
  selectedReference: '',
  seconde: 0,
  errors: {}
};

  workerForm: WorkerForm = {
    matricule: null,
    nomPrenom: '',
    errors: {}
  };

  phaseForm: PhaseForm = {
  mode: 'add', // Par défaut en mode ajout
  selectedLine: '',
  phase: '',
  errors: {}
};

  availableWeeks: number[] = [];

  // Computed properties
  totalLines = computed(() => this.lines().length);
  totalReferences = computed(() => 
    this.lines().reduce((total, line) => {
      return total + (line.references?.length || 0);

    }, 0)
  );
  totalUsers = computed(() => this.users().length);



  // Statistiques par défaut
  private totalLinesCount = signal(0);

  ngOnInit() {
    this.generateParticles();
    this.generateAvailableWeeks();
    this.loadLines();
    this.loadUsers();
    this.loadStats();
  }

  phases = signal<any[]>([]);
selectedPhaseForEdit: any = null;

  private generateParticles() {
    const particles = [];
    for (let i = 0; i < 25; i++) {
      particles.push({
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 8 + 2}px`,
        animationDelay: `${Math.random() * 15}s`,
        opacity: `${Math.random() * 0.4 + 0.1}`
      });
    }
    this.particles.set(particles);
  }

  private generateAvailableWeeks() {
    this.availableWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
  }

  private loadLines() {
    this.loading.set(true);
    this.errorMessage.set(null);
    
    this.productService.getAllLines()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des lignes:', error);
          this.errorMessage.set('Impossible de charger les lignes. Vérifiez la connexion au serveur.');
          return of({ lines: [], total: 0 });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          const linesWithFullImageUrls = response.lines.map(line => ({
            ...line,
            imageUrl: this.productService.getImageUrl(line.imageUrl),
            references: line.references || []
          }));
          this.lines.set(linesWithFullImageUrls);
        }
      });
  }

  private loadPhases() {
  this.loading.set(true);
  
  this.phaseService.findAll()
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors du chargement des phases:', error);
        return of([]);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (phases) => {
        this.phases.set(phases);
      }
    });
}

// Méthode pour basculer entre mode ajout et édition
setPhaseMode(mode: 'add' | 'edit') {
  this.phaseForm.mode = mode;
  this.resetPhaseForm();
  
  if (mode === 'edit') {
    // Charger les phases pour la sélection
    this.loadPhases();
  }
}

// Obtenir les phases pour la ligne sélectionnée
getPhasesForSelectedLine(): any[] {
  if (!this.phaseForm.selectedLine) {
    return [];
  }
  
  return this.phases().filter(phase => 
    phase.ligne === this.phaseForm.selectedLine
  );
}

// Sélectionner une phase pour modification
selectPhaseForEdit(phase: any) {
  this.selectedPhaseForEdit = phase;
  this.phaseForm.selectedLine = phase.ligne;
  this.phaseForm.phase = phase.phase;
  this.phaseForm.mode = 'edit';
}

// Vérifier si une phase existe déjà pour la ligne sélectionnée
checkIfPhaseExists(): boolean {
  if (!this.phaseForm.selectedLine || !this.phaseForm.phase.trim()) {
    return false;
  }
  
  return this.phases().some(phase => 
    phase.ligne === this.phaseForm.selectedLine && 
    phase.phase === this.phaseForm.phase.trim()
  );
}

  private loadUsers() {
    this.loading.set(true);
    
    this.userService.findAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des utilisateurs:', error);
          // Utilisateurs de test en cas d'erreur
          return of([
            { 
              id: 1, 
              nom: '1234', 
              prenom: 'Admin',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            { 
              id: 2, 
              nom: '5678', 
              prenom: 'Utilisateur',
              isActive: true,
              createdAt: new Date().toISOString()
            }
          ]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (users) => {
          this.users.set(users);
        }
      });
  }

  private loadStats() {
    this.productService.getStats()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des stats:', error);
          return of({ totalLines: 0 });
        })
      )
      .subscribe({
        next: (stats) => {
          this.totalLinesCount.set(stats.totalLines || 0);
        }
      });
  }

  onSearch() {
    const query = this.searchQuery().toLowerCase().trim();
    
    if (!query) {
      this.loadLines();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.productService.searchLines(query)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la recherche:', error);
          this.errorMessage.set('Erreur lors de la recherche.');
          return of({ lines: [], query });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          const linesWithFullImageUrls = response.lines.map(line => ({
            ...line,
            imageUrl: this.productService.getImageUrl(line.imageUrl),
            references: line.references || []
          }));
          this.lines.set(linesWithFullImageUrls);
        }
      });
  }

  onCreateLine() {
    this.createForm.errors = {};
    let hasErrors = false;

    if (!this.createForm.ligne.trim()) {
      this.createForm.errors.ligne = 'Le nom de la ligne est requis';
      hasErrors = true;
    }

    if (!this.createForm.references.trim()) {
      this.createForm.errors.references = 'Au moins une référence est requise';
      hasErrors = true;
    }

    if (hasErrors) return;

    const references = this.productService.parseReferences(this.createForm.references);
    if (references.length === 0) {
      this.createForm.errors.references = 'Veuillez saisir au moins une référence valide';
      return;
    }

    const createData = {
      ligne: this.createForm.ligne.trim(),
      references
    };

    this.loading.set(true);
    this.errorMessage.set(null);

    this.productService.createLineWithImage(createData, this.createForm.image)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la création:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la création de la ligne');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage('Ligne créée avec succès !');
            this.resetCreateForm();
            this.activeTab.set('view');
            this.loadLines();
          }
        }
      });
  }

  onAddReferences() {
  // Validation
  this.addRefForm.errors = {};
  let hasErrors = false;

  if (!this.addRefForm.selectedLine.trim()) {
    this.addRefForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.addRefForm.references.trim()) {
    this.addRefForm.errors.references = 'Au moins une référence est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  const references = this.productService.parseReferences(this.addRefForm.references);
  if (references.length === 0) {
    this.addRefForm.errors.references = 'Veuillez saisir au moins une référence valide';
    return;
  }

  this.loading.set(true);
  this.errorMessage.set(null);

  this.productService.addReferences(this.addRefForm.selectedLine.trim(), references)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de l\'ajout des références:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout des références');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          let message = 'Références ajoutées avec succès !';
          if (response.existingReferences && response.existingReferences.length > 0) {
            message = `${response.addedReferences.length} référence(s) ajoutée(s), ${response.existingReferences.length} référence(s) existaient déjà`;
          }
          
          this.showSuccessMessage(message);
          this.resetAddRefForm();
          this.activeTab.set('view');
          this.loadLines(); // Recharger la liste
        }
      }
    });
}

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.createForm.errors.image = 'Veuillez sélectionner une image valide (JPEG, PNG, etc.)';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.createForm.errors.image = 'L\'image ne doit pas dépasser 5MB';
        return;
      }

      this.createForm.image = file;
      this.createForm.errors.image = '';

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.createForm.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.createForm.image = null;
    this.createForm.imagePreview = null;
    this.createForm.errors.image = '';
  }

  selectLine(line: ProductLine) {
    this.loading.set(true);
    
    this.productService.getLine(line.ligne)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors du chargement des détails:', error);
          this.errorMessage.set('Impossible de charger les détails de la ligne');
          return of(line);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (detailedLine) => {
          this.selectedLine.set({
            ...detailedLine,
            imageUrl: this.productService.getImageUrl(detailedLine.imageUrl),
            references: detailedLine.references || []
          });
        }
      });
  }

  closeModal() {
    this.selectedLine.set(null);
  }

  setActiveTab(tab: string) {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.errorMessage.set(null);
    
    if (tab === 'view') {
      this.loadLines();
    }
  }

  private showSuccessMessage(message: string) {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => {
      this.showSuccess.set(false);
    }, 3000);
  }

  private resetCreateForm() {
    this.createForm = {
      ligne: '',
      references: '',
      image: null,
      imagePreview: null,
      errors: {}
    };
  }

  private resetAddRefForm() {
  this.addRefForm = {
    selectedLine: '',
    references: '',
    errors: {}
  };
}

  goBackToLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onAddUser() {
    this.userForm.errors = {};
    let hasErrors = false;

    if (!this.userForm.nom.trim()) {
      this.userForm.errors.nom = 'Le nom est requis';
      hasErrors = true;
    } else if (!/^\d+$/.test(this.userForm.nom)) {
      this.userForm.errors.nom = 'Le nom doit contenir uniquement des chiffres';
      hasErrors = true;
    } else if (this.userForm.nom.length < 4 || this.userForm.nom.length > 10) {
      this.userForm.errors.nom = 'Le nom doit contenir entre 4 et 10 chiffres';
      hasErrors = true;
    }

    if (!this.userForm.prenom.trim()) {
      this.userForm.errors.prenom = 'Le prénom est requis';
      hasErrors = true;
    } else if (this.userForm.prenom.length > 50) {
      this.userForm.errors.prenom = 'Le prénom ne doit pas dépasser 50 caractères';
      hasErrors = true;
    }

    if (!this.userForm.password.trim()) {
      this.userForm.errors.password = 'Le mot de passe est requis';
      hasErrors = true;
    } else if (!/^\d+$/.test(this.userForm.password)) {
      this.userForm.errors.password = 'Le mot de passe doit contenir uniquement des chiffres';
      hasErrors = true;
    } else if (this.userForm.password.length < 4 || this.userForm.password.length > 10) {
      this.userForm.errors.password = 'Le mot de passe doit contenir entre 4 et 10 chiffres';
      hasErrors = true;
    }

    if (hasErrors) return;

    const createUserDto = {
      nom: this.userForm.nom,
      prenom: this.userForm.prenom,
      password: this.userForm.password
    };

    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService.create(createUserDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la création de l\'utilisateur:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la création de l\'utilisateur');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Utilisateur "${this.userForm.nom} ${this.userForm.prenom}" créé avec succès !`);
            this.resetUserForm();
            this.loadUsers();
          }
        }
      });
  }

  private resetUserForm() {
    this.userForm = {
      nom: '',
      prenom: '',
      password: '',
      errors: {}
    };
  }

  onCancelUser() {
    this.resetUserForm();
  }

  onCreateWeek() {
  // Validation
  this.weekForm.errors = {};
  let hasErrors = false;

  if (!this.weekForm.nom.trim()) {
    this.weekForm.errors.nom = 'Le nom de la semaine est requis';
    hasErrors = true;
  } else if (!/^semaine[0-9]{1,2}$/.test(this.weekForm.nom.trim())) {
    this.weekForm.errors.nom = 'Le nom doit être au format "semaineXX" (ex: semaine47, semaine48)';
    hasErrors = true;
  }

  if (!this.weekForm.dateDebut.trim()) {
    this.weekForm.errors.dateDebut = 'La date de début est requise';
    hasErrors = true;
  }

  if (!this.weekForm.dateFin.trim()) {
    this.weekForm.errors.dateFin = 'La date de fin est requise';
    hasErrors = true;
  }

  if (hasErrors) return;

  const createSemaineDto = {
    nom: this.weekForm.nom.trim(),
    dateDebut: this.weekForm.dateDebut,
    dateFin: this.weekForm.dateFin
  };

  this.loading.set(true);
  this.errorMessage.set(null);

  this.semaineService.createSemaine(createSemaineDto)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de la création de la semaine:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de la création de la semaine');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          this.showSuccessMessage(`Semaine "${this.weekForm.nom}" créée avec succès !`);
          this.resetWeekForm();
          this.activeTab.set('view');
        }
      }
    });
}

  private resetWeekForm() {
  this.weekForm = {
    nom: '',
    dateDebut: '',
    dateFin: '',
    errors: {}
  };
}

  onCancelWeek() {
    this.resetWeekForm();
    this.activeTab.set('view');
  }

 onAddTime() {
  // Validation
  this.timeForm.errors = {};
  let hasErrors = false;

  if (!this.timeForm.selectedLine.trim()) {
    this.timeForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.timeForm.selectedReference.trim()) {
    this.timeForm.errors.selectedReference = 'Veuillez sélectionner une référence';
    hasErrors = true;
  }

  if (!this.timeForm.seconde || this.timeForm.seconde <= 0) {
    this.timeForm.errors.seconde = 'Veuillez saisir un temps valide (supérieur à 0)';
    hasErrors = true;
  }

  if (hasErrors) return;

  const createTempsSecDto = {
    ligne: this.timeForm.selectedLine,
    reference: this.timeForm.selectedReference,
    seconde: this.timeForm.seconde
  };

  this.loading.set(true);
  this.errorMessage.set(null);

  this.tempsSecService.createOrUpdate(createTempsSecDto)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Erreur lors de l\'ajout du temps:', error);
        this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout du temps');
        return of(null);
      }),
      finalize(() => this.loading.set(false))
    )
    .subscribe({
      next: (response) => {
        if (response) {
          this.showSuccessMessage(`Temps de ${this.timeForm.seconde} secondes ajouté pour ${this.timeForm.selectedLine} - ${this.timeForm.selectedReference} !`);
          this.resetTimeForm();
          this.activeTab.set('view');
        }
      }
    });
}

  private resetTimeForm() {
  this.timeForm = {
    selectedLine: '',
    selectedReference: '',
    seconde: 0,
    errors: {}
  };
}

  onCancelTime() {
    this.resetTimeForm();
    this.activeTab.set('view');
  }

  async onAddWorker() {
  // Validation
  this.workerForm.errors = {};
  let hasErrors = false;

  if (!this.workerForm.matricule) {
    this.workerForm.errors.matricule = 'Le matricule est requis';
    hasErrors = true;
  } else if (this.workerForm.matricule < 1 || this.workerForm.matricule > 999999) {
    this.workerForm.errors.matricule = 'Le matricule doit être entre 1 et 999999';
    hasErrors = true;
  }

  if (!this.workerForm.nomPrenom.trim()) {
    this.workerForm.errors.nomPrenom = 'Le nom et prénom sont requis';
    hasErrors = true;
  }

  if (hasErrors) return;

  // VÉRIFICATION SI L'OUVRIER EXISTE DÉJÀ
  this.loading.set(true);
  this.errorMessage.set(null);
  
  try {
    // Vérifier si l'ouvrier existe déjà
    const ouvrierExists = await this.checkIfWorkerExists(this.workerForm.matricule!);
    
    if (ouvrierExists) {
      this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
      this.loading.set(false);
      return;
    }

    // Si l'ouvrier n'existe pas, procéder à la création
    const createOuvrierDto = {
      matricule: this.workerForm.matricule!,
      nomPrenom: this.workerForm.nomPrenom
    };

    this.ouvrierService.create(createOuvrierDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'ajout de l\'ouvrier:', error);
          
          // Gestion spécifique des erreurs de conflit (matricule déjà existant)
          if (error.status === 409) {
            this.errorMessage.set(`Un ouvrier avec le matricule ${this.workerForm.matricule} existe déjà !`);
          } else {
            this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de l\'ouvrier');
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Ouvrier "${this.workerForm.nomPrenom}" (${this.workerForm.matricule}) ajouté avec succès !`);
            this.resetWorkerForm();
            this.activeTab.set('view');
          }
        }
      });
      
  } catch (error) {
    this.loading.set(false);
    console.error('Erreur lors de la vérification:', error);
  }
}

  

  onCancelWorker() {
    this.resetWorkerForm();
    this.activeTab.set('view');
  }

  onAddPhase() {
  // Validation
  this.phaseForm.errors = {};
  let hasErrors = false;

  if (!this.phaseForm.selectedLine.trim()) {
    this.phaseForm.errors.selectedLine = 'Veuillez sélectionner une ligne';
    hasErrors = true;
  }

  if (!this.phaseForm.phase.trim()) {
    this.phaseForm.errors.phase = 'Le numéro de phase est requis';
    hasErrors = true;
  } else if (this.phaseForm.phase.trim().length > 10) {
    this.phaseForm.errors.phase = 'La phase ne doit pas dépasser 10 caractères';
    hasErrors = true;
  }

  if (hasErrors) return;

  const createPhaseDto = {
    ligne: this.phaseForm.selectedLine,
    phase: this.phaseForm.phase.trim()
  };

  // Vérifier si la phase existe déjà (sauf en mode édition de cette même phase)
  const phaseExists = this.checkIfPhaseExists();
  
  if (phaseExists && this.phaseForm.mode === 'add') {
    this.errorMessage.set(`La phase "${this.phaseForm.phase}" existe déjà pour la ligne "${this.phaseForm.selectedLine}"`);
    return;
  }

  this.loading.set(true);
  this.errorMessage.set(null);

  if (this.phaseForm.mode === 'add') {
    // Mode AJOUT
    this.phaseService.create(createPhaseDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'ajout de la phase:', error);
          
          if (error.status === 409) {
            this.errorMessage.set(`La phase "${this.phaseForm.phase}" existe déjà pour cette ligne`);
          } else {
            this.errorMessage.set(error.error?.message || 'Erreur lors de l\'ajout de la phase');
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Phase "${this.phaseForm.phase}" ajoutée pour la ligne "${this.phaseForm.selectedLine}" !`);
            this.resetPhaseForm();
            this.loadPhases(); // Recharger la liste
            this.activeTab.set('view');
          }
        }
      });
  } else {
    // Mode ÉDITION
    if (!this.selectedPhaseForEdit || !this.selectedPhaseForEdit.id) {
      this.errorMessage.set('Aucune phase sélectionnée pour modification');
      this.loading.set(false);
      return;
    }

    const updatePhaseDto = {
      phase: this.phaseForm.phase.trim()
    };

    this.phaseService.update(this.selectedPhaseForEdit.id, updatePhaseDto)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la modification de la phase:', error);
          this.errorMessage.set(error.error?.message || 'Erreur lors de la modification de la phase');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage(`Phase modifiée avec succès ! Nouveau numéro: "${this.phaseForm.phase}"`);
            this.resetPhaseForm();
            this.loadPhases(); // Recharger la liste
            this.activeTab.set('view');
          }
        }
      });
  }
}

  private resetPhaseForm() {
  this.phaseForm = {
    mode: this.phaseForm.mode, // Garder le mode actuel
    selectedLine: '',
    phase: '',
    errors: {}
  };
  this.selectedPhaseForEdit = null;
  this.errorMessage.set(null);
}

  

  openImageUpload() {
    this.showImageUploadModal = true;
    this.selectedLineImage = null;
    this.lineImagePreview = null;
    this.imageUploadError = null;
  }

  closeImageUploadModal() {
    this.showImageUploadModal = false;
    this.selectedLineImage = null;
    this.lineImagePreview = null;
    this.imageUploadError = null;
  }

  onLineImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.imageUploadError = 'Veuillez sélectionner une image valide (JPEG, PNG, etc.)';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.imageUploadError = 'L\'image ne doit pas dépasser 5MB';
        return;
      }

      this.selectedLineImage = file;
      this.imageUploadError = null;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.lineImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  onDeletePhase(phaseId: number) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette phase ?')) {
    this.loading.set(true);
    
    this.phaseService.remove(phaseId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de la suppression:', error);
          this.errorMessage.set('Erreur lors de la suppression de la phase');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.showSuccessMessage('Phase supprimée avec succès !');
            this.loadPhases(); // Recharger la liste
          }
        }
      });
  }
}

// Mettez à jour onCancelPhase
onCancelPhase() {
  this.resetPhaseForm();
  this.activeTab.set('view');
}
/**
 * Obtenir les phases pour une ligne spécifique
 */
getPhasesForLine(ligne: string): any[] {
  return this.phases().filter(phase => phase.ligne === ligne);
}

/**
 * Sélectionner une ligne pour la gestion des phases
 */
selectLineForPhaseManagement(ligne: string) {
  this.phaseForm.selectedLine = ligne;
  this.phaseForm.mode = 'add';
  this.activeTab.set('add-phase');
  this.closeModal();
  
  // Charger les phases pour cette ligne
  this.loadPhases();
}

/**
 * Sélectionner une phase pour modification depuis la vue ligne
 */
selectPhaseForEditFromLine(phase: any) {
  this.selectedPhaseForEdit = phase;
  this.phaseForm.selectedLine = phase.ligne;
  this.phaseForm.phase = phase.phase;
  this.phaseForm.mode = 'edit';
  this.activeTab.set('add-phase');
  this.closeModal();
  
  // Charger toutes les phases
  this.loadPhases();
}
  uploadLineImage() {
    if (!this.selectedLine() || !this.selectedLineImage) {
      this.imageUploadError = 'Veuillez sélectionner une image';
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.imageUploadError = null;

    this.productService.addImageToLine(this.selectedLine()!.ligne, this.selectedLineImage)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Erreur lors de l\'upload de l\'image:', error);
          this.imageUploadError = error.error?.message || 'Erreur lors de l\'upload de l\'image';
          
          if (error.status) {
            this.imageUploadError += ` (Statut: ${error.status})`;
          }
          
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response) {
            const fullImageUrl = response.imageUrl ? 
              this.productService.getImageUrl(response.imageUrl) : 
              null;
            
            this.showSuccessMessage('Photo de la ligne mise à jour avec succès !');
            
            const updatedLines = this.lines().map(line => {
              if (line.ligne === this.selectedLine()!.ligne) {
                return {
                  ...line,
                  imageUrl: fullImageUrl || line.imageUrl
                };
              }
              return line;
            });
            this.lines.set(updatedLines);
            
            if (this.selectedLine()) {
              const updatedSelectedLine = {
                ...this.selectedLine()!,
                imageUrl: fullImageUrl || this.selectedLine()!.imageUrl
              };
              this.selectedLine.set(updatedSelectedLine);
            }
            
            this.closeImageUploadModal();
            
            setTimeout(() => {
              this.loadLines();
            }, 500);
          } else {
            this.imageUploadError = 'Aucune réponse du serveur';
          }
        }
      });
  }
  /**
 * Grouper les lignes par première lettre pour une meilleure organisation
 */
getGroupedLines(): { group: string, lines: ProductLine[] }[] {
  const lines = this.lines();
  
  // Trier les lignes par nom
  const sortedLines = [...lines].sort((a, b) => 
    a.ligne.localeCompare(b.ligne, undefined, { sensitivity: 'base' })
  );
  
  // Grouper par première lettre
  const groups: { [key: string]: ProductLine[] } = {};
  
  sortedLines.forEach(line => {
    const firstLetter = line.ligne.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(line);
  });
  
  // Convertir en tableau
  return Object.keys(groups)
    .sort()
    .map(letter => ({
      group: `Lignes commençant par "${letter}"`,
      lines: groups[letter]
    }));
}

/**
 * Obtenir les détails de la ligne sélectionnée
 */
getSelectedLineDetails(): ProductLine | null {
  if (!this.addRefForm.selectedLine) {
    return null;
  }
  
  return this.lines().find(line => 
    line.ligne === this.addRefForm.selectedLine
  ) || null;
}

/**
 * Sélectionner automatiquement une ligne depuis la vue détaillée
 */
selectLineForAddingRefs(line: ProductLine) {
  this.addRefForm.selectedLine = line.ligne;
  this.activeTab.set('add-ref');
  
  // Faire défiler vers le formulaire
  setTimeout(() => {
    const formElement = document.querySelector('.creation-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

  // Getters pour compatibilité avec le template
  getTotalLines(): number {
    return this.totalLines();
  }

  getTotalReferences(): number {
    return this.totalReferences();
  }

  getTotalUsers(): number {
    return this.totalUsers();
  }

  getUserType(): string | null {
    return this.authService.getUserType();
  }

  logout() {
    this.authService.logout();
  }
  getAvailableReferences(): string[] {
  if (!this.timeForm.selectedLine) {
    return [];
  }
  
  const selectedLine = this.lines().find(line => 
    line.ligne === this.timeForm.selectedLine
  );
  
  return selectedLine?.references || [];
}
onLineSelectedForTime() {
  // Réinitialiser la référence quand on change de ligne
  this.timeForm.selectedReference = '';
  this.timeForm.errors.selectedReference = '';
}
loadExistingTimeForReference() {
  if (!this.timeForm.selectedLine || !this.timeForm.selectedReference) {
    return;
  }
  
  this.tempsSecService.findByLigneAndReference(
    this.timeForm.selectedLine, 
    this.timeForm.selectedReference
  )
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        // Si pas trouvé, c'est normal (premier ajout)
        console.log('Temps non trouvé pour cette combinaison');
        return of(null);
      })
    )
    .subscribe({
      next: (existingTime) => {
        if (existingTime && Array.isArray(existingTime) && existingTime.length > 0) {
          // Si temps existe déjà, pré-remplir le champ
          this.timeForm.seconde = existingTime[0].seconde;
          this.showSuccessMessage(`Temps existant trouvé : ${existingTime[0].seconde} secondes`);
        }
      }
    });
}
/**
 * Vérifier si un ouvrier avec ce matricule existe déjà
 */
async checkIfWorkerExists(matricule: number): Promise<boolean> {
  try {
    // CORRECTION : passer directement le nombre
    await this.ouvrierService.searchByMatricule(matricule).toPromise();
    return true; // Si pas d'erreur, l'ouvrier existe
  } catch (error: any) {
    // Si erreur 404, l'ouvrier n'existe pas
    if (error.status === 404) {
      return false;
    }
    // Pour d'autres erreurs, on considère qu'il n'existe pas
    console.log('Erreur lors de la vérification:', error);
    return false;
  }
}
// Ajoutez ces propriétés
matriculeCheckResult: {
  available: boolean;
  message: string;
  existingWorker?: { matricule: number; nomPrenom: string };
} | null = null;

checkingMatricule = signal(false);

// Méthode pour vérifier le matricule
async onCheckMatricule() {
  if (!this.workerForm.matricule || this.workerForm.matricule < 1) {
    return;
  }

  this.checkingMatricule.set(true);
  this.matriculeCheckResult = null;

  try {
    // Vérifier si l'ouvrier existe
    const exists = await this.checkIfWorkerExists(this.workerForm.matricule);
    
    if (exists) {
      // Si existe, essayer de récupérer ses informations
      try {
        // CORRECTION : passer directement le nombre
        const existingWorker = await this.ouvrierService.searchByMatricule(this.workerForm.matricule!).toPromise();
        
        this.matriculeCheckResult = {
          available: false,
          message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`,
          existingWorker: existingWorker
        };
      } catch (error) {
        this.matriculeCheckResult = {
          available: false,
          message: `❌ Le matricule ${this.workerForm.matricule} est déjà utilisé`
        };
      }
    } else {
      this.matriculeCheckResult = {
        available: true,
        message: `✅ Le matricule ${this.workerForm.matricule} est disponible`
      };
    }
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    this.matriculeCheckResult = {
      available: false,
      message: '⚠️ Erreur lors de la vérification du matricule'
    };
  } finally {
    this.checkingMatricule.set(false);
  }
}

// Méthode pour suggérer un autre matricule
suggestDifferentMatricule() {
  // Générer un matricule aléatoire dans la plage 1000-9999
  const suggestedMatricule = Math.floor(Math.random() * 9000) + 1000;
  this.workerForm.matricule = suggestedMatricule;
  this.matriculeCheckResult = null;
  
  // Vérifier automatiquement le nouveau matricule après un délai
  setTimeout(() => {
    this.onCheckMatricule();
  }, 500);
}

// Mettez à jour resetWorkerForm pour réinitialiser aussi le résultat de vérification
private resetWorkerForm() {
  this.workerForm = {
    matricule: null,
    nomPrenom: '',
    errors: {}
  };
  this.matriculeCheckResult = null;
}
/**
 * Sélectionner une référence pour définir son temps depuis la vue détaillée
 */
selectRefForTimeSetting(ligne: string, reference: string) {
  this.timeForm.selectedLine = ligne;
  this.timeForm.selectedReference = reference;
  
  // Charger le temps existant si disponible
  this.loadExistingTimeForReference();
  
  // Basculer vers l'onglet temps
  this.activeTab.set('add-time');
  this.closeModal();
  
  // Faire défiler vers le formulaire
  setTimeout(() => {
    const formElement = document.querySelector('.creation-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}
}