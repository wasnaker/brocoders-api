import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class Permission {
  @Allow()
  @ApiProperty({ type: Number })
  id: number | string;

  @Allow()
  @ApiProperty({ type: String, example: 'create:user' })
  name: string;

  @Allow()
  @ApiProperty({ type: String, required: false })
  description?: string;
}
