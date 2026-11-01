import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Regency } from '../../domain/regency';

import { FilterRegencyDto, SortRegencyDto } from '../../dto/query-regency.dto';

export abstract class RegencyRepository {
  abstract create(
    data: Omit<Regency, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Regency>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegencyDto | null;
    sortOptions?: SortRegencyDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Regency[]>;

  abstract findAll(): Promise<Regency[]>;

  abstract findById(id: Regency['id']): Promise<NullableType<Regency>>;

  abstract findByProvinceId(
    provinceId: Regency['provinceId'],
  ): Promise<Regency[]>;

  abstract countByProvinceId(
    provinceId: Regency['provinceId'],
  ): Promise<number>;

  abstract countAll(): Promise<number>;

  abstract update(
    id: Regency['id'],
    payload: DeepPartial<Regency>,
  ): Promise<Regency | null>;

  abstract remove(id: Regency['id']): Promise<void>;

  abstract removeByProvinceId(provinceId: Regency['provinceId']): Promise<void>;
}
