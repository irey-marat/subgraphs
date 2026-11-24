// src/ui/inventory.js

import { t } from '../core/strings.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR_ITEMS } from '../data/armor.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';
import { GRID_W, GRID_H, BELT_SLOTS } from '../entities/inventory.js';

export class InventoryUI {
  constructor(world) {
    this.world = world;
    this.container = null;
    this.visible = false;
  }

  mount() {
    this.container = document.createElement('div');
    this.container.id = 'inventory-panel';
    this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:16px;z-index:1000;display:none;color:#eee;font-family:monospace;font-size:12px;
      max-height:80vh;overflow-y:auto;
    `;
    document.body.appendChild(this.container);
    this.world.eventBus.on('belt:selection', () => { if (this.visible) this.render(); });
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) this.render();
  }

  render() {
    const inv = this.world.player.inventory;
    const selected = this.world.selectedBeltSlot;

    const slotsHtml = Object.entries(inv.slots).map(([slot, item]) => {
      if (!item) return `<div style="padding:4px;border:1px solid #333;">${t('inv.slot.' + slot)}: —</div>`;
      const def = WEAPONS[item.id] || ARMOR_ITEMS[item.id];
      const name = def ? t(def.nameKey) : item.id;
      return `<div style="padding:4px;border:1px solid #333;">${t('inv.slot.' + slot)}: ${name}</div>`;
    }).join('');

    const gridCells = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const e = inv.grid[y][x];
        if (e && e.gx === x && e.gy === y) {
          const def = CONSUMABLE_ITEMS[e.item.id] || WEAPONS[e.item.id] || ARMOR_ITEMS[e.item.id];
          const name = def ? t(def.nameKey) : e.item.id;
          gridCells.push(`<div style="grid-column:span ${e.w};grid-row:span ${e.h};background:#2a2a2a;border:1px solid #555;padding:2px;font-size:10px;">${name}</div>`);
        } else if (!e) {
          gridCells.push(`<div style="background:#1a1a1a;border:1px solid #333;min-height:24px;"></div>`);
        }
      }
    }

    const beltHtml = inv.belt.map((item, i) => {
      const isSelected = selected === i;
      const border = isSelected ? '#4caf50' : '#555';
      const bg = isSelected ? '#1e3a1e' : (item ? '#2a2a2a' : '#1a1a1a');
      if (!item) {
        return `<div data-belt="${i}" style="padding:4px;border:1px solid ${border};background:${bg};text-align:center;cursor:pointer;color:#555;">${i + 1}: ${t('hud.emptySlot')}</div>`;
      }
      const def = CONSUMABLE_ITEMS[item.id];
      const name = def ? t(def.nameKey) : item.id;
      return `<div data-belt="${i}" style="padding:4px;border:1px solid ${border};background:${bg};text-align:center;cursor:pointer;color:#eee;">${i + 1}: ${name}</div>`;
    }).join('');

    this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;">${t('inv.title')}</h3>
        <button id="inv-close" style="background:#555;color:#fff;border:none;padding:4px 8px;cursor:pointer;">${t('common.close')}</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        ${slotsHtml}
      </div>
      <div style="margin-bottom:12px;">
        <div style="margin-bottom:4px;">${t('inv.belt')}</div>
        <div style="display:grid;grid-template-columns:repeat(${BELT_SLOTS}, 1fr);gap:4px;">${beltHtml}</div>
      </div>
      <div>
        <div style="margin-bottom:4px;">${t('inv.title')} ${GRID_W}×${GRID_H}</div>
        <div style="display:grid;grid-template-columns:repeat(${GRID_W}, 1fr);gap:2px;">${gridCells.join('')}</div>
      </div>
    `;

    const closeBtn = this.container.querySelector('#inv-close');
    if (closeBtn) closeBtn.onclick = () => this.toggle();

    this.container.querySelectorAll('[data-belt]').forEach((el) => {
      el.onclick = () => {
        const idx = Number(el.dataset.belt);
        this.world.selectBeltSlot(idx);
      };
    });
  }
}