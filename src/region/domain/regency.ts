import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RegencyTypeEnum {
  KABUPATEN = 'kabupaten',
  KOTA = 'kota',
}

export const REGENCY_TYPES = [
  { value: RegencyTypeEnum.KABUPATEN, label: 'Kabupaten' },
  { value: RegencyTypeEnum.KOTA, label: 'Kota' },
];

export class Regency {
  @ApiProperty({ example: 1 })
  id: number | string;

  @ApiProperty({ example: 1 })
  provinceId: number | string;

  @ApiProperty({ example: 'Bandung' })
  name: string;

  @ApiProperty({ example: 'kota' })
  type: RegencyTypeEnum;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional()
  createdAt: Date;

  @ApiPropertyOptional()
  updatedAt: Date;
}