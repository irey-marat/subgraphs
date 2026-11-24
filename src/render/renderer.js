// src/render/renderer.js

import { CELL_SIZE, VIEW_W, VIEW_H, TERRAIN_SPRITE_KEY } from '../core/constants.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';

export class Renderer {
  constructor(world, canvas, obstacleCanvas, entityLayer) {
    this.world = world;
    this.canvas = canvas;
    this.obstacleCanvas = obstacleCanvas;
    this.entityLayer = entityLayer;

    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.obstacleCtx = obstacleCanvas.getContext('2d');
    this.obstacleCtx.imageSmoothingEnabled = false;

    this.sprites = new Map();
    this.projectileSprites = new Map();
    this.smokeElements = new Map();

    this.world.eventBus.on('entity:spawned', (e) => this.createEntitySprite(e));
    this.world.eventBus.on('entity:removed', (e) => this.destroyEntitySprite(e));
    this.world.eventBus.on('fx:hit', (fx) => this.spawnHitFx(fx));
    this.world.eventBus.on('fx:explosion', (fx) => this.spawnExplosionFx(fx));
  }

  createEntitySprite(entity) {
    if (this.sprites.has(entity.id)) return;

    const el = document.createElement('img');
    el.style.cssText = `position:absolute;width:${CELL_SIZE}px;height:${CELL_SIZE}px;image-rendering:pixelated;pointer-events:none;z-index:${entity.isPlayer ? 20 : 15};will-change:transform;`;
    const img = entity.isPlayer
      ? this.world.assets.getCharSprite(entity.currentWeaponId || 'tt33')
      : this.world.assets.getCharSprite(entity.profile?.primaryWeapon || 'ak47');
    if (img) el.src = img.src;
    this.entityLayer.appendChild(el);

    const hpBar = document.createElement('div');
    hpBar.style.cssText = `position:absolute;width:${CELL_SIZE}px;height:4px;background:#333;z-index:${entity.isPlayer ? 21 : 16};pointer-events:none;display:none;`;
    const hpFill = document.createElement('div');
    hpFill.style.cssText = 'height:100%;background:#4caf50;width:100%;';
    hpBar.appendChild(hpFill);
    this.entityLayer.appendChild(hpBar);

    this.sprites.set(entity.id, {
      element: el,
      hpBar,
      hpFill,
      lastWeaponId: entity.currentWeaponId,
      lastHp: entity.hp
    });
  }

  destroyEntitySprite(entity) {
    const s = this.sprites.get(entity.id);
    if (!s) return;
    if (s.element.parentNode) s.element.remove();
    if (s.hpBar.parentNode) s.hpBar.remove();
    this.sprites.delete(entity.id);
  }

  updateEntitySprites() {
    const cam = this.world.camera;
    for (const entity of this.world.entities.values()) {
      const s = this.sprites.get(entity.id);
      if (!s) { this.createEntitySprite(entity); continue; }
      if (!entity.isAlive) continue;

      const screen = cam.toScreen(entity.gx, entity.gy);
      s.element.style.left = screen.x + 'px';
      s.element.style.top = screen.y + 'px';
      s.element.style.transform = `rotate(${entity.facingAngle}rad)`;
      s.element.style.transformOrigin = (CELL_SIZE / 2) + 'px ' + (CELL_SIZE / 2) + 'px';
      s.element.style.display = 'block';

      const weaponId = entity.currentWeaponId;
      if (weaponId !== s.lastWeaponId) {
        const img = this.world.assets.getCharSprite(weaponId || (entity.isPlayer ? 'tt33' : 'ak47'));
        if (img) s.element.src = img.src;
        s.lastWeaponId = weaponId;
      }

      if (entity.hp < entity.maxHp) {
        s.hpBar.style.display = 'block';
        s.hpBar.style.left = screen.x + 'px';
        s.hpBar.style.top = (screen.y - 6) + 'px';
        const pct = Math.max(0, (entity.hp / entity.maxHp) * 100);
        s.hpFill.style.width = pct + '%';
        s.hpFill.style.background = pct > 60 ? '#4caf50' : (pct > 30 ? '#ff9800' : '#f44336');
      } else {
        s.hpBar.style.display = 'none';
      }
      s.lastHp = entity.hp;
    }
  }

  drawGround() {
    const cam = this.world.camera;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const terrain = this.world.assets.getImage(TERRAIN_SPRITE_KEY);
    if (!terrain) {
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const startGx = Math.floor(cam.x) - 1;
    const startGy = Math.floor(cam.y) - 1;
    const endGx = startGx + VIEW_W + 1;
    const endGy = startGy + VIEW_H + 1;
    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const scr = cam.toScreen(gx, gy);
        ctx.drawImage(terrain, scr.x, scr.y, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  drawObstacles() {
    const grid = this.world.grid;
    const cam = this.world.camera;
    const ctx = this.obstacleCtx;
    ctx.clearRect(0, 0, this.obstacleCanvas.width, this.obstacleCanvas.height);
    if (!grid.sector) return;

    const pad = 2;
    const startGx = Math.floor(cam.x) - pad;
    const startGy = Math.floor(cam.y) - pad;
    const endGx = Math.ceil(cam.x + VIEW_W) + pad;
    const endGy = Math.ceil(cam.y + VIEW_H) + pad;

    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const obs = grid.getObstacleAtCell(gx, gy);
        if (!obs) continue;
        if (obs.anchorGx !== gx || obs.anchorGy !== gy) continue;
        const def = OBSTACLE_TYPES[obs.logicType];
        if (!def) continue;
        const scr = cam.toScreen(gx, gy);
        const w = def.size[0] * CELL_SIZE;
        const h = def.size[1] * CELL_SIZE;
        if (scr.x + w < 0 || scr.x > VIEW_W * CELL_SIZE) continue;
        if (scr.y + h < 0 || scr.y > VIEW_H * CELL_SIZE) continue;
        const img = this.world.assets.getImage(obs.rawKey);
        if (img) {
          ctx.drawImage(img, scr.x, scr.y, w, h);
        } else {
          ctx.fillStyle = obs.logicType === 'water' ? 'rgba(70,130,180,0.4)' : 'rgba(85,107,47,0.4)';
          ctx.fillRect(scr.x, scr.y, w, h);
        }
      }
    }
  }

  updateProjectiles() {
    const cam = this.world.camera;
    const active = new Set();

    for (const proj of this.world.projectiles) {
      active.add(proj);
      let el = this.projectileSprites.get(proj);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = 'position:absolute;pointer-events:none;z-index:100;border-radius:40%;';

        if (proj.isGrenade) {
          el.style.width = '8px';
          el.style.height = '8px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = proj.grenade.itemId === 'grenade_smoke' ? '#888' : '#c44';
          el.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
        } else {
          const ammo = proj.ammo;
          if (ammo.shape === 'circle') {
            el.style.width = ammo.size + 'px';
            el.style.height = ammo.size + 'px';
            el.style.borderRadius = '50%';
          } else {
            el.style.width = ammo.size[0] + 'px';
            el.style.height = ammo.size[1] + 'px';
          }
          el.style.backgroundColor = ammo.color;
          el.style.boxShadow = proj.owner === this.world.player
            ? '0 0 6px rgba(255,220,80,0.9)'
            : '0 0 6px rgba(255,120,120,0.9)';
        }

        this.entityLayer.appendChild(el);
        this.projectileSprites.set(proj, el);
      }

      const screen = cam.toScreen(proj.wx - 0.5, proj.wy - 0.5);
      el.style.left = (screen.x + CELL_SIZE / 2 - 4) + 'px';
      el.style.top = (screen.y + CELL_SIZE / 2 - 4) + 'px';
      if (!proj.isGrenade) {
        const angle = Math.atan2(proj.dirY, proj.dirX) * 180 / Math.PI;
        el.style.transform = `rotate(${angle}deg)`;
      }
    }

    for (const [proj, el] of this.projectileSprites) {
      if (!active.has(proj)) {
        if (el.parentNode) el.remove();
        this.projectileSprites.delete(proj);
      }
    }
  }

  updateSmoke() {
    const cam = this.world.camera;
    const active = new Set();

    for (const smoke of this.world.smokeClouds) {
      if (smoke.sectorId !== this.world.currentSectorId) continue;
      const elapsed = performance.now() - smoke.createdAt;
      if (elapsed > smoke.duration) continue;

      active.add(smoke);
      let el = this.smokeElements.get(smoke);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = 'position:absolute;pointer-events:none;z-index:11;background:radial-gradient(circle, rgba(150,150,150,0.8), rgba(100,100,100,0.4), transparent);border-radius:50%;';
        this.entityLayer.appendChild(el);
        this.smokeElements.set(smoke, el);
      }

      const radiusPx = smoke.radius * CELL_SIZE;
      const scr = cam.toScreen(smoke.gx - smoke.radius, smoke.gy - smoke.radius);
      el.style.left = scr.x + 'px';
      el.style.top = scr.y + 'px';
      el.style.width = (radiusPx * 2) + 'px';
      el.style.height = (radiusPx * 2) + 'px';

      const lifeRatio = 1 - elapsed / smoke.duration;
      el.style.opacity = (0.7 * lifeRatio).toFixed(2);
    }

    for (const [smoke, el] of this.smokeElements) {
      if (!active.has(smoke)) {
        if (el.parentNode) el.remove();
        this.smokeElements.delete(smoke);
      }
    }
  }

  spawnHitFx(fx) {
    const cam = this.world.camera;
    const scr = cam.toScreen(fx.gx, fx.gy);
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${scr.x + CELL_SIZE / 2 - 10}px;top:${scr.y + CELL_SIZE / 2 - 10}px;width:20px;height:20px;background:radial-gradient(circle,#ff6600,#ff0000);border-radius:50%;opacity:0.8;pointer-events:none;z-index:101;animation:hitFlash 0.2s ease-out forwards;`;
    this.entityLayer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
  }

  spawnExplosionFx(fx) {
    const cam = this.world.camera;
    const scr = cam.toScreen(fx.gx, fx.gy);
    const radius = (fx.radius || 2) * CELL_SIZE;
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${scr.x + CELL_SIZE / 2 - radius}px;top:${scr.y + CELL_SIZE / 2 - radius}px;width:${radius * 2}px;height:${radius * 2}px;background:radial-gradient(circle,rgba(255,200,50,0.9),rgba(255,100,0,0.7),transparent);border-radius:50%;pointer-events:none;z-index:101;animation:explode 0.35s ease-out forwards;`;
    this.entityLayer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
  }

  draw() {
    if (!this.world.grid || !this.world.grid.sector) return;
    this.drawGround();
    this.drawObstacles();
    this.updateEntitySprites();
    this.updateProjectiles();
    this.updateSmoke();
  }
}

export function injectRendererStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes explode { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
    @keyframes hitFlash { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
  `;
  document.head.appendChild(style);
}