import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateRegencyDto } from './create-regency.dto';
import { Regency, RegencyTypeEnum } from '../domain/regency';

export class UpdateRegencyDto extends PartialType(CreateRegencyDto) {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  provinceId?: Regency['provinceId'];

  @ApiPropertyOptional({ example: 'Bandung', maxLength: 190 })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  name?: string;

  @ApiPropertyOptional({ example: 'kota', enum: RegencyTypeEnum })
  @IsOptional()
  @IsEnum(RegencyTypeEnum)
  type?: RegencyTypeEnum;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
