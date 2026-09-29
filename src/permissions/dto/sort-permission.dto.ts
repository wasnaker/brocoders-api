import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class SortPermissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @IsOptional()
  name?: 'ASC' | 'DESC';
}
