import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { BroadcastService } from './broadcast.service';
import {
  BroadcastEmptyPayload,
  BroadcastPayload,
} from './dto/broadcast-payload.dto';
import { PublishBroadcastDto } from './dto/publish-broadcast.dto';

/**
 * Guard TIDAK bisa dipasang di level class di sini: `GET` harus terbaca
 * semua user terautentikasi (banner sistem menjangkau semua user yang login),
 * sedangkan `POST`/`DELETE` hanya admin. Karena itu `@UseGuards(RolesGuard)`
 * hanya dipasang per-route pada dua method yang menulis.
 *
 * `GET /v1/settings` tidak bisa dipakai untuk ini — sudah di-guard
 * `@Roles(RoleEnum.admin)` di `settings.controller.ts`.
 */
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@ApiTags('Broadcast')
@Controller({
  path: 'broadcast',
  version: '1',
})
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @ApiOkResponse({
    type: BroadcastPayload,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async get(): Promise<BroadcastPayload | BroadcastEmptyPayload> {
    return this.broadcastService.get();
  }

  @ApiOkResponse({
    type: BroadcastPayload,
  })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.OK)
  async publish(@Body() body: PublishBroadcastDto): Promise<BroadcastPayload> {
    return this.broadcastService.publish(body);
  }

  @ApiOkResponse({
    type: BroadcastEmptyPayload,
  })
  @Delete()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.OK)
  async clear(): Promise<BroadcastEmptyPayload> {
    return this.broadcastService.clear();
  }
}
