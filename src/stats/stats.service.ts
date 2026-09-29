import { Injectable } from '@nestjs/common';

import { UserRepository } from '../users/infrastructure/persistence/user.repository';
import { RolesService } from '../roles/roles.service';
import { StatsSummaryDto } from './dto/stats-summary.dto';

/**
 * Jendela "user baru" = 7x24 jam, bukan 7 hari kalender. Kalender
 * bermasalah di edge case (DST, leap day) dan tidak ada yang butuh presisi
 * itu untuk sebuah KPI. Titik potong dihitung sekali di service supaya query
 * tidak bisa melihat dua waktu berbeda antara `totalUsers` dan `newUsers7d`.
 */
const NEW_USERS_WINDOW_DAYS = 7;

@Injectable()
export class StatsService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly rolesService: RolesService,
  ) {}

  async summary(): Promise<StatsSummaryDto> {
    const since = new Date(
      Date.now() - NEW_USERS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [totalUsers, newUsers7d, roles] = await Promise.all([
      this.usersRepository.countAll(),
      this.usersRepository.countCreatedSince(since),
      this.rolesService.findAll(),
    ]);

    return {
      totalUsers,
      newUsers7d,
      // findAll() sudah mengambil semua role, jadi .length cukup dan tidak
      // perlu query count tersendiri. RolesModule tidak mengekspos
      // RoleRepository abstrak seperti UserRepository.
      totalRoles: roles.length,
    };
  }
}
