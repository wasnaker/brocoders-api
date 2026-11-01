import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Permission } from '../../permissions/domain/permission';

export class Role {
  @Allow()
  @ApiProperty({ type: Number })
  id: number | string;

  @Allow()
  @ApiProperty({ type: String, example: 'admin' })
  name?: string;

  @Allow()
  @ApiProperty({ type: () => [Permission], required: false })
  permissions?: Permission[];
}
