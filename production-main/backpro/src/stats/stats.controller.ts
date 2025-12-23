// stats.controller.ts - VERSION MISE À JOUR
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
  Query
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { GetStatsDto } from './dto/get-stats.dto';
import { GetStatsLignesDto } from './dto/get-stats-lignes.dto';
import { GetStatsSemaineDto } from './dto/get-stats-semaine.dto';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  // ✅ NOUVELLES ROUTES - L'utilisateur envoie SEULEMENT la date
  
  /**
   * Obtenir les statistiques complètes pour une date
   * POST /stats/par-date
   * Body: { "date": "2025-12-02" }
   */
  @Post('par-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsParDate(@Body() getStatsDateDto: GetStatsDateDto) {
    return this.statsService.getStatsParDate(getStatsDateDto);
  }

  /**
   * Version GET avec query param
   * GET /stats/par-date?date=2025-12-02
   */
  @Get('par-date')
  @UseGuards(JwtAuthGuard)
  async getStatsParDateQuery(@Query('date') date: string) {
    const dto = new GetStatsDateDto();
    dto.date = date;
    return this.statsService.getStatsParDate(dto);
  }

  /**
   * Obtenir uniquement les rapports de saisie pour une date
   * POST /stats/rapports-saisie-date
   * Body: { "date": "2025-12-02" }
   */
  @Post('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getRapportsSaisieParDate(@Body() getStatsDateDto: GetStatsDateDto) {
    return this.statsService.getRapportsSaisieParDate(getStatsDateDto);
  }

  /**
   * Version GET
   * GET /stats/rapports-saisie-date?date=2025-12-02
   */
  @Get('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  async getRapportsSaisieParDateQuery(@Query('date') date: string) {
    const dto = new GetStatsDateDto();
    dto.date = date;
    return this.statsService.getRapportsSaisieParDate(dto);
  }
}