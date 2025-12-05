// src/saisie-rapport/saisie-rapport.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  ParseIntPipe,
  Query,
  
} from '@nestjs/common';
import { SaisieRapportService } from './saisie-rapport.service';
import { CreateSaisieRapportDto } from './dto/create-saisie-rapport.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsNotEmpty } from 'class-validator';



export class VoirRapportsSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;
}

@Controller('saisie-rapport')
export class SaisieRapportController {
  constructor(private readonly saisieRapportService: SaisieRapportService) {}

  // Créer un nouveau rapport de phase
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createSaisieRapportDto: CreateSaisieRapportDto) {
    return await this.saisieRapportService.createRapport(createSaisieRapportDto);
  }

  // Récupérer tous les rapports
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.saisieRapportService.findAll();
  }

  // Récupérer les rapports par semaine
  @Get('semaine/:semaine')
  @UseGuards(JwtAuthGuard)
  async findBySemaine(@Param('semaine') semaine: string) {
    return await this.saisieRapportService.findBySemaine(semaine);
  }

  // Récupérer les rapports par semaine et jour
  @Get('semaine/:semaine/jour/:jour')
  @UseGuards(JwtAuthGuard)
  async findBySemaineJour(
    @Param('semaine') semaine: string,
    @Param('jour') jour: string
  ) {
    return await this.saisieRapportService.findBySemaineJour(semaine, jour);
  }

  // Récupérer les rapports par matricule
  @Get('matricule/:matricule')
  @UseGuards(JwtAuthGuard)
  async findByMatricule(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.saisieRapportService.findByMatricule(matricule);
  }

  // Récupérer les rapports par ligne
  @Get('ligne/:ligne')
  @UseGuards(JwtAuthGuard)
  async findByLigne(@Param('ligne') ligne: string) {
    return await this.saisieRapportService.findByLigne(ligne);
  }

  // Obtenir les statistiques d'un ouvrier pour une semaine
  @Get('stats/:matricule/semaine/:semaine')
  @UseGuards(JwtAuthGuard)
  async getStatsOuvrierSemaine(
    @Param('matricule', ParseIntPipe) matricule: number,
    @Param('semaine') semaine: string
  ) {
    return await this.saisieRapportService.getStatsOuvrierSemaine(matricule, semaine);
  }

  // Supprimer un rapport
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.saisieRapportService.remove(id);
  }
  @Post('vu')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async voirRapportsSemaine(@Body() voirRapportsSemaineDto: VoirRapportsSemaineDto) {
    return await this.saisieRapportService.voirRapportsSemaine(voirRapportsSemaineDto.semaine);
  }
}