import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Province } from '../../domain/province';

import { FilterProvinceDto, SortProvinceDto } from '../../dto/query-province.dto';

export abstract class ProvinceRepository {
  abstract create(
    data: Omit<Province, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Province>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProvinceDto | null;
    sortOptions?: SortProvinceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Province[]>;

  abstract findAll(): Promise<Province[]>;

  abstract findById(id: Province['id']): Promise<NullableType<Province>>;

  abstract findByName(name: string): Promise<NullableType<Province>>;

  abstract findByIsoCode(
    isoCode: Province['isoCode'],
  ): Promise<NullableType<Province>>;

  abstract countAll(): Promise<number>;

  abstract update(
    id: Province['id'],
    payload: DeepPartial<Province>,
  ): Promise<Province | null>;

  abstract remove(id: Province['id']): Promise<void>;
}