import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ConsoleType } from '@prisma/client';

export class CreateRomDto {
  @IsString()
  name: string;

  @IsEnum(ConsoleType)
  @IsOptional()
  console?: ConsoleType;

  @IsString()
  filePath: string;

  @IsString()
  @IsOptional()
  imagePath?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
