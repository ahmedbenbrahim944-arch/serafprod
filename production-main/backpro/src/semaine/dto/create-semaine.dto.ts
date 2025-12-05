// src/semaine/dto/create-semaine.dto.ts
import { IsString, IsNotEmpty, IsDateString, Matches } from 'class-validator';

export class CreateSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  @Matches(/^semaine[0-9]{1,2}$/, { 
    message: 'Le nom de la semaine doit être au format "semaineXX" (ex: semaine47, semaine48)' 
  })
  nom: string;

  @IsDateString()
  @IsNotEmpty({ message: 'La date de début est obligatoire' })
  dateDebut: string;

  @IsDateString()
  @IsNotEmpty({ message: 'La date de fin est obligatoire' })
  dateFin: string;
}