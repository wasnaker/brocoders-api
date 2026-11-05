import { Session } from '../../../session/domain/session';
import { Role } from '../../../roles/domain/role';
import { User } from '../../../users/domain/user';

/**
 * JWT only carries role identifiers, never full role/permission objects.
 * The singular role claim remains temporarily for older consumers.
 */
export type JwtPayloadType = Pick<User, 'id'> & {
  role?: Pick<Role, 'id'> | null;
  roles?: Array<Pick<Role, 'id'>>;
  sessionId: Session['id'];
  iat: number;
  exp: number;
};