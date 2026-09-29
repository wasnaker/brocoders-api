import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum BroadcastSeverityEnum {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export class PublishBroadcastDto {
  @IsEnum(BroadcastSeverityEnum)
  severity: BroadcastSeverityEnum;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  actionLabel?: string;

  @IsBoolean()
  closable: boolean;
}
