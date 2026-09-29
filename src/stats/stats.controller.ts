import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { StatsService } from './stats.service';
import { StatsSummaryDto } from './dto/stats-summary.dto';

/**
 * Ringkasan statistik untuk KPI dashboard.
 *
 * Admin-only, sama seperti halaman dashboard yang admin-only di frontend
 * (`withPageRequiredAuth(..., { roles: [RoleEnum.ADMIN] })`), supaya tile KPI
 * tidak pernah muncul untuk user tanpa hak akses yang sama.
 *
 * Endpoint ini read-only agregat dan sengaja terpisah dari `/v1/users` dan
 * `/v1/permissions`: menambah `total` ke `InfinityPaginationResponseDto`
 * akan mengubah SEMUA response list di frontend, sementara di sini cukup
 * satu objek baru.
 */
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Stats')
@Controller({
  path: 'stats',
  version: '1',
})
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @ApiOkResponse({
    type: StatsSummaryDto,
  })
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async summary(): Promise<StatsSummaryDto> {
    return this.statsService.summary();
  }
}
