import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdateProvinceDto } from '../dto/update-province.dto';
import { FilterProvinceDto, SortProvinceDto } from '../dto/query-province.dto';
import { CreateRegencyDto } from '../dto/create-regency.dto';
import { UpdateRegencyDto } from '../dto/update-regency.dto';
import { FilterRegencyDto, SortRegencyDto } from '../dto/query-regency.dto';
import { Province } from '../domain/province';
import { Regency } from '../domain/regency';
import { ProvinceRepository } from '../infrastructure/persistence/province.repository';
import { RegencyRepository } from '../infrastructure/persistence/regency.repository';
import { NullableType } from '../../utils/types/nullable.type';
import { IPaginationOptions } from '../../utils/types/pagination-options';

@Injectable()
export class RegionService {
  constructor(
    private readonly provinceRepository: ProvinceRepository,
    private readonly regencyRepository: RegencyRepository,
  ) {}

  // ─── Provinces ────────────────────────────────────────────────────────────

  async createProvince(
    createProvinceDto: CreateProvinceDto,
  ): Promise<Province> {
    const existing = await this.provinceRepository.findByName(
      createProvinceDto.name,
    );
    if (existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          name: 'provinceNameAlreadyExists',
        },
      });
    }

    return this.provinceRepository.create({
      name: createProvinceDto.name,
      isoCode: createProvinceDto.isoCode ?? null,
      latitude: createProvinceDto.latitude ?? null,
      longitude: createProvinceDto.longitude ?? null,
    });
  }

  async findManyProvincesWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProvinceDto | null;
    sortOptions?: SortProvinceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Province[]> {
    return this.provinceRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  async findProvinceById(id: Province['id']): Promise<NullableType<Province>> {
    return this.provinceRepository.findById(id);
  }

  async findProvinceByIsoCode(
    isoCode: Province['isoCode'],
  ): Promise<NullableType<Province>> {
    return this.provinceRepository.findByIsoCode(isoCode);
  }

  async updateProvince(
    id: Province['id'],
    updateProvinceDto: UpdateProvinceDto,
  ): Promise<Province> {
    const province = await this.provinceRepository.findById(id);
    if (!province) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          province: 'provinceNotExists',
        },
      });
    }

    if (updateProvinceDto.name) {
      const existing = await this.provinceRepository.findByName(
        updateProvinceDto.name,
      );
      if (existing && existing.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            name: 'provinceNameAlreadyExists',
          },
        });
      }
    }

    const updated = await this.provinceRepository.update(id, {
      ...updateProvinceDto,
    });
    if (!updated) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          province: 'provinceNotExists',
        },
      });
    }
    return updated;
  }

  async removeProvince(id: Province['id']): Promise<void> {
    const province = await this.provinceRepository.findById(id);
    if (!province) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          province: 'provinceNotExists',
        },
      });
    }

    // Cascade: remove all regencies belonging to this province first
    await this.regencyRepository.removeByProvinceId(id);
    await this.provinceRepository.remove(id);
  }

  async countAllProvinces(): Promise<number> {
    return this.provinceRepository.countAll();
  }

  // ─── Regencies ─────────────────────────────────────────────────────────────

  async createRegency(createRegencyDto: CreateRegencyDto): Promise<Regency> {
    const province = await this.provinceRepository.findById(
      createRegencyDto.provinceId,
    );
    if (!province) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          province: 'provinceNotExists',
        },
      });
    }

    return this.regencyRepository.create({
      provinceId: createRegencyDto.provinceId,
      name: createRegencyDto.name,
      type: createRegencyDto.type,
      isActive: createRegencyDto.isActive ?? true,
    });
  }

  async findManyRegenciesWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegencyDto | null;
    sortOptions?: SortRegencyDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Regency[]> {
    return this.regencyRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  async findRegenciesByProvinceId(
    provinceId: Regency['provinceId'],
  ): Promise<Regency[]> {
    return this.regencyRepository.findByProvinceId(provinceId);
  }

  async findRegencyById(id: Regency['id']): Promise<NullableType<Regency>> {
    return this.regencyRepository.findById(id);
  }

  async updateRegency(
    id: Regency['id'],
    updateRegencyDto: UpdateRegencyDto,
  ): Promise<Regency> {
    const regency = await this.regencyRepository.findById(id);
    if (!regency) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          regency: 'regencyNotExists',
        },
      });
    }

    if (updateRegencyDto.provinceId !== undefined) {
      const province = await this.provinceRepository.findById(
        updateRegencyDto.provinceId,
      );
      if (!province) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            province: 'provinceNotExists',
          },
        });
      }
    }

    const updated = await this.regencyRepository.update(id, {
      ...updateRegencyDto,
    });
    if (!updated) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          regency: 'regencyNotExists',
        },
      });
    }
    return updated;
  }

  async removeRegency(id: Regency['id']): Promise<void> {
    const regency = await this.regencyRepository.findById(id);
    if (!regency) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          regency: 'regencyNotExists',
        },
      });
    }

    await this.regencyRepository.remove(id);
  }

  async countAllRegencies(): Promise<number> {
    return this.regencyRepository.countAll();
  }

  async countRegenciesByProvinceId(
    provinceId: Regency['provinceId'],
  ): Promise<number> {
    return this.regencyRepository.countByProvinceId(provinceId);
  }
}