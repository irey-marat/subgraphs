// src/ui/settings-screen.js

import { t } from '../core/strings.js';
import { GAME_KEYS } from '../core/constants.js';

const KEY_LABEL_MAP = {
  MOVE_UP: 'moveUp',
  MOVE_DOWN: 'moveDown',
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  RELOAD: 'reload',
  SWAP_WEAPON: 'swapWeapon',
  INVENTORY: 'inventory',
  MINIMAP: 'minimap',
  GLOBAL_MAP: 'globalMap',
  ESCAPE: 'escape',
  USE_SLOT_1: 'slot1',
  USE_SLOT_2: 'slot2',
  USE_SLOT_3: 'slot3',
  USE_SLOT_4: 'slot4'
};

export class SettingsScreen {
  constructor(world, input, settingsStore, debugOverlay) {
    this.world = world;
    this.input = input;
    this.settings = settingsStore;
    this.debugOverlay = debugOverlay;
    this.container = null;
    this.visible = false;
    this.rebindingAction = null;
  }

  mount() {
    this.container = document.createElement('div');
    this.container.id = 'settings-screen';
    this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:20px;z-index:1003;display:none;color:#eee;font-family:monospace;font-size:13px;
      max-height:80vh;overflow-y:auto;min-width:400px;
    `;
    document.body.appendChild(this.container);
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) this.render();
  }

  render() {
    const s = this.settings;
    const keysHtml = Object.keys(GAME_KEYS).map((action) => {
      const code = this.input.keyBindings[action] || GAME_KEYS[action];
      const labelKey = KEY_LABEL_MAP[action] || action.toLowerCase();
      const label = t('settings.key.' + labelKey);
      return `
        <div style="display:flex;justify-content:space-between;padding:4px;border-bottom:1px solid #333;">
          <span>${label}</span>
          <button data-action="${action}" style="background:#444;color:#fff;border:none;padding:2px 8px;cursor:pointer;min-width:80px;">
            ${this.rebindingAction === action ? '…' : code}
          </button>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <h3 style="margin-top:0;">${t('settings.title')}</h3>
      <div style="margin-bottom:12px;">
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t('settings.minimap')}</span>
          <input type="checkbox" id="set-minimap" ${s.get('showMinimap') ? 'checked' : ''}>
        </label>
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t('settings.globalMap')}</span>
          <input type="checkbox" id="set-global-map" ${s.get('showGlobalMap') ? 'checked' : ''}>
        </label>
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t('settings.debug')}</span>
          <input type="checkbox" id="set-debug" ${s.get('debug') ? 'checked' : ''}>
        </label>
      </div>
      <div style="margin-bottom:12px;">
        <h4>${t('settings.keys')}</h4>
        ${keysHtml}
        <button id="set-reset-keys" style="margin-top:8px;background:#555;color:#fff;border:none;padding:4px 12px;cursor:pointer;">
          ${t('settings.resetKeys')}
        </button>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="set-back" style="background:#555;color:#fff;border:none;padding:6px 12px;cursor:pointer;">
          ${t('settings.back')}
        </button>
        <button id="set-save" style="background:#2e7d32;color:#fff;border:none;padding:6px 12px;cursor:pointer;">
          ${t('settings.save')}
        </button>
      </div>
    `;

    this.container.querySelector('#set-back').onclick = () => {
      this.toggle();
      if (this.world.ui.menu && !this.world.ui.menu.visible) this.world.ui.menu.toggle();
    };
    this.container.querySelector('#set-save').onclick = () => this.saveAndClose();
    this.container.querySelector('#set-reset-keys').onclick = () => {
      this.input.resetKeys();
      this.render();
    };
    this.container.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.onclick = () => this.startRebind(btn.dataset.action);
    });
  }

  startRebind(action) {
    this.rebindingAction = action;
    this.render();
    const handler = (e) => {
      e.preventDefault();
      this.input.rebind(action, e.code);
      this.rebindingAction = null;
      window.removeEventListener('keydown', handler, true);
      this.render();
    };
    window.addEventListener('keydown', handler, true);
  }

  saveAndClose() {
    const showMinimap = this.container.querySelector('#set-minimap').checked;
    const showGlobalMap = this.container.querySelector('#set-global-map').checked;
    const debug = this.container.querySelector('#set-debug').checked;

    const prevMinimap = this.settings.get('showMinimap');
    const prevGlobalMap = this.settings.get('showGlobalMap');
    const prevDebug = this.settings.get('debug');

    this.settings.set('showMinimap', showMinimap);
    this.settings.set('showGlobalMap', showGlobalMap);
    this.settings.set('debug', debug);
    this.settings.set('keyBindings', { ...this.input.keyBindings });
    this.settings.save();

    if (prevDebug !== debug) {
      this.world.eventBus.emit('settings:debug-changed', debug);
    }

    if (prevMinimap !== showMinimap || prevGlobalMap !== showGlobalMap) {
      this.world.eventBus.emit('settings:maps-changed', { showMinimap, showGlobalMap });
    }

    this.toggle();
    if (this.world.ui.menu && !this.world.ui.menu.visible) this.world.ui.menu.toggle();
  }
}

export class SettingsStore {
  constructor() {
    this.data = {
      showMinimap: true,
      showGlobalMap: true,
      debug: false,
      keyBindings: { ...GAME_KEYS }
    };
    this._load();
  }
  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; }
  _load() {
    try {
      const raw = localStorage.getItem('subgraphs_settings');
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch {}
  }
  save() {
    try { localStorage.setItem('subgraphs_settings', JSON.stringify(this.data)); } catch {}
  }
}