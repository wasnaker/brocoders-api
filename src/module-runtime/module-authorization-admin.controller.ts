import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { ModuleAuthorizationReconciliationService } from './module-authorization-reconciliation.service';
import { ModuleAuthorizationSyncEntity } from './module-authorization-sync.entity';
import { AuthorizationAuditLogEntity } from './authorization-audit-log.entity';

type AuthenticatedRequest = Request & { user?: { id?: number | string } };

@ApiBearerAuth()
@ApiTags('Module Authorization')
@Roles(1)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'module-authorization', version: '1' })
export class ModuleAuthorizationAdminController {
  constructor(
    private readonly reconciliation: ModuleAuthorizationReconciliationService,
    @InjectRepository(ModuleAuthorizationSyncEntity)
    private readonly syncStates: Repository<ModuleAuthorizationSyncEntity>,
    @InjectRepository(AuthorizationAuditLogEntity)
    private readonly audit: Repository<AuthorizationAuditLogEntity>,
  ) {}

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Query('moduleId') moduleId?: string) {
    return this.reconciliation.validateOnly(moduleId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  syncAll(@Req() request: AuthenticatedRequest) {
    return this.reconciliation.syncAll(this.actorId(request));
  }

  @Post('modules/:moduleId/sync')
  @HttpCode(HttpStatus.OK)
  syncModule(
    @Param('moduleId') moduleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reconciliation.syncModule(moduleId, this.actorId(request));
  }

  @Get('modules/:moduleId/state')
  @HttpCode(HttpStatus.OK)
  getModuleSyncState(@Param('moduleId') moduleId: string) {
    return this.syncStates.findOne({ where: { moduleId } });
  }

  @Get('audit')
  @HttpCode(HttpStatus.OK)
  getAudit(@Query('moduleId') moduleId?: string) {
    const query = this.audit.createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .take(100);
    if (moduleId) query.where('audit.moduleId = :moduleId', { moduleId });
    return query.getMany();
  }

  private actorId(request: AuthenticatedRequest): number | null {
    const id = Number(request.user?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
