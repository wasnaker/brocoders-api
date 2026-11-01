import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateProvinceDto } from './create-province.dto';

export class UpdateProvinceDto extends PartialType(CreateProvinceDto) {
  @ApiPropertyOptional({ example: 'Jawa Barat', maxLength: 190 })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  name?: string;

  @ApiPropertyOptional({ example: 'JB', maxLength: 10, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  isoCode?: string | null;

  @ApiPropertyOptional({ example: -6.9, nullable: true })
  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional({ example: 107.6, nullable: true })
  @IsOptional()
  @IsLongitude()
  longitude?: number | null;
}