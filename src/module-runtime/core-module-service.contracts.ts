import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ModuleAuthorizationService } from './module-authorization.service';
import { CoreAuthorizationRegistryService } from './core-authorization-registry.service';
import { ModuleServiceRegistry } from './module-service.registry';
import { StatusEnum } from '../statuses/statuses.enum';

export interface CoreUserSummary {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roleIds: number[];
  statusId: number | string | null;
}

export interface CoreUserDirectory {
  findById(id: number | string): Promise<CoreUserSummary | null>;
  findByEmail(email: string): Promise<CoreUserSummary | null>;
}

export interface CoreAccountProvisioningInput {
  moduleId: string;
  email: string;
  password: string;
  name: string;
  roleKey: string;
  scopeType: string;
  scopeId: string;
  assignedBy: number | null;
}

export interface CoreAccountProvisioning {
  create(input: CoreAccountProvisioningInput): Promise<{ id: number }>;
  remove(userId: number): Promise<void>;
}

/** Publishes stable Core-owned contracts; module packages never import UsersService. */
@Injectable()
export class CoreModuleServiceContracts
  implements OnModuleInit, OnModuleDestroy
{
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly users: UsersService,
    private readonly authorization: ModuleAuthorizationService,
    private readonly authorizationRegistry: CoreAuthorizationRegistryService,
    private readonly registry: ModuleServiceRegistry,
  ) {}

  onModuleInit(): void {
    this.disposers.push(this.registry.register({
      providerModuleId: 'core',
      contractId: 'core.authorization.registry',
      version: '1.0.0',
      consumers: ['customer', 'equipment', 'region', 'impersonate'],
      service: this.authorizationRegistry,
    }));

    const userDirectory: CoreUserDirectory = {
      findById: async (id) => this.toSummary(await this.users.findById(id)),
      findByEmail: async (email) =>
        this.toSummary(await this.users.findByEmail(email)),
    };
    this.disposers.push(
      this.registry.register({
        providerModuleId: 'core',
        contractId: 'core.user-directory',
        version: '1.0.0',
        consumers: ['customer', 'equipment'],
        service: userDirectory,
      }),
    );

    const accountProvisioning: CoreAccountProvisioning = {
      create: async (input) => {
        const roleId = await this.authorization.findModuleRoleId(
          input.moduleId,
          input.roleKey,
        );
        const nameParts = input.name.trim().split(/\s+/);
        const user = await this.users.create({
          email: input.email.trim().toLowerCase(),
          password: input.password,
          firstName: nameParts[0] || input.name,
          lastName: nameParts.slice(1).join(' ') || null,
          roles: [{ id: roleId }],
          status: { id: StatusEnum.active },
        });
        try {
          await this.authorization.assignModuleRole({
            userId: Number(user.id),
            moduleId: input.moduleId,
            roleKey: input.roleKey,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            assignedBy: input.assignedBy,
          });
        } catch (error) {
          await this.users.remove(user.id);
          throw error;
        }
        return { id: Number(user.id) };
      },
      remove: (userId) => this.users.remove(userId),
    };
    this.disposers.push(
      this.registry.register({
        providerModuleId: 'core',
        contractId: 'core.account-provisioning',
        version: '1.0.0',
        consumers: ['customer'],
        service: accountProvisioning,
      }),
    );
  }

  onModuleDestroy(): void {
    for (const dispose of this.disposers.splice(0).reverse()) dispose();
  }

  private toSummary(user: Awaited<ReturnType<UsersService['findById']>>) {
    if (!user) return null;
    const roles = user.roles?.length
      ? user.roles
      : user.role
        ? [user.role]
        : [];
    return {
      id: String(user.id),
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      roleIds: roles.map((role) => Number(role.id)),
      statusId: user.status?.id ?? null,
    };
  }
}
