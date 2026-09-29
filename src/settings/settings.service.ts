import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Allow } from 'class-validator';
import { SettingEntity } from './infrastructure/persistence/relational/entities/setting.entity';

export class UpsertSettingItem {
  @Allow()
  key: string;
  @Allow()
  value: string;
  @Allow()
  type: string;
  @Allow()
  group: string;
  @Allow()
  moduleAlias?: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly settingRepository: Repository<SettingEntity>,
  ) {}

  async findAll(): Promise<SettingEntity[]> {
    return this.settingRepository.find();
  }

  async findByGroup(group: string): Promise<SettingEntity[]> {
    return this.settingRepository.find({
      where: { group },
    });
  }

  async upsertMany(items: UpsertSettingItem[]): Promise<void> {
    if (!items || items.length === 0) {
      return;
    }
    await this.settingRepository.upsert(items as any, ['key']);
  }

  async removeByGroup(group: string): Promise<void> {
    await this.settingRepository.delete({ group });
  }
}