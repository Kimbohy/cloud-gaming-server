import { Module, Post } from '@nestjs/common';
import { RomsController } from './roms.controller';

@Module({
  controllers: [RomsController],
})
export class RomsModule {
  @Post('upload')
  uploadRom() {}
}
