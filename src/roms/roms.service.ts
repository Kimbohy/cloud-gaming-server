import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RomsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadRom(romName: string = 'default') {
    const response = await this.prisma.roms.create({
      data: {
        name: romName,
        filePath: `/path/to/roms/${romName}`,
      },
    });
    return response;
  }
}
