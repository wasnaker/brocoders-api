import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Regency, RegencyTypeEnum } from '../domain/regency';

export class CreateRegencyDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNotEmpty()
  provinceId: Regency['provinceId'];

  @ApiProperty({ example: 'Bandung', maxLength: 190 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(190)
  name: string;

  @ApiProperty({ example: 'kota', enum: RegencyTypeEnum })
  @IsNotEmpty()
  @IsEnum(RegencyTypeEnum)
  type: RegencyTypeEnum;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
