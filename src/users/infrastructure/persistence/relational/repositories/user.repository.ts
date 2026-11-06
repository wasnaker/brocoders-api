import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Brackets, FindOptionsWhere, MoreThanOrEqual, Repository, In } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

const USER_ROLE_RELATIONS = ['role.permissions', 'roles.permissions'];

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: User): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data);
    const newEntity = await this.usersRepository.save(
      this.usersRepository.create(persistenceModel),
    );
    const created = await this.findById(newEntity.id);
    return created ?? UserMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    const where: FindOptionsWhere<UserEntity> = {};
    if (filterOptions?.roles?.length) {
      where.roles = filterOptions.roles.map((role) => ({
        id: Number(role.id),
      })) as any;
    }

    const entities = await this.usersRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      relations: USER_ROLE_RELATIONS,
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ),
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async searchForImpersonation(input: { query: string; page: number; limit: number }): Promise<{ data: User[]; total: number }> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.status', 'status')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermissions')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'rolePermissionsMany')
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('user.lastName', 'ASC')
      .addOrderBy('user.id', 'ASC');

    if (input.query.trim()) {
      const term = `%${input.query.trim()}%`;
      query.andWhere(new Brackets((where) => {
        where
          .where('user.email ILIKE :term', { term })
          .orWhere('user.firstName ILIKE :term', { term })
          .orWhere('user.lastName ILIKE :term', { term })
          .orWhere("CONCAT(COALESCE(user.firstName, ''), ' ', COALESCE(user.lastName, '')) ILIKE :term", { term });
      }));
    }

    const [entities, total] = await query
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();

    return { data: entities.map((user) => UserMapper.toDomain(user)), total };
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
      relations: USER_ROLE_RELATIONS,
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
      relations: USER_ROLE_RELATIONS,
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async countAll(): Promise<number> {
    // count() bawaan TypeORM memakai withDeleted: false, jadi user yang
    // soft-deleted otomatis tidak ikut dihitung — sama dengan findManyWithPagination.
    return this.usersRepository.count();
  }

  async countCreatedSince(date: Date): Promise<number> {
    return this.usersRepository.count({
      where: { createdAt: MoreThanOrEqual(date) },
    });
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email },
      relations: USER_ROLE_RELATIONS,
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    if (!socialId || !provider) return null;

    const entity = await this.usersRepository.findOne({
      where: { socialId, provider },
      relations: USER_ROLE_RELATIONS,
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
      relations: USER_ROLE_RELATIONS,
    });

    if (!entity) {
      throw new Error('User not found');
    }

    const definedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as Partial<User>;

    const updatedEntity = await this.usersRepository.save(
      this.usersRepository.create(
        UserMapper.toPersistence({
          ...UserMapper.toDomain(entity),
          ...definedPayload,
        }),
      ),
    );

    const updated = await this.findById(updatedEntity.id);
    return updated ?? UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}
