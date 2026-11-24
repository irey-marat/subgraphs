// src/render/debug.js

import {
  VIEW_W, VIEW_H, CELL_SIZE, AI_STATE, POI_TYPE, INTENT
} from '../core/constants.js';
import { t } from '../core/strings.js';

const INTENT_COLORS = {
  [INTENT.PATROL]: '#888888',
  [INTENT.HOLD]: '#00ccff',
  [INTENT.PUSH]: '#ff6600',
  [INTENT.FALL_BACK]: '#ff3333',
  [INTENT.SEARCH]: '#ffcc00',
  [INTENT.LOOT]: '#66ff66'
};

export class DebugOverlay {
  constructor(world, container) {
    this.world = world;
    this.container = container;
    this.enabled = false;
    this.canvas = null;
    this.ctx = null;
    this.panel = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastRedraw = 0;
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.radioLog = [];
    this.mount();
  }

  mount() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIEW_W * CELL_SIZE;
    this.canvas.height = VIEW_H * CELL_SIZE;
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;z-index:99;pointer-events:none;display:none;';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.9);color:#0f0;
      padding:10px;font-family:monospace;font-size:11px;z-index:200;border-radius:5px;
      max-width:320px;display:none;
    `;
    this.panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">${t('debug.title')}</div>
      <div id="debug-coords">—</div>
      <div id="debug-fps">FPS: —</div>
      <div id="debug-entities">${t('debug.entities')}: —</div>
      <div id="debug-projectiles">${t('debug.projectiles')}: —</div>
      <hr style="margin:4px 0;border-color:#333;">
      <div id="debug-radio-log" style="font-size:10px;color:#aaa;max-height:100px;overflow-y:auto;"></div>
    `;
    document.body.appendChild(this.panel);

    this.container.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const rect = this.container.getBoundingClientRect();
      this.mouseX = Math.floor((e.clientX - rect.left) / CELL_SIZE + this.world.camera.x);
      this.mouseY = Math.floor((e.clientY - rect.top) / CELL_SIZE + this.world.camera.y);
    });

    this.world.eventBus.on('bot:radio', (msg) => this.logRadio(msg));
  }

  logRadio(msg) {
    const time = new Date().toLocaleTimeString();
    this.radioLog.unshift(`[${time}] ${msg.name}: ${msg.type}`);
    if (this.radioLog.length > 10) this.radioLog.pop();
    const el = document.getElementById('debug-radio-log');
    if (el) el.innerHTML = this.radioLog.join('<br>');
  }

  setEnabled(on) {
    this.enabled = on;
    this.canvas.style.display = on ? 'block' : 'none';
    this.panel.style.display = on ? 'block' : 'none';
    if (!on) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  redraw() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastRedraw < 100) return;
    this.lastRedraw = now;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawLOS();
    this.drawBotStates();
    this.drawPOIs();
    this.drawPath();
    this.updateStats(now);
  }

  drawLOS() {
    const cam = this.world.camera;
    const from = cam.toScreen(this.world.player.gx, this.world.player.gy);
    const to = cam.toScreen(this.mouseX, this.mouseY);
    const cells = this.world.grid.getLineCells(
      this.world.player.gx, this.world.player.gy, this.mouseX, this.mouseY
    );
    let totalBlock = 0;
    const seen = new Set();
    for (let i = 1; i < cells.length - 1; i++) {
      const obs = this.world.grid.getObstacleAtCell(cells[i].x, cells[i].y);
      if (obs && !seen.has(obs.id)) {
        seen.add(obs.id);
        totalBlock += obs.visionBlock;
        if (totalBlock >= 1.0) break;
      }
    }
    const color = totalBlock >= 1.0 ? '#ff0000' : (totalBlock > 0.5 ? '#ff6600' : (totalBlock > 0 ? '#ffff00' : '#00ff00'));
    this.ctx.beginPath();
    this.ctx.moveTo(from.x + CELL_SIZE / 2, from.y + CELL_SIZE / 2);
    this.ctx.lineTo(to.x + CELL_SIZE / 2, to.y + CELL_SIZE / 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  drawBotStates() {
    const cam = this.world.camera;
    for (const bot of this.world.entities.values()) {
      if (bot.isPlayer || !bot.isAlive || !bot.botBrain) continue;
      const pos = cam.toScreen(bot.gx, bot.gy);
      const brain = bot.botBrain;

      const stateColor = brain.state === AI_STATE.PATROL ? '#00ff00'
        : (brain.state === AI_STATE.ALERT ? '#ffff00' : '#ff0000');

      this.ctx.fillStyle = stateColor;
      this.ctx.font = 'bold 10px monospace';
      this.ctx.fillText(brain.state, pos.x + 2, pos.y - 5);

      // Intent (3a-3): отображаем текущее намерение
      const intent = brain.currentIntent || '?';
      const intentColor = INTENT_COLORS[intent] || '#ffffff';
      this.ctx.fillStyle = intentColor;
      this.ctx.font = 'bold 9px monospace';
      this.ctx.fillText(intent.toUpperCase(), pos.x + 2, pos.y + 26);

      // Intent target (если есть)
      if (brain.intentTarget) {
        const tp = cam.toScreen(brain.intentTarget.gx, brain.intentTarget.gy);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
        this.ctx.lineTo(tp.x + CELL_SIZE / 2, tp.y + CELL_SIZE / 2);
        this.ctx.strokeStyle = intentColor + '99';
        this.ctx.setLineDash([3, 3]);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      this.ctx.font = '8px monospace';
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.fillText(`I:${brain.interest.toFixed(0)} S:${((bot.suppression || 0) * 100).toFixed(0)}%`, pos.x + 2, pos.y + 15);

      this.drawLookDirection(bot, pos);

      if (brain.lastSeenPlayerPos) {
        const tp = cam.toScreen(brain.lastSeenPlayerPos.gx, brain.lastSeenPlayerPos.gy);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
        this.ctx.lineTo(tp.x + CELL_SIZE / 2, tp.y + CELL_SIZE / 2);
        this.ctx.strokeStyle = 'rgba(0,255,255,0.4)';
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }
  }

  drawLookDirection(bot, pos) {
    const len = CELL_SIZE * 0.8;
    const ex = pos.x + CELL_SIZE / 2 + Math.cos(bot.facingAngle) * len;
    const ey = pos.y + CELL_SIZE / 2 + Math.sin(bot.facingAngle) * len;
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
    this.ctx.lineTo(ex, ey);
    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }

  drawPOIs() {
    const cam = this.world.camera;
    const pois = this.world.poiManager.getActiveForSector(this.world.currentSectorId);
    for (const poi of pois) {
      const pos = cam.toScreen(poi.gx, poi.gy);
      const color = poi.type === POI_TYPE.LOOT ? '#ffcc00'
        : (poi.type === POI_TYPE.ALERT ? '#ff4444' : '#44ff44');
      this.ctx.beginPath();
      this.ctx.arc(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2, poi.radius * CELL_SIZE, 0, Math.PI * 2);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.fillStyle = color;
      this.ctx.font = '8px monospace';
      this.ctx.fillText(poi.type, pos.x + 2, pos.y - 2);
    }
  }

  drawPath() {
    const cam = this.world.camera;
    for (const bot of this.world.entities.values()) {
      if (bot.isPlayer || !bot.botBrain || !bot.botBrain.currentPath) continue;
      const path = bot.botBrain.currentPath;
      if (path.length === 0) continue;
      this.ctx.beginPath();
      let started = false;
      for (const p of path) {
        const pos = cam.toScreen(p.gx, p.gy);
        if (!started) {
          this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
          started = true;
        } else {
          this.ctx.lineTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
        }
      }
      this.ctx.strokeStyle = 'rgba(255,255,0,0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  updateStats(now) {
    const dt = now - this.lastFrameTime;
    if (dt > 0) this.fps = this.fps * 0.9 + (1000 / dt) * 0.1;
    this.lastFrameTime = now;

    const q = (id) => document.getElementById(id);
    const coordsEl = q('debug-coords');
    if (coordsEl) coordsEl.textContent = `x: ${this.mouseX}, y: ${this.mouseY}`;
    const fpsEl = q('debug-fps');
    if (fpsEl) fpsEl.textContent = `FPS: ${Math.round(this.fps)}`;
    const entEl = q('debug-entities');
    if (entEl) entEl.textContent = `${t('debug.entities')}: ${this.world.entities.size}`;
    const projEl = q('debug-projectiles');
    if (projEl) projEl.textContent = `${t('debug.projectiles')}: ${this.world.projectiles.length}`;
  }
}