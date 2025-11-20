import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmulatorModule } from './emulator/emulator.module';

@Module({
  imports: [EmulatorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
