import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ProvinceEntity } from './province.entity';

@Entity({
  name: 'regency',
})
export class RegencyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number })
  provinceId: number;

  @ManyToOne(() => ProvinceEntity, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'provinceId' })
  province?: ProvinceEntity;

  @Index()
  @Column({ type: String })
  name: string;

  @Column({ type: String, default: 'kabupaten' })
  type: string;

  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}