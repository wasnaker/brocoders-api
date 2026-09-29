import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../entities/permission.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterPermissionDto, SortPermissionDto } from '../../../../dto/query-permission.dto';
import { Permission } from '../../../../domain/permission';
import { PermissionRepository } from '../../permission.repository';
import { PermissionMapper } from '../mappers/permission.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class PermissionsRelationalRepository implements PermissionRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepository: Repository<PermissionEntity>,
  ) {}

  async create(data: Omit<Permission, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>): Promise<Permission> {
    const persistenceModel = PermissionMapper.toPersistence(data as Permission);
    const newEntity = await this.permissionsRepository.save(
      this.permissionsRepository.create(persistenceModel),
    );
    return PermissionMapper.toDomain(newEntity);
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
    const order: Record<string, 'ASC' | 'DESC'> = {};
    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        if (sort.id) order.id = sort.id;
        if (sort.name) order.name = sort.name;
      });
    }

    const entities = await this.permissionsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order,
    });

    return entities.map((permission) => PermissionMapper.toDomain(permission));
  }

  async findById(id: Permission['id']): Promise<NullableType<Permission>> {
    const entity = await this.permissionsRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? PermissionMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<NullableType<Permission>> {
    const entity = await this.permissionsRepository.findOne({
      where: { name },
    });

    return entity ? PermissionMapper.toDomain(entity) : null;
  }

  async update(id: Permission['id'], payload: Partial<Permission>): Promise<Permission | null> {
    const entity = await this.permissionsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.permissionsRepository.save(
      this.permissionsRepository.create(
        PermissionMapper.toPersistence({
          ...PermissionMapper.toDomain(entity),
          ...payload,
        } as Permission),
      ),
    );

    return PermissionMapper.toDomain(updatedEntity);
  }

  async remove(id: Permission['id']): Promise<void> {
    await this.permissionsRepository.softDelete(id);
  }
}
