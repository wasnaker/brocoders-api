import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class SettingDto {
  @ApiProperty()
  @IsNumber()
  id: number | string;
}