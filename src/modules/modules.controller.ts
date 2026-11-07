import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ModulesService } from './modules.service';
import { ModuleDto } from './dto/module.dto';

/**
 * Endpoint read-only untuk daftar modul terdaftar.
 *
 * SENGJA TIDAK memakai `RolesGuard` / `@Roles(1)`:
 * endpoint ini hanya MEMBACA konfigurasi statis dan tidak mengubah apa pun.
 * Membatasi ke admin akan mengembalikan 403 untuk user biasa yang
 * seharusnya juga bisa melihat daftar modul.
 *
 * JANGAN tambahkan `RolesGuard` "justru biar aman" — itu akan melanggar
 * keputusan desain yang sudah diambil.
 */
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@ApiTags('Modules')
@Controller({
  path: 'modules',
  version: '1',
})
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @ApiOkResponse({
    type: ModuleDto,
    isArray: true,
  })
  @Get('/')
  @HttpCode(HttpStatus.OK)
  findAll(): ModuleDto[] {
    return this.modulesService.findAll();
  }

  @ApiOkResponse({
    type: ModuleDto,
  })
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string): ModuleDto | null {
    return this.modulesService.findOne(id);
  }
}
