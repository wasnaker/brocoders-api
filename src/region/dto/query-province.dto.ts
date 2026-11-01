import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Province } from '../domain/province';

export class FilterProvinceDto {
  @ApiPropertyOptional({ example: 'jawa' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class SortProvinceDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Province;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryProvinceDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    try {
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  })
  @Type(() => FilterProvinceDto)
  filters?: FilterProvinceDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    try {
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  })
  @Type(() => SortProvinceDto)
  sort?: SortProvinceDto[] | null;
}