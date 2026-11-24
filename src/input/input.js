// src/input/input.js

import { GAME_KEYS, CELL_SIZE } from '../core/constants.js';
import { t } from '../core/strings.js';

export class InputSystem {
  constructor(world) {
    this.world = world;
    this.keys = {};
    this.keyBindings = { ...GAME_KEYS };
    this.canvas = null;
    this.listeners = [];
  }

  init(canvas) {
    this.canvas = canvas;
    this.bind();
  }

  bind() {
    const onKeyDown = (e) => {
      this.keys[e.code] = true;
      this.handleKeyDown(e);
    };
    const onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    const onMouseDown = (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { gx, gy } = this.world.camera.screenToGrid(sx, sy);
      this.world.handleClick(gx, gy);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    if (this.canvas) this.canvas.addEventListener('mousedown', onMouseDown);
    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => { if (this.canvas) this.canvas.removeEventListener('mousedown', onMouseDown); }
    );
  }

  handleKeyDown(e) {
    const k = this.keyBindings;

    if (e.code === k.ESCAPE) {
      if (this.world.selectedBeltSlot !== null) {
        this.world.cancelSelection();
        return;
      }
      this.world.ui.menu.toggle();
      return;
    }

    if (e.code === k.RELOAD) {
      this.world.player.reload();
      return;
    }
    if (e.code === k.SWAP_WEAPON) {
      const ok = this.world.player.switchWeaponSlot();
      this.world.eventBus.emit('hud:message', ok ? 'Переключено' : 'Нет оружия');
      return;
    }
    if (e.code === k.INVENTORY) {
      this.world.ui.inventory.toggle();
      return;
    }
    if (e.code === k.MINIMAP) {
      this.toggleMinimap();
      return;
    }
    if (e.code === k.GLOBAL_MAP) {
      this.toggleGlobalMap();
      return;
    }

    if (e.code === k.USE_SLOT_1) { this.world.selectBeltSlot(0); return; }
    if (e.code === k.USE_SLOT_2) { this.world.selectBeltSlot(1); return; }
    if (e.code === k.USE_SLOT_3) { this.world.selectBeltSlot(2); return; }
    if (e.code === k.USE_SLOT_4) { this.world.selectBeltSlot(3); return; }
  }

  toggleMinimap() {
    const settings = this.world.game && this.world.game.settings;
    if (!settings) {
      this.world.ui.minimap.toggle();
      return;
    }
    if (!settings.get('showMinimap')) {
      this.world.eventBus.emit('hud:message', t('msg.mapDisabledInSettings'));
      return;
    }
    this.world.ui.minimap.toggle();
  }

  toggleGlobalMap() {
    const settings = this.world.game && this.world.game.settings;
    if (!settings) {
      this.world.ui.globalMap.toggle();
      return;
    }
    if (!settings.get('showGlobalMap')) {
      this.world.eventBus.emit('hud:message', t('msg.mapDisabledInSettings'));
      return;
    }
    this.world.ui.globalMap.toggle();
  }

  getMoveDir() {
    const k = this.keyBindings;
    let dx = 0, dy = 0;
    if (this.keys[k.MOVE_UP]) dy = -1;
    if (this.keys[k.MOVE_DOWN]) dy = 1;
    if (this.keys[k.MOVE_LEFT]) dx = -1;
    if (this.keys[k.MOVE_RIGHT]) dx = 1;
    return { dx, dy };
  }

  rebind(action, code) {
    if (Object.prototype.hasOwnProperty.call(this.keyBindings, action)) {
      this.keyBindings[action] = code;
    }
  }

  resetKeys() {
    this.keyBindings = { ...GAME_KEYS };
  }

  destroy() {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}