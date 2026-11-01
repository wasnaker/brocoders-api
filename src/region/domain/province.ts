import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Province {
  @ApiProperty({ example: 1 })
  id: number | string;

  @ApiProperty({ example: 'Jawa Barat' })
  name: string;

  @ApiProperty({ example: 'JB', nullable: true })
  isoCode: string | null;

  @ApiProperty({ example: -6.9, nullable: true })
  latitude: number | null;

  @ApiProperty({ example: 107.6, nullable: true })
  longitude: number | null;

  @ApiPropertyOptional()
  createdAt: Date;

  @ApiPropertyOptional()
  updatedAt: Date;
}
