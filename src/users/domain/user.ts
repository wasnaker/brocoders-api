import { Exclude, Expose } from 'class-transformer';
import { FileType } from '../../files/domain/file';
import { Role } from '../../roles/domain/role';
import { Status } from '../../statuses/domain/status';
import { ApiProperty } from '@nestjs/swagger';

export class User {
  @ApiProperty({ type: Number })
  id: number | string;

  @ApiProperty({ type: String, example: 'john.doe@example.com' })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({ type: String, example: 'email' })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({ type: String, example: '1234567890' })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({ type: String, example: 'John' })
  firstName: string | null;

  @ApiProperty({ type: String, example: 'Doe' })
  lastName: string | null;

  @ApiProperty({ type: () => FileType })
  photo?: FileType | null;

  /** Legacy single role retained during the multi-role migration. */
  @ApiProperty({ type: () => Role, required: false, deprecated: true })
  @Expose({ groups: ['admin'] })
  role?: Role | null;

  /** Canonical user roles. Effective permissions are the union of these roles. */
  @ApiProperty({ type: () => [Role], required: false })
  @Expose({ groups: ['admin', 'me'] })
  roles?: Role[];

  @ApiProperty({ type: () => Status })
  status?: Status;

  @ApiProperty({ type: String, example: 'en', nullable: true })
  @Expose({ groups: ['me', 'admin'] })
  language?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
