import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import databaseConfig from '../../database/config/database.config';
import { DatabaseConfig } from '../../database/config/database-config.type';

// <database-block>
const idType = (databaseConfig() as DatabaseConfig).isDocumentDatabase
  ? String
  : Number;
// </database-block>

export class Setting {
  @Allow()
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'general.appName',
  })
  key: string;

  @Allow()
  @ApiProperty({
    type: String,
  })
  value: string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'text',
  })
  type: string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'general',
  })
  group: string;

  @Allow()
  @ApiProperty({
    type: String,
    required: false,
  })
  moduleAlias?: string;

  @Allow()
  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @Allow()
  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;
}