// stats.controller.ts - VERSION CORRIGÉE
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  UsePipes, 
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  BadRequestException
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { GetStatsDto } from './dto/get-stats.dto';
import { GetStatsLignesDto } from './dto/get-stats-lignes.dto';
import { GetStatsSemaineDto } from './dto/get-stats-semaine.dto';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { GetStatsAnnuelDto } from './dto/get-stats-annuel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetAffectationPersonnelDto } from './dto/get-affectation-personnel.dto';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsBySemaineAndLigne(@Body() getStatsDto: GetStatsDto) {
    const { semaine, ligne } = getStatsDto;
    return this.statsService.getStatsBySemaineAndLigne(semaine, ligne);
  }

  @Post('lignes')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPcsProdTotalParLigne(@Body() getStatsLignesDto: GetStatsLignesDto) {
    const { semaine } = getStatsLignesDto;
    return this.statsService.getPcsProdTotalParLigne(semaine);
  }

  @Get('lignes')
  @UseGuards(JwtAuthGuard)
  async getPcsProdTotalParLigneQuery(@Query('semaine') semaine: string) {
    return this.statsService.getPcsProdTotalParLigne(semaine);
  }

  @Post('pourcentage-5m')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPourcentage5MParSemaine(@Body() getStatsSemaineDto: GetStatsSemaineDto) {
    const { semaine } = getStatsSemaineDto;
    return this.statsService.getStatsPourcentage5MParSemaine(semaine);
  }

  @Get('pourcentage-5m')
  @UseGuards(JwtAuthGuard)
  async getPourcentage5MParSemaineQuery(@Query('semaine') semaine: string) {
    return this.statsService.getStatsPourcentage5MParSemaine(semaine);
  }

  @Post('pourcentage-5m-ligne')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPourcentage5MParLigne(@Body() getStatsSemaineDto: GetStatsSemaineDto) {
    const { semaine } = getStatsSemaineDto;
    return this.statsService.getPourcentage5MParLigne(semaine);
  }

  @Get('pourcentage-5m-ligne')
  @UseGuards(JwtAuthGuard)
  async getPourcentage5MParLigneQuery(@Query('semaine') semaine: string) {
    return this.statsService.getPourcentage5MParLigne(semaine);
  }

  // Routes pour stats par date
  
  @Post('par-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsParDate(@Body() getStatsDateDto: GetStatsDateDto) {
    return this.statsService.getStatsParDate(getStatsDateDto);
  }

  @Get('par-date')
  @UseGuards(JwtAuthGuard)
  async getStatsParDateQuery(@Query('date') date: string) {
    const dto = new GetStatsDateDto();
    dto.date = date;
    return this.statsService.getStatsParDate(dto);
  }

  @Post('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getRapportsSaisieParDate(@Body() getStatsDateDto: GetStatsDateDto) {
    return this.statsService.getRapportsSaisieParDate(getStatsDateDto);
  }

  @Get('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  async getRapportsSaisieParDateQuery(@Query('date') date: string) {
    const dto = new GetStatsDateDto();
    dto.date = date;
    return this.statsService.getRapportsSaisieParDate(dto);
  }

  // ✅ NOUVELLES ROUTES - PCS par mois pour toute l'année
  
  /**
   * Obtenir le PCS par mois pour toutes les lignes d'une année
   * POST /stats/pcs-par-mois
   * Body: { "date": "2026-01-15" }
   */
  @Post('pcs-par-mois')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsPcsParMois(@Body() getStatsAnnuelDto: GetStatsAnnuelDto) {
    return this.statsService.getStatsPcsParMoisEtLigne(getStatsAnnuelDto);
  }

  /**
   * Version GET avec query param
   * GET /stats/pcs-par-mois?date=2026-01-15
   */
  @Get('pcs-par-mois')
  @UseGuards(JwtAuthGuard)
  async getStatsPcsParMoisQuery(@Query('date') date: string) {
    // ✅ CORRECTION : Valider que date existe
    if (!date) {
      throw new BadRequestException('Le paramètre "date" est obligatoire');
    }

    // Valider le format de la date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Le format de date doit être YYYY-MM-DD (ex: 2026-01-15)');
    }

    const dto = new GetStatsAnnuelDto();
    dto.date = date;
    return this.statsService.getStatsPcsParMoisEtLigne(dto);
  }
  @Post('5m-par-mois')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@HttpCode(HttpStatus.OK)
async getStats5MParMois(@Body() getStatsAnnuelDto: GetStatsAnnuelDto) {
  return this.statsService.getStats5MParMois(getStatsAnnuelDto);
}
@Post('affectation-personnel')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@HttpCode(HttpStatus.OK)
async getAffectationPersonnel(@Body() dto: GetAffectationPersonnelDto) {
  return this.statsService.getAffectationPersonnel(dto.semaine);
}

/**
 * Version GET avec query param
 * GET /stats/affectation-personnel?semaine=semaine5
 */
@Get('affectation-personnel')
@UseGuards(JwtAuthGuard)
async getAffectationPersonnelQuery(@Query('semaine') semaine: string) {
  if (!semaine) {
    throw new BadRequestException('Le paramètre "semaine" est obligatoire');
  }
  return this.statsService.getAffectationPersonnel(semaine);
}
}