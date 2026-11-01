import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { ProvinceEntity } from '../entities/province.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterProvinceDto,
  SortProvinceDto,
} from '../../../../dto/query-province.dto';
import { Province } from '../../../../domain/province';
import { ProvinceRepository } from '../../province.repository';
import { ProvinceMapper } from '../mappers/province.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProvincesRelationalRepository implements ProvinceRepository {
  constructor(
    @InjectRepository(ProvinceEntity)
    private readonly provinceRepository: Repository<ProvinceEntity>,
  ) {}

  async create(data: Province): Promise<Province> {
    const persistenceModel = ProvinceMapper.toPersistence(data);
    const newEntity = await this.provinceRepository.save(
      this.provinceRepository.create(persistenceModel),
    );
    return ProvinceMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProvinceDto | null;
    sortOptions?: SortProvinceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Province[]> {
    const where: FindOptionsWhere<ProvinceEntity> = {};
    if (filterOptions?.search) {
      where.name = ILike(`%${filterOptions.search}%`);
    }

    const entities = await this.provinceRepository.find({
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

    return entities.map((province) => ProvinceMapper.toDomain(province));
  }

  async findAll(): Promise<Province[]> {
    const entities = await this.provinceRepository.find({
      order: { name: 'ASC' },
    });
    return entities.map((province) => ProvinceMapper.toDomain(province));
  }

  async findById(id: Province['id']): Promise<NullableType<Province>> {
    const entity = await this.provinceRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? ProvinceMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<NullableType<Province>> {
    const entity = await this.provinceRepository.findOne({
      where: { name },
    });
    return entity ? ProvinceMapper.toDomain(entity) : null;
  }

  async findByIsoCode(
    isoCode: Province['isoCode'],
  ): Promise<NullableType<Province>> {
    if (!isoCode) return null;
    const entity = await this.provinceRepository.findOne({
      where: { isoCode },
    });
    return entity ? ProvinceMapper.toDomain(entity) : null;
  }

  async countAll(): Promise<number> {
    return this.provinceRepository.count();
  }

  async update(
    id: Province['id'],
    payload: Partial<Province>,
  ): Promise<Province> {
    const entity = await this.provinceRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Province not found');
    }

    const updatedEntity = await this.provinceRepository.save(
      this.provinceRepository.create(
        ProvinceMapper.toPersistence({
          ...ProvinceMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProvinceMapper.toDomain(updatedEntity);
  }

  async remove(id: Province['id']): Promise<void> {
    await this.provinceRepository.delete(Number(id));
  }
}
