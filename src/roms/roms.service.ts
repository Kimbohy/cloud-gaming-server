import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRomDto } from './dto/create-rom.dto';
import { UpdateRomDto } from './dto/update-rom.dto';

@Injectable()
export class RomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRomDto: CreateRomDto) {
    return this.prisma.roms.create({
      data: createRomDto,
    });
  }

  async findAll() {
    return this.prisma.roms.findMany();
  }

  async findOne(id: string) {
    const rom = await this.prisma.roms.findUnique({
      where: { id },
    });
    if (!rom) {
      throw new NotFoundException(`ROM with ID ${id} not found`);
    }
    return rom;
  }

  async update(id: string, updateRomDto: UpdateRomDto) {
    try {
      return await this.prisma.roms.update({
        where: { id },
        data: updateRomDto,
      });
    } catch {
      throw new NotFoundException(`ROM with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.roms.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException(`ROM with ID ${id} not found`);
    }
  }

  async uploadRom(file: any, createRomDto: Partial<CreateRomDto>) {
    const filePath = `/uploads/roms/${file.filename}`;

    const rom = await this.prisma.roms.create({
      data: {
        name: createRomDto.name || file.originalname,
        console: createRomDto.console || 'GBA',
        filePath,
        imagePath: createRomDto.imagePath,
        description: createRomDto.description,
      },
    });
    return rom;
  }
}
