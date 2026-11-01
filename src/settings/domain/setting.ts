import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class Setting {
  @Allow()
  @ApiProperty({ type: Number })
  id: number | string;

  @Allow()
  @ApiProperty({ type: String, example: 'general.appName' })
  key: string;

  @Allow()
  @ApiProperty({ type: String })
  value: string;

  @Allow()
  @ApiProperty({ type: String, example: 'text' })
  type: string;

  @Allow()
  @ApiProperty({ type: String, example: 'general' })
  group: string;

  @Allow()
  @ApiProperty({ type: String, required: false })
  moduleAlias?: string;

  @Allow()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @Allow()
  @ApiProperty({ type: Date })
  updatedAt: Date;
}
