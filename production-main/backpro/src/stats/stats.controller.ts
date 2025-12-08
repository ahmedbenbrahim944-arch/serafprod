// src/stats/stats.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  UsePipes, 
  ValidationPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { GetStatsDto } from './dto/get-stats.dto';
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
}