import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdateProvinceDto } from '../dto/update-province.dto';
import { QueryProvinceDto } from '../dto/query-province.dto';
import { CreateRegencyDto } from '../dto/create-regency.dto';
import { UpdateRegencyDto } from '../dto/update-regency.dto';
import { QueryRegencyDto, FilterRegencyDto } from '../dto/query-regency.dto';
import { Province } from '../domain/province';
import { Regency } from '../domain/regency';
import { RegionService } from '../services/region.service';
import { NullableType } from '../../utils/types/nullable.type';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../roles/roles.decorator';
import { RoleEnum } from '../../roles/roles.enum';
import { RolesGuard } from '../../roles/roles.guard';
import { InfinityPaginationResponseDto, InfinityPaginationResponse } from '../../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../../utils/infinity-pagination';

// RBAC: write endpoints admin-only (@Roles + RolesGuard), read endpoints
// cukup AuthGuard('jwt') — sesuai konvensi host (lihat permissions.controller).

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@ApiTags('Region')
@Controller({ path: 'region', version: '1' })
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  // ─── Provinces ─────────────────────────────────────────────────────────────

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiCreatedResponse({ type: Province })
  @Post('provinces')
  @HttpCode(HttpStatus.CREATED)
  createProvince(
    @Body() createProvinceDto: CreateProvinceDto,
  ): Promise<Province> {
    return this.regionService.createProvince(createProvinceDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Province) })
  @Get('provinces')
  @HttpCode(HttpStatus.OK)
  async findAllProvinces(
    @Query() query: QueryProvinceDto,
  ): Promise<InfinityPaginationResponseDto<Province>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.regionService.findManyProvincesWithPagination({
        filterOptions: query.filters ?? null,
        sortOptions: query.sort ?? null,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({ type: Province })
  @Get('provinces/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOneProvince(
    @Param('id', ParseIntPipe) id: Province['id'],
  ): Promise<NullableType<Province>> {
    return this.regionService.findProvinceById(id);
  }

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiOkResponse({ type: Province })
  @Patch('provinces/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  updateProvince(
    @Param('id', ParseIntPipe) id: Province['id'],
    @Body() updateProvinceDto: UpdateProvinceDto,
  ): Promise<Province> {
    return this.regionService.updateProvince(id, updateProvinceDto);
  }

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Delete('provinces/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  removeProvince(
    @Param('id', ParseIntPipe) id: Province['id'],
  ): Promise<void> {
    return this.regionService.removeProvince(id);
  }

  // ─── Regencies ─────────────────────────────────────────────────────────────

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiCreatedResponse({ type: Regency })
  @Post('regencies')
  @HttpCode(HttpStatus.CREATED)
  createRegency(
    @Body() createRegencyDto: CreateRegencyDto,
  ): Promise<Regency> {
    return this.regionService.createRegency(createRegencyDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Regency) })
  @Get('regencies')
  @HttpCode(HttpStatus.OK)
  async findAllRegencies(
    @Query() query: QueryRegencyDto,
  ): Promise<InfinityPaginationResponseDto<Regency>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    // Normalize filter options: merge convenience ?province_id= with filters JSON
    const filterOptions: FilterRegencyDto | null = query.filters ?? {};
    if (filterOptions) {
      if (query.provinceId !== undefined) {
        filterOptions.provinceId = query.provinceId;
      }
    }

    return infinityPagination(
      await this.regionService.findManyRegenciesWithPagination({
        filterOptions,
        sortOptions: query.sort ?? null,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({ type: Regency })
  @Get('regencies/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOneRegency(
    @Param('id', ParseIntPipe) id: Regency['id'],
  ): Promise<NullableType<Regency>> {
    return this.regionService.findRegencyById(id);
  }

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiOkResponse({ type: Regency })
  @Patch('regencies/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  updateRegency(
    @Param('id', ParseIntPipe) id: Regency['id'],
    @Body() updateRegencyDto: UpdateRegencyDto,
  ): Promise<Regency> {
    return this.regionService.updateRegency(id, updateRegencyDto);
  }

  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @Delete('regencies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  removeRegency(
    @Param('id', ParseIntPipe) id: Regency['id'],
  ): Promise<void> {
    return this.regionService.removeRegency(id);
  }
}
