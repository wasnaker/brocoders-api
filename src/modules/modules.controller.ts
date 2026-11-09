import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ModulesService } from './modules.service';
import { ModuleDto } from './dto/module.dto';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { ModuleLifecycleService } from '../module-runtime/module-lifecycle.service';
import { BACKEND_MODULE_MANIFESTS } from '../module-runtime/module-manifest.registry';

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
  constructor(
    private readonly modulesService: ModulesService,
    private readonly lifecycle: ModuleLifecycleService,
  ) {}

  @ApiOkResponse({
    type: ModuleDto,
    isArray: true,
  })
  @Get('/')
  @HttpCode(HttpStatus.OK)
  findAll(): ModuleDto[] {
    return this.modulesService.findAll();
  }

  /** Lifecycle controls are restricted to administrators; read-only module
   * discovery above remains available to every authenticated user. */
  @Get('/lifecycle')
  @UseGuards(RolesGuard)
  @Roles(1)
  @HttpCode(HttpStatus.OK)
  listLifecycleStates() {
    return this.lifecycle.listStates();
  }

  /** Minimal authenticated status feed used to suppress inactive frontend contributions. */
  @Get('/active')
  @HttpCode(HttpStatus.OK)
  async findActiveModules(): Promise<Array<{ moduleId: string }>> {
    const states = await this.lifecycle.listStates();
    return states
      .filter((item) => item.status === 'active')
      .map((item) => ({ moduleId: item.moduleId }));
  }

  @Post('/:id/install')
  @UseGuards(RolesGuard)
  @Roles(1)
  @HttpCode(HttpStatus.OK)
  async install(@Param('id') id: string) {
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === id);
    if (!manifest) return null;
    return this.lifecycle.install(
      id,
      `@wasnaker/module-${id}`,
      manifest.version,
    );
  }

  @Post('/:id/activate')
  @UseGuards(RolesGuard)
  @Roles(1)
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string) {
    return this.lifecycle.activate(id);
  }

  @Post('/:id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(1)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.lifecycle.deactivate(id);
  }

  @Post('/:id/uninstall')
  @UseGuards(RolesGuard)
  @Roles(1)
  @HttpCode(HttpStatus.OK)
  uninstall(@Param('id') id: string) {
    return this.lifecycle.uninstall(id);
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
