// src/ui/hud.js

import { t } from '../core/strings.js';
import { GLOBAL_LAYOUT } from '../data/global-layout.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';

export class HUD {
  constructor(world) {
    this.world = world;
    this.container = null;
    this.elements = {};
    this.lastUpdate = 0;
    this.beltSlots = [];
    this.messages = [];
  }

  mount(parent) {
    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    this.container.style.cssText = 'display:flex;flex-direction:column;gap:8px;font-family:monospace;font-size:12px;color:#eee;';
    parent.appendChild(this.container);
    this.build();
    this.world.eventBus.on('belt:selection', (index) => this.updateBeltSelection(index));
  }

  build() {
    this.container.innerHTML = `
      <div style="background:rgba(0,0,0,0.85);border-radius:8px;padding:12px;min-width:240px;">
        <div style="border-bottom:1px solid #555;padding-bottom:6px;margin-bottom:6px;">
          <div>${t('hud.sector')}: <span id="hud-sector">-</span></div>
          <div>${t('hud.coords')}: <span id="hud-coords">-, -</span></div>
          <div>${t('hud.enemies')}: <span id="hud-enemies">0</span></div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t('hud.hp')}</span><span id="hud-hp-value">0/0</span></div>
          <div style="background:#333;height:6px;border-radius:3px;overflow:hidden;">
            <div id="hud-hp-bar" style="width:0%;height:100%;background:#4caf50;"></div>
          </div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t('hud.weapon')}</span><span id="hud-weapon-name">-</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>${t('hud.ammo')}</span><span id="hud-ammo">0/0</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;margin-top:2px;">
            <div id="hud-ammo-bar" style="width:0%;height:100%;background:#ff9800;"></div>
          </div>
        </div>
        <div id="hud-reload" style="display:none;color:#ff9800;margin-bottom:6px;">${t('hud.reloading')}</div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t('hud.recoil')}</span><span id="hud-recoil">0%</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;">
            <div id="hud-recoil-bar" style="width:0%;height:100%;background:#f44336;"></div>
          </div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t('hud.suppression')}</span><span id="hud-suppression">0%</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;">
            <div id="hud-suppression-bar" style="width:0%;height:100%;background:#9c27b0;"></div>
          </div>
        </div>
        <div style="border-top:1px solid #555;padding-top:6px;margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <span>${t('hud.strength')}: <span id="hud-str">10</span></span>
          <span>${t('hud.accuracy')}: <span id="hud-acc">10</span></span>
          <span>${t('hud.endurance')}: <span id="hud-end">10</span></span>
          <span>${t('hud.health')}: <span id="hud-health">10</span></span>
        </div>
        <div style="border-top:1px solid #555;padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;">
          <span>${t('hud.level')}: <span id="hud-level">1</span></span>
          <span>${t('hud.xp')}: <span id="hud-xp">0</span></span>
          <span>${t('hud.points')}: <span id="hud-points">0</span></span>
        </div>
        <div id="hud-belt" style="border-top:1px solid #555;padding-top:6px;margin-top:4px;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">${t('hud.belt')}</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:4px;" id="hud-belt-slots"></div>
        </div>
        <div id="hud-message" style="border-top:1px solid #555;margin-top:6px;padding-top:6px;color:#aaa;font-size:10px;min-height:14px;">${t('common.ready')}</div>
      </div>
    `;
    this.refreshElements();
    this.buildBeltSlots();
    this.world.eventBus.on('hud:message', (msg) => this.setMessage(msg));
  }

  buildBeltSlots() {
    const container = this.container.querySelector('#hud-belt-slots');
    if (!container) return;
    container.innerHTML = '';
    this.beltSlots = [];

    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.dataset.index = i;
      slot.style.cssText = `
        padding:4px;background:#222;border:1px solid #444;border-radius:3px;
        text-align:center;cursor:pointer;min-height:28px;font-size:10px;color:#aaa;
        transition:border-color 0.15s, background 0.15s;
      `;
      slot.onclick = () => {
        if (this.world) this.world.selectBeltSlot(i);
      };
      container.appendChild(slot);
      this.beltSlots.push(slot);
    }
  }

  updateBeltSlots() {
    if (!this.world || !this.world.player) return;
    const belt = this.world.player.inventory.belt;
    const selected = this.world.selectedBeltSlot;

    for (let i = 0; i < 4; i++) {
      const el = this.beltSlots[i];
      if (!el) continue;
      const item = belt[i];
      if (item) {
        const def = CONSUMABLE_ITEMS[item.id];
        const name = def ? t(def.nameKey) : item.id;
        el.textContent = `${i + 1}: ${name}`;
        el.style.color = '#eee';
        el.style.background = '#2a2a2a';
      } else {
        el.textContent = `${i + 1}: ${t('hud.emptySlot')}`;
        el.style.color = '#555';
        el.style.background = '#111';
      }
      if (selected === i) {
        el.style.borderColor = '#4caf50';
        el.style.background = '#1e3a1e';
      } else {
        el.style.borderColor = '#444';
      }
    }
  }

  updateBeltSelection() {
    this.updateBeltSlots();
  }

  refreshElements() {
    const q = (id) => this.container.querySelector('#' + id);
    this.elements = {
      sector: q('hud-sector'), coords: q('hud-coords'), enemies: q('hud-enemies'),
      hpValue: q('hud-hp-value'), hpBar: q('hud-hp-bar'),
      weaponName: q('hud-weapon-name'), ammo: q('hud-ammo'), ammoBar: q('hud-ammo-bar'),
      reload: q('hud-reload'),
      recoil: q('hud-recoil'), recoilBar: q('hud-recoil-bar'),
      suppression: q('hud-suppression'), suppressionBar: q('hud-suppression-bar'),
      str: q('hud-str'), acc: q('hud-acc'), end: q('hud-end'), health: q('hud-health'),
      level: q('hud-level'), xp: q('hud-xp'), points: q('hud-points'),
      belt: q('hud-belt'), beltSlots: q('hud-belt-slots'),
      message: q('hud-message')
    };
  }

  update(player, sectorId, enemyCount) {
    const now = performance.now();
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;
    if (!player) return;

    const e = this.elements;
    const sector = GLOBAL_LAYOUT.sectors[sectorId];
    if (e.sector) e.sector.textContent = sector ? sector.name : sectorId;
    if (e.coords) e.coords.textContent = player.gx + ', ' + player.gy;
    if (e.enemies) e.enemies.textContent = String(enemyCount);

    const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    if (e.hpValue) e.hpValue.textContent = Math.max(0, Math.floor(player.hp)) + '/' + player.maxHp;
    if (e.hpBar) {
      e.hpBar.style.width = hpPercent + '%';
      e.hpBar.style.background = hpPercent > 60 ? '#4caf50' : (hpPercent > 30 ? '#ff9800' : '#f44336');
    }

    const weapon = player.getActiveWeapon();
    if (weapon) {
      if (e.weaponName) e.weaponName.textContent = t(weapon.nameKey);
      const ammoPercent = (player.currentAmmo / weapon.magazineSize) * 100;
      if (e.ammo) e.ammo.textContent = player.currentAmmo + '/' + weapon.magazineSize;
      if (e.ammoBar) {
        e.ammoBar.style.width = ammoPercent + '%';
        e.ammoBar.style.background = player.currentAmmo < weapon.magazineSize * 0.3 ? '#f44336' : '#ff9800';
      }
    } else {
      if (e.weaponName) e.weaponName.textContent = t('hud.noWeapon');
      if (e.ammo) e.ammo.textContent = '0/0';
      if (e.ammoBar) e.ammoBar.style.width = '0%';
    }

    if (e.reload) e.reload.style.display = player.isReloading ? 'block' : 'none';

    const maxRecoil = weapon ? weapon.maxRecoil : 1;
    const recoilPercent = (player.recoil / maxRecoil) * 100;
    if (e.recoil) e.recoil.textContent = recoilPercent.toFixed(0) + '%';
    if (e.recoilBar) e.recoilBar.style.width = recoilPercent + '%';

    const suppPercent = player.suppression * 100;
    if (e.suppression) e.suppression.textContent = suppPercent.toFixed(0) + '%';
    if (e.suppressionBar) e.suppressionBar.style.width = suppPercent + '%';

    if (e.str) e.str.textContent = String(player.stats.strength);
    if (e.acc) e.acc.textContent = String(player.stats.accuracy);
    if (e.end) e.end.textContent = String(player.stats.endurance);
    if (e.health) e.health.textContent = String(player.stats.health);

    if (e.level) e.level.textContent = String(player.level);
    if (e.xp) e.xp.textContent = String(player.xp);
    if (e.points) e.points.textContent = String(player.pointsAvailable);

    this.updateBeltSlots();
  }

  setMessage(msg) {
    if (!this.elements.message) return;
    this.elements.message.textContent = msg;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      if (this.elements.message) this.elements.message.textContent = t('common.ready');
    }, 3000);
  }
}