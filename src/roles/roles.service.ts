import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { NullableType } from '../utils/types/nullable.type';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
  ) {}

  async findAll(): Promise<RoleEntity[]> {
    return this.rolesRepository.find({
      relations: ['permissions'],
    });
  }

  async findById(id: RoleEntity['id']): Promise<NullableType<RoleEntity> | null> {
    return this.rolesRepository.findOne({
      where: { id: Number(id) },
      relations: ['permissions'],
    });
  }

  async updatePermissions(
    id: RoleEntity['id'],
    permissionIds: number[],
  ): Promise<RoleEntity | null> {
    const role = await this.rolesRepository.findOne({
      where: { id: Number(id) },
    });

    if (!role) {
      return null;
    }

    // TypeORM 0.3 only supports set() for many-to-one/one-to-one, so a
    // many-to-many replace has to be an explicit diff. Using add() alone
    // would only ever append and leave revoked permissions in place.
    const current = await this.rolesRepository
      .createQueryBuilder()
      .relation(RoleEntity, 'permissions')
      .of(Number(id))
      .loadMany();

    const currentIds = current.map((permission) => permission.id);
    const nextIds = [...new Set(permissionIds.map(Number))];
    const toRemove = currentIds.filter(
      (permissionId) => !nextIds.includes(permissionId),
    );
    const toAdd = nextIds.filter(
      (permissionId) => !currentIds.includes(permissionId),
    );

    if (toRemove.length) {
      await this.rolesRepository
        .createQueryBuilder()
        .relation(RoleEntity, 'permissions')
        .of(Number(id))
        .remove(toRemove);
    }

    if (toAdd.length) {
      await this.rolesRepository
        .createQueryBuilder()
        .relation(RoleEntity, 'permissions')
        .of(Number(id))
        .add(toAdd);
    }

    return this.findById(id);
  }
}