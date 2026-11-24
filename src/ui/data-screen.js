// src/ui/data-screen.js

import { t } from '../core/strings.js';

export class DataScreen {
  constructor(world, db, saveManager) {
    this.world = world;
    this.db = db;
    this.saveManager = saveManager;
    this.container = null;
    this.visible = false;
    this.stats = null;
    this.onAfterImport = null;
  }

  mount() {
    this.container = document.createElement('div');
    this.container.id = 'data-screen';
    this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:20px;z-index:1003;display:none;color:#eee;font-family:monospace;
      font-size:13px;max-width:500px;width:100%;
    `;
    document.body.appendChild(this.container);
  }

  async toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) await this.render();
  }

  async collectStats() {
    return {
      maps: (await this.db.getAllKeys('maps')).length,
      transitions: (await this.db.getAllKeys('transitions')).length,
      sprites: (await this.db.getAllKeys('sprites')).length,
      sounds: (await this.db.getAllKeys('sounds')).length,
      spawnPoints: (await this.db.getAllKeys('spawn_points')).length,
      caches: (await this.db.getAllKeys('caches')).length,
      saves: (await this.db.getAllKeys('saves')).length
    };
  }

  async render() {
    this.stats = await this.collectStats();
    const s = this.stats;
    const hasData = s.maps > 0 && s.sprites > 0;

    this.container.innerHTML = `
      <h3 style="margin-top:0;">${t('data.title')}</h3>
      <div style="margin-bottom:12px;padding:8px;background:#1a1a1a;border-radius:4px;">
        <div>${t('data.maps')}: ${s.maps}</div>
        <div>${t('data.transitions')}: ${s.transitions}</div>
        <div>${t('data.sprites')}: ${s.sprites}</div>
        <div>${t('data.sounds')}: ${s.sounds}</div>
        <div>${t('data.spawnPoints')}: ${s.spawnPoints}</div>
        <div>${t('data.caches')}: ${s.caches}</div>
        <div>${t('save.title')}: ${s.saves}</div>
      </div>
      ${!hasData ? `<div style="color:#ff9800;margin-bottom:12px;">${t('data.noData')}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button id="data-import" style="padding:8px;background:#1565c0;color:#fff;border:none;cursor:pointer;">
          ${t('data.import')}
        </button>
        <button id="data-delete" style="padding:8px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">
          ${t('data.deleteAll')}
        </button>
        <button id="data-back" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">
          ${t('settings.back')}
        </button>
      </div>
    `;

    this.container.querySelector('#data-back').onclick = () => this.toggle();
    this.container.querySelector('#data-import').onclick = () => this.openImportDialog();
    this.container.querySelector('#data-delete').onclick = () => this.handleDeleteAll();
  }

  openImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.importZip(file);
      input.remove();
    };
    input.click();
  }

  async importZip(file) {
    const hasData = this.stats && this.stats.maps > 0;
    if (hasData) {
      const ok = confirm(t('data.importConfirm'));
      if (!ok) return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await new Promise((resolve) => {
      if (window.JSZip) return resolve();
      script.onload = resolve;
      document.head.appendChild(script);
    });
    const JSZip = window.JSZip;
    const zip = await JSZip.loadAsync(file);

    if (hasData) {
      await this.db.clearAll();
    }

    await this.importMaps(zip);
    await this.importTransitions(zip);
    await this.importSprites(zip);
    await this.importSounds(zip);
    await this.importSpawnPoints(zip);
    await this.importCaches(zip);
    await this.importGlobalLayout(zip);

    alert(t('data.imported'));
    await this.render();
    this.world.eventBus.emit('hud:message', t('data.imported'));
    if (typeof this.onAfterImport === 'function') this.onAfterImport();
  }

  async importMaps(zip) {
    const f = Object.values(zip.files).find((x) => x.name.endsWith('sector_maps.json'));
    if (!f) return;
    const json = JSON.parse(await f.async('string'));
    const maps = json.sector_maps || json;
    for (const id in maps) await this.db.put('maps', Number(id), maps[id]);
  }

  async importTransitions(zip) {
    const f = Object.values(zip.files).find((x) => x.name.endsWith('transitions.json'));
    if (!f) return;
    const json = JSON.parse(await f.async('string'));
    const list = json.transitions || [];
    for (const tr of list) {
      const key = `${tr.from.sectorId}|${tr.from.gx}|${tr.from.gy}`;
      await this.db.put('transitions', key, tr);
    }
  }

  async importSprites(zip) {
    for (const file of Object.values(zip.files)) {
      if (file.dir || !file.name.includes('/sprites/')) continue;
      const blob = await file.async('blob');
      const name = file.name.split('/').pop().split('.')[0];
      await this.db.put('sprites', name, blob);
    }
  }

  async importSounds(zip) {
    for (const file of Object.values(zip.files)) {
      if (file.dir || !file.name.includes('/sounds/')) continue;
      const blob = await file.async('blob');
      const name = file.name.split('/').pop().split('.')[0];
      await this.db.put('sounds', name, blob);
    }
  }

  async importSpawnPoints(zip) {
    const f = Object.values(zip.files).find((x) => x.name.endsWith('spawn_points.json'));
    if (!f) return;
    const json = JSON.parse(await f.async('string'));
    const list = json.spawn_points || json;
    if (Array.isArray(list)) {
      for (const p of list) {
        if (p.sectorId !== undefined) await this.db.put('spawn_points', p.sectorId, { points: [p] });
      }
    } else {
      for (const id in list) await this.db.put('spawn_points', Number(id), list[id]);
    }
  }

  async importCaches(zip) {
    const f = Object.values(zip.files).find((x) => x.name.endsWith('caches.json'));
    if (!f) return;
    const json = JSON.parse(await f.async('string'));
    const list = json.caches || json;
    if (Array.isArray(list)) {
      for (const c of list) {
        if (c.sectorId !== undefined) await this.db.put('caches', c.sectorId, c);
      }
    } else {
      for (const id in list) await this.db.put('caches', Number(id), list[id]);
    }
  }

  async importGlobalLayout(zip) {
    const f = Object.values(zip.files).find((x) => x.name.endsWith('global_layout.json'));
    if (!f) return;
    const json = JSON.parse(await f.async('string'));
    await this.db.put('global_layout', 'layout', json);
  }

  async handleDeleteAll() {
    const ok = confirm(t('data.deleteConfirm'));
    if (!ok) return;
    await this.saveManager.deleteAllGameData();
    alert(t('common.ok'));
    await this.render();
  }
}