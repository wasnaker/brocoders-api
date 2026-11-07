import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repository: Repository<RoleEntity>,
  ) {}

  async run() {
    const countUser = await this.repository.count({
      where: {
        id: 2,
      },
    });

    if (!countUser) {
      await this.repository.save(
        this.repository.create({
          id: 2,
          name: 'User',
        }),
      );
    }

    const countAdmin = await this.repository.count({
      where: {
        id: 1,
      },
    });

    if (!countAdmin) {
      await this.repository.save(
        this.repository.create({
          id: 1,
          name: 'Admin',
        }),
      );
    }
  }
}
