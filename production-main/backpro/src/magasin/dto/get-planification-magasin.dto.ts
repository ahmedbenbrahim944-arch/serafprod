import { IsString, IsNotEmpty } from 'class-validator';

export class GetPlanificationMagasinDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;
}