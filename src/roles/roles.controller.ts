import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { NullableType } from '../utils/types/nullable.type';

class UpdatePermissionDenyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

class UpdatePermissionsDto {
  @ApiProperty()
  @IsArray()
  @IsNumber(undefined, { each: true })
  permissionIds: number[];
}

type AuthenticatedRequest = Request & { user?: { id?: number | string } };

@ApiBearerAuth()
@Roles(1)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Roles')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOkResponse({ type: [RoleEntity] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<RoleEntity[]> {
    return this.rolesService.findAll();
  }

  @ApiOkResponse({ type: RoleEntity })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @Get(':id')
  async findOne(@Param('id') id: RoleEntity['id']): Promise<NullableType<RoleEntity> | null> {
    return this.rolesService.findById(id);
  }

  @ApiOkResponse({ type: RoleEntity })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('id') id: RoleEntity['id'],
    @Body() updatePermissionsDto: UpdatePermissionsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoleEntity | null> {
    const actorId = Number(request.user?.id);
    return this.rolesService.updatePermissions(
      id,
      updatePermissionsDto.permissionIds,
      Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
    );
  }

  @Patch(':id/permissions/:permissionId/deny')
  @HttpCode(HttpStatus.NO_CONTENT)
  async denyPermission(
    @Param('id') id: RoleEntity['id'],
    @Param('permissionId') permissionId: string,
    @Body() body: UpdatePermissionDenyDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const actorId = Number(request.user?.id);
    await this.rolesService.setPermissionDeny(
      id,
      Number(permissionId),
      Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
      body.reason ?? null,
    );
  }

  @Delete(':id/permissions/:permissionId/deny')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearPermissionDeny(
    @Param('id') id: RoleEntity['id'],
    @Param('permissionId') permissionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const actorId = Number(request.user?.id);
    await this.rolesService.clearPermissionDeny(
      id,
      Number(permissionId),
      Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
    );
  }
}
