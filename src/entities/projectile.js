// src/entities/projectile.js

import { CELL_SIZE, SUPPRESSION_GAIN, SUPPRESSION_NEAR_RADIUS } from '../core/constants.js';
import { BALLISTICS } from '../data/ballistics.js';
import { rollHitZone } from '../data/armor.js';

export class Projectile {
  constructor({ weapon, ammo, startGx, startGy, dirX, dirY, owner, world, grenade = null }) {
    this.weapon = weapon;
    this.ammo = ammo;
    this.owner = owner;
    this.world = world;

    this.wx = startGx + 0.5;
    this.wy = startGy + 0.5;
    this.dirX = dirX;
    this.dirY = dirY;

    this.isGrenade = !!grenade;
    this.grenade = grenade;

    if (this.isGrenade) {
      this.massKg = 0.4;
      this.E = 0;
      this.E0 = 0;
      this.velocityPx = 0;
      this.physicalSpeedPx = 0;
      this.traveledCells = 0;
      this.maxCells = 0;
      this.maxDistance = 0;
      this.isRocket = false;
      this.startGx = Math.floor(startGx);
      this.startGy = Math.floor(startGy);
      this.createdAt = performance.now();
      this.alive = true;
      this.element = null;
      this.suppressedCells = new Set();
      return;
    }

    this.massKg = ammo.mass_g / 1000;
    this.v0 = ammo.v0_mps * weapon.v0_scale;
    this.E = 0.5 * this.massKg * this.v0 * this.v0;
    this.E0 = this.E;

    const physicalSpeedPx = this.v0 * CELL_SIZE;
    const maxVisualSpeedPx = BALLISTICS.VISUAL_SPEED_CELLS_PER_FRAME * CELL_SIZE * 60;
    this.velocityPx = Math.min(physicalSpeedPx, maxVisualSpeedPx);
    this.physicalSpeedPx = physicalSpeedPx;

    this.traveledCells = 0;
    this.maxCells = weapon.range;

    this.isRocket = !!ammo.isRocket;

    this.startGx = Math.floor(startGx);
    this.startGy = Math.floor(startGy);
    this.createdAt = performance.now();
    this.alive = true;

    this.element = null;

    // B2: клетки, для которых уже начислено подавление от пролёта
    this.suppressedCells = new Set();
  }

  penetrationMm() {
    if (this.isGrenade) return 0;
    return this.ammo.penetrationBase_mm * (this.E / this.E0);
  }

  physicalVelocityMps() {
    if (this.isGrenade) return 0;
    return Math.sqrt(2 * this.E / this.massKg);
  }

  update(dt) {
    if (this.isGrenade) return this.updateGrenade(dt);

    const vPhysical = this.physicalVelocityMps();
    if (this.E < BALLISTICS.MIN_ENERGY_J || vPhysical < BALLISTICS.MIN_VELOCITY_MPS) {
      if (this.isRocket) this.detonate(this.wx, this.wy);
      return false;
    }

    const stepCells = (this.velocityPx * dt) / CELL_SIZE;
    const nx = this.wx + this.dirX * stepCells;
    const ny = this.wy + this.dirY * stepCells;

    this.E *= (1 - this.ammo.dragPerCell * stepCells);

    const cellX = Math.floor(nx);
    const cellY = Math.floor(ny);
    const grid = this.world.grid;

    const obs = grid.getObstacleAtCell(cellX, cellY);
    if (obs && obs.obstacleResistance > 0) {
      if (this.isRocket) {
        this.detonate(nx, ny);
        return false;
      }
      const resMm = obs.obstacleResistance * BALLISTICS.OBSTACLE_MM_SCALE;
      const penMm = this.penetrationMm();
      if (penMm < resMm) {
        this.E *= (1 - resMm / Math.max(penMm, 0.01));
      } else {
        this.E *= (1 - (resMm / penMm) * 0.3);
      }
      if (this.E < BALLISTICS.MIN_ENERGY_J) return false;
    }

    const target = this.world.checkHit(cellX, cellY, this.owner);
    if (target) {
      if (this.isRocket) this.detonate(nx, ny, target);
      else this.applyDamage(target);
      return false;
    }

    // B2: подавление от пролёта рядом с персонажем
    this.applyFlybySuppression(cellX, cellY);

    if (this.traveledCells >= this.maxCells) {
      if (this.isRocket) this.detonate(nx, ny);
      return false;
    }

    this.wx = nx;
    this.wy = ny;
    this.traveledCells += stepCells;
    return true;
  }

  applyFlybySuppression(cellX, cellY) {
    const key = cellX + ',' + cellY;
    if (this.suppressedCells.has(key)) return;
    this.suppressedCells.add(key);

    for (const e of this.world.entities.values()) {
      if (e === this.owner) continue;
      if (!e.isAlive) continue;
      if (e.isPlayer && this.owner === this.world.player) continue;
      if (!e.isPlayer && this.owner !== this.world.player) continue;

      const dist = Math.max(Math.abs(e.gx - cellX), Math.abs(e.gy - cellY));
      if (dist > SUPPRESSION_NEAR_RADIUS) continue;
      if (dist === 0) continue;

      const supResist = e.stats.endurance / 20;
      const gain = SUPPRESSION_GAIN * 0.3 * (1 - supResist) * (1 - dist / (SUPPRESSION_NEAR_RADIUS + 1));
      e.suppression = Math.min(1.0, e.suppression + gain);
    }
  }

  updateGrenade(dt) {
    const g = this.grenade;
    const now = performance.now();
    const elapsed = now - g.throwTime;

    if (elapsed >= g.fuseTime) {
      this.grenadeExplode();
      return false;
    }

    const t = Math.min(1, elapsed / g.fuseTime);
    this.wx = g.startGx + 0.5 + (g.targetGx - g.startGx) * t;
    this.wy = g.startGy + 0.5 + (g.targetGy - g.startGy) * t;
    return true;
  }

  grenadeExplode() {
    const g = this.grenade;
    const itemId = g.itemId;

    if (itemId === 'grenade_frag') {
      this.world.explodeAt(g.targetGx, g.targetGy, {
        explosiveMass_g: 300,
        radiusCells: 2,
        shrapnelCount: 6,
        shrapnelRange: 3,
        owner: this.owner
      });
    } else if (itemId === 'grenade_smoke') {
      this.world.createSmokeCloud({
        sectorId: this.world.currentSectorId,
        gx: Math.floor(g.targetGx),
        gy: Math.floor(g.targetGy),
        radius: 3,
        duration: 5000,
        owner: this.owner
      });
    }
  }

  applyDamage(target) {
    const zone = rollHitZone();
    const armor = target.getArmorForZone(zone);
    const armorMm = armor ? armor.armorClass_mm : 0;
    const penMm = this.penetrationMm();
    const E = this.E;

    let damage;
    if (penMm >= armorMm) {
      damage = E * BALLISTICS.K_PEN;
    } else {
      damage = E * BALLISTICS.K_NONPEN * (1 - armorMm / Math.max(penMm, 0.01));
    }
    const finalDamage = Math.max(0, damage * zone.multiplier);

    target.applyDamage(finalDamage, this.owner, zone);
    this.world.hitEffect(target, zone);
    this.world.emitSuppressionNear(target.gx, target.gy, target);
  }

  detonate(x, y, directTarget = null) {
    if (directTarget) {
      const cumPen = this.penetrationMm();
      if (cumPen >= BALLISTICS.CUML_THRESHOLD_MM) {
        const cumDamage = this.ammo.explosiveMass_g * BALLISTICS.CUML_DAMAGE_MULT;
        directTarget.applyDamage(cumDamage, this.owner, null);
      }
    }
    this.world.explodeAt(x, y, {
      explosiveMass_g: this.ammo.explosiveMass_g,
      radiusCells: this.ammo.explosionRadius || 0,
      shrapnelCount: this.ammo.shrapnelCount || 0,
      shrapnelRange: this.ammo.shrapnelRange || 0,
      owner: this.owner,
      weapon: this.weapon
    });
  }

  serialize() {
    if (this.isGrenade) {
      return { isGrenade: true, grenade: this.grenade, owner: this.owner };
    }
    return {
      weaponId: this.weapon.id,
      owner: this.owner,
      wx: this.wx, wy: this.wy,
      dirX: this.dirX, dirY: this.dirY,
      E: this.E, E0: this.E0,
      traveledCells: this.traveledCells
    };
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }
}