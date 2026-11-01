import { Regency } from '../../../../domain/regency';
import { RegencyEntity } from '../entities/regency.entity';

export class RegencyMapper {
  static toDomain(raw: RegencyEntity): Regency {
    const domainEntity = new Regency();
    domainEntity.id = raw.id;
    domainEntity.provinceId = raw.provinceId;
    domainEntity.name = raw.name;
    domainEntity.type = raw.type as Regency['type'];
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Partial<Regency>): RegencyEntity {
    const persistenceEntity = new RegencyEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.provinceId !== undefined) {
      persistenceEntity.provinceId = Number(domainEntity.provinceId);
    }
    persistenceEntity.name = domainEntity.name as string;
    persistenceEntity.type = domainEntity.type as string;
    persistenceEntity.isActive = domainEntity.isActive ?? true;
    persistenceEntity.createdAt = domainEntity.createdAt as Date;
    persistenceEntity.updatedAt = domainEntity.updatedAt as Date;
    return persistenceEntity;
  }
}