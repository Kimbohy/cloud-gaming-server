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

  async uploadRom(
    files: { rom?: Express.Multer.File[]; image?: Express.Multer.File[] },
    createRomDto: Partial<CreateRomDto>,
  ) {
    const romFile = files.rom?.[0];
    const imageFile = files.image?.[0];

    if (!romFile) {
      throw new Error('ROM file is required');
    }

    const filePath = `/uploads/roms/${romFile.filename}`;
    const imagePath = imageFile
      ? `/uploads/images/${imageFile.filename}`
      : undefined;

    const rom = await this.prisma.roms.create({
      data: {
        name: createRomDto.name || romFile.originalname,
        console: createRomDto.console || 'GBA',
        filePath,
        imagePath,
        description: createRomDto.description,
      },
    });
    return rom;
  }
}
