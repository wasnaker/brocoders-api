import { Injectable } from '@nestjs/common';

import {
  SettingsService,
  UpsertSettingItem,
} from '../settings/settings.service';
import {
  BroadcastEmptyPayload,
  BroadcastPayload,
} from './dto/broadcast-payload.dto';
import {
  BroadcastSeverityEnum,
  PublishBroadcastDto,
} from './dto/publish-broadcast.dto';

/**
 * Broadcast disimpan sebagai BARIS di tabel `setting`, bukan entitas baru.
 * Nol migrasi, nol entitas, nol generator — `CLAUDE.md` repo ini melarang
 * menulis file entity tangan, jadi menghindari generator sama sekali adalah
 * jalur yang jauh lebih murah untuk satu nilai konfigurasi.
 */
const BROADCAST_KEY = 'system.broadcast';
const BROADCAST_GROUP = 'system';
const BROADCAST_TYPE = 'json';

interface StoredBroadcast {
  severity: BroadcastSeverityEnum;
  title: string;
  message: string;
  actionLabel?: string;
  closable: boolean;
  /**
   * Versi broadcast. WAJIB disimpan eksplisit di dalam `value`, TIDAK boleh
   * memfedayakan `setting.updatedAt`.
   *
   * MySQL hanya menyalakan `ON UPDATE CURRENT_TIMESTAMP` kalau ada kolom lain
   * yang benar-benar berubah. Kalau admin memublish ulang dengan TEKS IDENTIK,
   * tidak ada kolom yang berubah -> `updatedAt` tidak bergerak -> versi tetap
   * -> pengguna yang sudah dismiss tidak pernah melihat revisi berikutnya.
   * Persis itu yang dicek §4.4 dan skenario verifikasi #6.
   */
  version: string;
}

@Injectable()
export class BroadcastService {
  constructor(private readonly settingsService: SettingsService) {}

  async get(): Promise<BroadcastPayload | BroadcastEmptyPayload> {
    const setting = await this.settingsService.findByKey(BROADCAST_KEY);
    if (!setting) {
      return { version: null };
    }

    let stored: StoredBroadcast;
    try {
      stored = JSON.parse(setting.value) as StoredBroadcast;
    } catch {
      // Value rusak (ditulis manual / versi lama) diperlakukan sebagai
      // "tidak ada broadcast" — lebih baik diam daripada membuat crash
      // seluruh endpoint untuk semua user.
      return { version: null };
    }

    if (!stored?.message || !stored?.severity || !stored?.version) {
      return { version: null };
    }

    return {
      version: stored.version,
      severity: stored.severity,
      title: stored.title,
      message: stored.message,
      actionLabel: stored.actionLabel,
      closable: stored.closable !== false,
      createdAt: setting.createdAt.toISOString(),
    };
  }

  async publish(dto: PublishBroadcastDto): Promise<BroadcastPayload> {
    const item: UpsertSettingItem = {
      key: BROADCAST_KEY,
      group: BROADCAST_GROUP,
      type: BROADCAST_TYPE,
      value: JSON.stringify({
        severity: dto.severity,
        title: dto.title,
        message: dto.message,
        actionLabel: dto.actionLabel,
        closable: dto.closable,
        // Versi baru DIBAWA sendiri saat publish, bukan diturunkan dari
        // `updatedAt`. Melihat alasan di `StoredBroadcast.version`.
        version: new Date().toISOString(),
      }),
      moduleAlias: null,
    };

    await this.settingsService.upsertMany([item]);

    // Baca balik supaya `version`/`createdAt` yang dikembalikan berasal dari
    // baris yang benar-benar tersimpan, bukan dari nilai yang baru saja dikirim.
    const saved = await this.get();
    if (saved.version === null) {
      // Tidak mungkin barring JSON tidak valid — tapi jangan kirim payload
      // setengah jadi ke pemanggil kalau sampai terjadi.
      throw new Error('Broadcast gagal disimpan');
    }
    return saved;
  }

  async clear(): Promise<BroadcastEmptyPayload> {
    await this.settingsService.removeByKey(BROADCAST_KEY);
    return { version: null };
  }
}
