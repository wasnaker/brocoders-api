import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsNumber } from 'class-validator';
import { Roles } from './roles.decorator';
import { RoleEnum } from './roles.enum';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { NullableType } from '../utils/types/nullable.type';

class UpdatePermissionsDto {
  @ApiProperty()
  @IsArray()
  @IsNumber(undefined, { each: true })
  permissionIds: number[];
}

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Roles')
@Controller({
  path: 'roles',
  version: '1',
})
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOkResponse({
    type: [RoleEntity],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<RoleEntity[]> {
    return this.rolesService.findAll();
  }

  @ApiOkResponse({
    type: RoleEntity,
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @Get(':id')
  async findOne(
    @Param('id') id: RoleEntity['id'],
  ): Promise<NullableType<RoleEntity> | null> {
    return this.rolesService.findById(id);
  }

  @ApiOkResponse({
    type: RoleEntity,
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('id') id: RoleEntity['id'],
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ): Promise<RoleEntity | null> {
    return this.rolesService.updatePermissions(
      id,
      updatePermissionsDto.permissionIds,
    );
  }
}