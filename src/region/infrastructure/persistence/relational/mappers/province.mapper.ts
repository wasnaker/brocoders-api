import { Province } from '../../../../domain/province';
import { ProvinceEntity } from '../entities/province.entity';

export class ProvinceMapper {
  static toDomain(raw: ProvinceEntity): Province {
    const domainEntity = new Province();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.isoCode = raw.isoCode;
    domainEntity.latitude = raw.latitude === null ? null : Number(raw.latitude);
    domainEntity.longitude =
      raw.longitude === null ? null : Number(raw.longitude);
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Partial<Province>): ProvinceEntity {
    const persistenceEntity = new ProvinceEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name as string;
    persistenceEntity.isoCode = domainEntity.isoCode ?? null;
    persistenceEntity.latitude = domainEntity.latitude ?? null;
    persistenceEntity.longitude = domainEntity.longitude ?? null;
    persistenceEntity.createdAt = domainEntity.createdAt as Date;
    persistenceEntity.updatedAt = domainEntity.updatedAt as Date;
    return persistenceEntity;
  }
}