import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class Permission {
  @Allow()
  @ApiProperty({ type: Number })
  id: number | string;

  @Allow()
  @ApiProperty({ type: String, example: 'create:user' })
  name: string;

  /** Stable key used by module contracts; independent from the database ID. */
  @Allow()
  @ApiProperty({ type: String, required: false, example: 'user.create' })
  permissionKey?: string;

  @Allow()
  @ApiProperty({ type: String, required: false })
  description?: string;
}
