// Modifications dans stats.controller.ts
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetStatsSemaineDto } from './dto/get-stats-semaine.dto';

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

  // Nouvelle route pour obtenir le PCS Prod Total par ligne
  @Post('lignes')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPcsProdTotalParLigne(@Body() getStatsLignesDto: GetStatsLignesDto) {
    const { semaine } = getStatsLignesDto;
    return this.statsService.getPcsProdTotalParLigne(semaine);
  }

  // Option: Version GET avec query params
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

// Option: Version GET avec query param
@Get('pourcentage-5m')
@UseGuards(JwtAuthGuard)
async getPourcentage5MParSemaineQuery(@Query('semaine') semaine: string) {
  return this.statsService.getStatsPourcentage5MParSemaine(semaine);
}
// Dans stats.controller.ts - Ajoute ces nouvelles routes

@Post('pourcentage-5m-ligne')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@HttpCode(HttpStatus.OK)
async getPourcentage5MParLigne(@Body() getStatsSemaineDto: GetStatsSemaineDto) {
  const { semaine } = getStatsSemaineDto;
  return this.statsService.getPourcentage5MParLigne(semaine);
}

// Option: Version GET avec query param
@Get('pourcentage-5m-ligne')
@UseGuards(JwtAuthGuard)
async getPourcentage5MParLigneQuery(@Query('semaine') semaine: string) {
  return this.statsService.getPourcentage5MParLigne(semaine);
}
}