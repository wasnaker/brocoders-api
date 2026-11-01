import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsLatitude, IsLongitude } from 'class-validator';

export class CreateProvinceDto {
  @ApiProperty({ example: 'Jawa Barat', maxLength: 190 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(190)
  name: string;

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
