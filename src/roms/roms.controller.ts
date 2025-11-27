import { Controller, Post } from '@nestjs/common';

@Controller('roms')
export class RomsController {
  @Post('upload')
  async uploadRom() {
    // Logic to handle ROM upload
    return { message: 'ROM uploaded successfully' };
  }
}
