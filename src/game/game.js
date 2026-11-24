// src/game/game.js

import { World } from '../world/world.js';
import { InputSystem } from '../input/input.js';
import { HUD } from '../ui/hud.js';
import { InventoryUI } from '../ui/inventory.js';
import { Minimap } from '../ui/minimap.js';
import { GlobalMap } from '../ui/global-map.js';
import { Menu } from '../ui/menu.js';
import { SettingsScreen, SettingsStore } from '../ui/settings-screen.js';
import { DataScreen } from '../ui/data-screen.js';
import { DebugOverlay } from '../render/debug.js';
import { Renderer, injectRendererStyles } from '../render/renderer.js';
import { SaveManager } from '../save/save-manager.js';
import { applyPlayerLoadout } from './loadout.js';
import { VIEW_W, VIEW_H, CELL_SIZE } from '../core/constants.js';

export class GameEngine {
  constructor(db, assets) {
    this.db = db;
    this.assets = assets;
    this.world = new World(db, assets);
    this.world.game = this;
    this.saveManager = new SaveManager(db, this.world);
    this.settings = new SettingsStore();

    this.lastTime = 0;
    this.running = false;
    this.autoSaveTimer = 0;
    this.worldDataMissing = false;

    this.dom = null;
    this.renderer = null;
    this.debug = null;
    this.input = null;
  }

  async init() {
    injectRendererStyles();
    this.createDOM();
    this.bindUI();

    this.world.eventBus.on('player:died', () => this.onPlayerDied());
    this.world.eventBus.on('player:respawned', () => this.onPlayerRespawned());

    try {
      await this.world.init();
      applyPlayerLoadout(this.world.player);
    } catch (err) {
      console.warn('[Subgraphs] World init failed (data missing?):', err.message);
      this.worldDataMissing = true;
      this.world.eventBus.emit('hud:message', 'Данные не загружены. Меню → Данные игры → Загрузить ZIP.');
      this.showDataPrompt();
    }
  }

  showDataPrompt() {
    const overlay = document.createElement('div');
    overlay.id = 'data-missing-prompt';
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #ff9800;border-radius:8px;
      padding:24px;z-index:1500;color:#eee;font-family:monospace;text-align:center;
      max-width:420px;
    `;
    overlay.innerHTML = `
      <h3 style="margin-top:0;color:#ff9800;">Данные игры не загружены</h3>
      <p>Чтобы начать играть, загрузите ZIP с данными игры.</p>
      <button id="open-data-screen" style="padding:8px 16px;background:#1565c0;color:#fff;border:none;cursor:pointer;margin-right:8px;">
        Открыть «Данные игры»
      </button>
      <button id="open-menu" style="padding:8px 16px;background:#555;color:#fff;border:none;cursor:pointer;">
        Меню
      </button>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#open-data-screen').onclick = () => {
      overlay.remove();
      this.world.ui.dataScreen.toggle();
    };
    overlay.querySelector('#open-menu').onclick = () => {
      overlay.remove();
      this.world.ui.menu.toggle();
    };
  }

  async reloadWorld() {
    this.worldDataMissing = false;
    try {
      await this.world.init();
      applyPlayerLoadout(this.world.player);
      this.world.eventBus.emit('hud:message', 'Мир загружен');
    } catch (err) {
      console.warn('[Subgraphs] Reload failed:', err.message);
      this.worldDataMissing = true;
      this.showDataPrompt();
    }
  }

  createDOM() {
    const root = document.createElement('div');
    root.id = 'subgraphs-root';
    root.style.cssText = 'display:flex;flex-direction:row;gap:16px;margin:20px auto;user-select:none;width:auto;';
    document.body.appendChild(root);

    const viewport = document.createElement('div');
    viewport.id = 'viewport-container';
    viewport.style.cssText = `position:relative;width:${VIEW_W * CELL_SIZE}px;height:${VIEW_H * CELL_SIZE}px;overflow:hidden;flex-shrink:0;background:#000;`;
    root.appendChild(viewport);

    const gameCanvas = document.createElement('canvas');
    gameCanvas.width = VIEW_W * CELL_SIZE;
    gameCanvas.height = VIEW_H * CELL_SIZE;
    gameCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:1;cursor:crosshair;';
    viewport.appendChild(gameCanvas);

    const obstacleCanvas = document.createElement('canvas');
    obstacleCanvas.width = VIEW_W * CELL_SIZE;
    obstacleCanvas.height = VIEW_H * CELL_SIZE;
    obstacleCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:2;pointer-events:none;';
    viewport.appendChild(obstacleCanvas);

    const entityLayer = document.createElement('div');
    entityLayer.id = 'entity-layer';
    entityLayer.style.cssText = 'position:absolute;top:0;left:0;z-index:12;pointer-events:none;width:100%;height:100%;';
    viewport.appendChild(entityLayer);

    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'display:flex;flex-direction:column;gap:12px;flex-shrink:0;';
    root.appendChild(sidebar);

    this.dom = { root, viewport, gameCanvas, obstacleCanvas, entityLayer, sidebar };
  }

  bindUI() {
    this.renderer = new Renderer(
      this.world,
      this.dom.gameCanvas,
      this.dom.obstacleCanvas,
      this.dom.entityLayer
    );

    this.input = new InputSystem(this.world);
    this.input.init(this.dom.gameCanvas);
    this.input.keyBindings = { ...this.settings.get('keyBindings') };

    const hud = new HUD(this.world);
    hud.mount(this.dom.sidebar);

    const minimap = new Minimap(this.world);
    minimap.mount(this.dom.sidebar);
    minimap.setVisible(this.settings.get('showMinimap'));

    const globalMap = new GlobalMap(this.world);
    globalMap.mount(this.dom.sidebar);
    globalMap.setVisible(this.settings.get('showGlobalMap'));

    const inventory = new InventoryUI(this.world);
    inventory.mount();

    this.debug = new DebugOverlay(this.world, this.dom.viewport);
    this.debug.setEnabled(!!this.settings.get('debug'));

    const settingsScreen = new SettingsScreen(this.world, this.input, this.settings, this.debug);
    settingsScreen.mount();

    const menu = new Menu(this.world, this.saveManager);
    menu.mount();

    const dataScreen = new DataScreen(this.world, this.db, this.saveManager);
    dataScreen.mount();
    dataScreen.onAfterImport = () => {
      if (this.worldDataMissing) this.reloadWorld();
    };

    this.world.ui = { hud, inventory, minimap, globalMap, menu, settings: settingsScreen, dataScreen };

    this.world.eventBus.on('sector:changed', () => {
      if (this.renderer) this.renderer.draw();
    });

    this.world.eventBus.on('settings:debug-changed', (enabled) => {
      this.debug.setEnabled(!!enabled);
    });

    this.world.eventBus.on('settings:maps-changed', ({ showMinimap, showGlobalMap }) => {
      this.world.ui.minimap.setVisible(showMinimap);
      this.world.ui.globalMap.setVisible(showGlobalMap);
    });
  }

  onPlayerDied() {
    this.world.eventBus.emit('hud:message', 'Вы погибли…');
  }

  onPlayerRespawned() {
    this.world.eventBus.emit('hud:message', 'Респавн');
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (!this.worldDataMissing && this.world.player && this.world.grid.sector) {
      if (this.world.player.isAlive) {
        const move = this.input.getMoveDir();
        if (move.dx !== 0 || move.dy !== 0) {
          this.world.tryPlayerMove(move.dx, move.dy);
        }
      }

      this.world.update(dt, now);

      this.world.ui.hud.update(this.world.player, this.world.currentSectorId, this.world.aliveBotCount());
      this.world.ui.minimap.draw();
      this.world.ui.globalMap.draw();

      if (this.debug.enabled) this.debug.redraw();
      this.renderer.draw();

      if (now - this.autoSaveTimer > 5 * 60 * 1000) {
        this.autoSaveTimer = now;
        this.saveManager.saveAuto().catch((e) => console.error('[AutoSave]', e));
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }
}