import { PartialType } from '@nestjs/mapped-types';
import { CreateRomDto } from './create-rom.dto';

export class UpdateRomDto extends PartialType(CreateRomDto) {}
