import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class PermissionDto {
  @ApiProperty()
  @IsNumber()
  id: number | string;
}
