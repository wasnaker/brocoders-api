import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { SortPermissionDto } from './sort-permission.dto';

export class QueryPermissionDto {
  @ApiPropertyOptional({ type: () => SortPermissionDto })
  @IsOptional()
  @Type(() => SortPermissionDto)
  sort?: SortPermissionDto;

  @ApiPropertyOptional({
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export type FilterPermissionDto = Record<string, any>;
export { SortPermissionDto };
