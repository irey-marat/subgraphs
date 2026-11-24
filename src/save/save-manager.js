// src/save/save-manager.js

const AUTO_KEY = 'auto_save';
const AUTO_BACKUP_KEY = 'auto_save_backup';
const MANUAL_KEY_PREFIX = 'manual_save_';
const MANUAL_MAX = 3;
const SAVE_VERSION = 2;

const MIGRATORS = {
  1: (data) => {
    if (!data.currentSectorState) {
      data.currentSectorState = {
        sectorId: data.currentSectorId,
        bots: [],
        pois: []
      };
    }
    if (!data.allPois) {
      data.allPois = data.pois || [];
    }
    if (!data.nextEntityId) {
      data.nextEntityId = 1;
    }
    for (const s of data.sectorStates || []) {
      for (const b of s.bots || []) {
        if (!b.brainState && b.state) {
          b.brainState = { state: b.state, interest: b.interest || 0 };
        }
        if (!b.activeWeaponSlot) b.activeWeaponSlot = 'primary';
      }
    }
    data.version = 2;
    return data;
  }
};

export class SaveManager {
  constructor(db, world) {
    this.db = db;
    this.world = world;
  }

  migrate(data) {
    if (!data) return data;
    let version = data.version || 1;
    while (version < SAVE_VERSION) {
      const migrator = MIGRATORS[version];
      if (!migrator) {
        console.warn('[SaveManager] No migrator for version', version);
        break;
      }
      try {
        data = migrator(data);
      } catch (err) {
        console.error('[SaveManager] Migrator error for version', version, err);
        return null;
      }
      version = data.version || (version + 1);
    }
    return data;
  }

  async saveAuto() {
    const data = this.world.serialize();
    data.version = SAVE_VERSION;
    const prev = await this.db.get('saves', AUTO_KEY);
    if (prev) await this.db.put('saves', AUTO_BACKUP_KEY, prev);
    await this.db.put('saves', AUTO_KEY, { ...data, savedAt: Date.now() });
    return true;
  }

  async saveManual(slot) {
    if (slot < 1 || slot > MANUAL_MAX) return false;
    const key = MANUAL_KEY_PREFIX + slot;
    const data = this.world.serialize();
    data.version = SAVE_VERSION;
    await this.db.put('saves', key, { ...data, savedAt: Date.now() });
    return true;
  }

  async load(key) {
    const raw = await this.db.get('saves', key);
    if (!raw) return false;

    const version = raw.version || 1;
    if (version > SAVE_VERSION) {
      console.error('[SaveManager] Save version', version, 'is newer than current', SAVE_VERSION);
      return false;
    }

    const data = this.migrate(raw);
    if (!data) {
      console.error('[SaveManager] Migration failed for', key);
      return false;
    }

    try {
      await this.world.deserialize(data);
      return true;
    } catch (err) {
      console.error('[SaveManager] Deserialize failed:', err);
      return false;
    }
  }

  async loadAuto() { return this.load(AUTO_KEY); }
  async loadAutoBackup() { return this.load(AUTO_BACKUP_KEY); }
  async loadManual(slot) { return this.load(MANUAL_KEY_PREFIX + slot); }

  async listSaves() {
    const out = { auto: null, autoBackup: null, manual: [] };
    out.auto = await this.db.get('saves', AUTO_KEY);
    out.autoBackup = await this.db.get('saves', AUTO_BACKUP_KEY);
    for (let i = 1; i <= MANUAL_MAX; i++) {
      const d = await this.db.get('saves', MANUAL_KEY_PREFIX + i);
      out.manual.push({ slot: i, data: d || null });
    }
    return out;
  }

  async deleteSave(key) {
    await this.db.delete('saves', key);
  }

  async deleteAllSaves() {
    await this.db.deleteAllSaves();
  }

  async deleteAllGameData() {
    await this.db.clearAll();
    await this.db.deleteAllSaves();
  }
}