import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'create:user',
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    example: 'Allows creating a new user',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
