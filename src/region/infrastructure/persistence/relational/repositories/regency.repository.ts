import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FindOptionsWhere, Repository } from 'typeorm';
import { RegencyEntity } from '../entities/regency.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterRegencyDto,
  SortRegencyDto,
} from '../../../../dto/query-regency.dto';
import { Regency } from '../../../../domain/regency';
import { RegencyRepository } from '../../regency.repository';
import { RegencyMapper } from '../mappers/regency.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class RegenciesRelationalRepository implements RegencyRepository {
  constructor(
    @InjectRepository(RegencyEntity)
    private readonly regencyRepository: Repository<RegencyEntity>,
  ) {}

  async create(data: Regency): Promise<Regency> {
    const persistenceModel = RegencyMapper.toPersistence(data);
    const newEntity = await this.regencyRepository.save(
      this.regencyRepository.create(persistenceModel),
    );
    return RegencyMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegencyDto | null;
    sortOptions?: SortRegencyDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Regency[]> {
    const where: FindOptionsWhere<RegencyEntity> =
      this.buildWhere(filterOptions);

    const entities = await this.regencyRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        { name: 'ASC' },
      ),
    });

    return entities.map((regency) => RegencyMapper.toDomain(regency));
  }

  async findAll(): Promise<Regency[]> {
    const entities = await this.regencyRepository.find({
      order: { name: 'ASC' },
    });
    return entities.map((regency) => RegencyMapper.toDomain(regency));
  }

  async findById(id: Regency['id']): Promise<NullableType<Regency>> {
    const entity = await this.regencyRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? RegencyMapper.toDomain(entity) : null;
  }

  async findByProvinceId(
    provinceId: Regency['provinceId'],
  ): Promise<Regency[]> {
    const entities = await this.regencyRepository.find({
      where: { provinceId: Number(provinceId) },
      order: { name: 'ASC' },
    });
    return entities.map((regency) => RegencyMapper.toDomain(regency));
  }

  async countByProvinceId(provinceId: Regency['provinceId']): Promise<number> {
    return this.regencyRepository.count({
      where: { provinceId: Number(provinceId) },
    });
  }

  async countAll(): Promise<number> {
    return this.regencyRepository.count();
  }

  async update(id: Regency['id'], payload: Partial<Regency>): Promise<Regency> {
    const entity = await this.regencyRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Regency not found');
    }

    const updatedEntity = await this.regencyRepository.save(
      this.regencyRepository.create(
        RegencyMapper.toPersistence({
          ...RegencyMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return RegencyMapper.toDomain(updatedEntity);
  }

  async remove(id: Regency['id']): Promise<void> {
    await this.regencyRepository.delete(Number(id));
  }

  async removeByProvinceId(provinceId: Regency['provinceId']): Promise<void> {
    await this.regencyRepository.delete({ provinceId: Number(provinceId) });
  }

  private buildWhere(
    filterOptions?: FilterRegencyDto | null,
  ): FindOptionsWhere<RegencyEntity> {
    const where: FindOptionsWhere<RegencyEntity> = {};
    if (
      filterOptions?.provinceId !== undefined &&
      filterOptions.provinceId !== null
    ) {
      where.provinceId = Number(filterOptions.provinceId);
    }
    if (filterOptions?.type) {
      where.type = filterOptions.type;
    }
    return where;
  }
}
