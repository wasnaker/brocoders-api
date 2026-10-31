import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO representasi satu modul yang terdaftar.
 * Read-only — tidak ada create/update/delete.
 */
export class ModuleDto {
  @ApiProperty({
    type: String,
    example: 'core-settings',
    description:
      'ID unik modul (kebab-case), dipakai sebagai parameter route :id',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Core Settings',
    description: 'Nama tampilan modul',
  })
  name: string;

  @ApiProperty({
    type: String,
    example: '1.0.0',
    description: 'Versi modul (semver)',
  })
  version: string;

  @ApiProperty({
    type: String,
    example: 'core-settings',
    description: 'Alias asli dari manifest frontend (referensi)',
  })
  alias: string;

  @ApiProperty({
    type: String,
    example:
      'Core module for application settings (general, appearance, language, roles)',
    description: 'Deskripsi singkat fungsi modul',
  })
  description: string;
}
