import { ApiProperty } from '@nestjs/swagger';

export class StatsSummaryDto {
  @ApiProperty({
    type: Number,
    example: 42,
    description: 'Total user terdaftar (soft-deleted tidak ikut dihitung)',
  })
  totalUsers: number;

  @ApiProperty({
    type: Number,
    example: 3,
    description: 'User yang dibuat dalam 7x24 jam terakhir',
  })
  newUsers7d: number;

  @ApiProperty({
    type: Number,
    example: 2,
    description: 'Total role terdaftar',
  })
  totalRoles: number;
}
