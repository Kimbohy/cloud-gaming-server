import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RomsService } from './roms.service';
import { CreateRomDto } from './dto/create-rom.dto';
import { UpdateRomDto } from './dto/update-rom.dto';

@Controller('roms')
export class RomsController {
  constructor(private readonly romsService: RomsService) {}

  @Post()
  create(@Body() createRomDto: CreateRomDto) {
    return this.romsService.create(createRomDto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/roms',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(
            null,
            file.fieldname + '-' + uniqueSuffix + extname(file.originalname),
          );
        },
      }),
    }),
  )
  async uploadRom(
    @UploadedFile() file: any,
    @Body() createRomDto: Partial<CreateRomDto>,
  ) {
    return this.romsService.uploadRom(file, createRomDto);
  }

  @Get()
  findAll() {
    return this.romsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.romsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRomDto: UpdateRomDto) {
    return this.romsService.update(id, updateRomDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.romsService.remove(id);
  }
}
