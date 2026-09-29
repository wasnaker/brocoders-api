import {
  Controller,
  Get,
  Query,
  Patch,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SettingsService } from './settings.service';
import { SettingEntity } from './infrastructure/persistence/relational/entities/setting.entity';
import { UpsertSettingItem } from './settings.service';

class UpsertSettingsDto {
  @IsArray()
  items: UpsertSettingItem[];
}

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Settings')
@Controller({
  path: 'settings',
  version: '1',
})
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOkResponse({
    type: [SettingEntity],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('group') group?: string,
  ): Promise<SettingEntity[]> {
    if (group) {
      return this.settingsService.findByGroup(group);
    }
    return this.settingsService.findAll();
  }

  @ApiOkResponse({
    type: Boolean,
  })
  @HttpCode(HttpStatus.OK)
  @Patch()
  async upsert(
    @Body() body: UpsertSettingsDto,
  ): Promise<{ success: true }> {
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    await this.settingsService.upsertMany(body.items);
    return { success: true };
  }
}