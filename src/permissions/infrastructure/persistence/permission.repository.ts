import { NullableType } from '../../../utils/types/nullable.type';
import { FilterPermissionDto, SortPermissionDto } from '../../dto/query-permission.dto';
import { Permission } from '../../domain/permission';
import { IPaginationOptions } from '../../../utils/types/pagination-options';

export abstract class PermissionRepository {
  abstract create(
    data: Omit<Permission, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Permission>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPermissionDto | null;
    sortOptions?: SortPermissionDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Permission[]>;

  abstract findById(id: Permission['id']): Promise<NullableType<Permission>>;
  abstract findByName(name: string): Promise<NullableType<Permission>>;
  abstract update(
    id: Permission['id'],
    payload: Partial<Permission>,
  ): Promise<Permission | null>;
  abstract remove(id: Permission['id']): Promise<void>;
}
