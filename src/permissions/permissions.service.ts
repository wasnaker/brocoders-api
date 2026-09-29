import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { NullableType } from '../utils/types/nullable.type';
import { QueryPermissionDto, FilterPermissionDto, SortPermissionDto } from './dto/query-permission.dto';
import { PermissionRepository } from './infrastructure/persistence/permission.repository';
import { Permission } from './domain/permission';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionRepository) {}

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const permissionObject = await this.permissionsRepository.findByName(
      createPermissionDto.name,
    );

    if (permissionObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          name: 'permissionNameAlreadyExists',
        },
      });
    }

    return this.permissionsRepository.create({
      ...createPermissionDto,
    });
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPermissionDto | null;
    sortOptions?: SortPermissionDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Permission[]> {
    return this.permissionsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  async findById(id: Permission['id']): Promise<NullableType<Permission>> {
    return this.permissionsRepository.findById(id);
  }

  async findByName(name: string): Promise<NullableType<Permission>> {
    return this.permissionsRepository.findByName(name);
  }

  async update(
    id: Permission['id'],
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission | null> {
    const permission = await this.permissionsRepository.findById(id);

    if (!permission) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          permission: 'permissionNotExists',
        },
      });
    }

    if (updatePermissionDto.name) {
      const permissionObject = await this.permissionsRepository.findByName(
        updatePermissionDto.name,
      );

      if (permissionObject && permissionObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            name: 'permissionNameAlreadyExists',
          },
        });
      }
    }

    return this.permissionsRepository.update(id, {
      ...updatePermissionDto,
    });
  }

  async remove(id: Permission['id']): Promise<void> {
    await this.permissionsRepository.remove(id);
  }
}
