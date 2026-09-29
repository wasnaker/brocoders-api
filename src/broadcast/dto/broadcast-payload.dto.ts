import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BroadcastSeverityEnum } from '../dto/publish-broadcast.dto';

export class BroadcastPayload {
  @ApiProperty({
    type: String,
    example: '2026-09-30T04:12:33.000Z',
    description:
      'setting.updatedAt dari baris broadcast. WAJIB ada: admin yang ' +
      'mengedit broadcast dengan teks identik harus tetap memicu banner baru, ' +
      'dan pengguna yang sudah dismiss harus melihat revisi berikutnya.',
  })
  version: string;

  @ApiProperty({
    type: String,
    enum: BroadcastSeverityEnum,
    example: BroadcastSeverityEnum.WARNING,
  })
  severity: BroadcastSeverityEnum;

  @ApiProperty({ type: String, example: 'Maintenance terjadwal' })
  title: string;

  @ApiProperty({
    type: String,
    example: 'Sistem dinonaktifkan 02:00-03:00 WIB.',
  })
  message: string;

  @ApiPropertyOptional({ type: String, example: 'Lihat detail' })
  actionLabel?: string;

  @ApiProperty({ type: Boolean, example: true })
  closable: boolean;

  @ApiProperty({ type: String, example: '2026-09-30T04:00:00.000Z' })
  createdAt: string;
}

export class BroadcastEmptyPayload {
  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'null = belum ada broadcast aktif',
  })
  version: null;
}
