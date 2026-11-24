// src/entities/entity.js

import { Stats } from './stats.js';
import { Inventory } from './inventory.js';
import { CELL_SIZE, BOT_TURN_DELAY_MS, SPRITE_ANGLE_OFFSET, SUPPRESSION_GAIN, SOUND_LOUDNESS } from '../core/constants.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR_ITEMS } from '../data/armor.js';
import { AMMUNITION_TYPES, getCharacterSpriteKey } from '../data/ammunition.js';

export class Entity {
  constructor({ id, type, gx, gy, profile, world }) {
    this.id = id;
    this.type = type;
    this.gx = gx;
    this.gy = gy;
    this.world = world;
    this.isPlayer = type === 'player';
    this.profile = profile || null;

    this.stats = new Stats();
    this.hp = this.stats.maxHp;
    this.inventory = new Inventory();

    this.moveCooldown = 0;
    this.moveDirection = { dx: 0, dy: 0 };
    this.isMoving = false;

    this.spriteElement = null;
    this.hpBarElement = null;
    this.facingAngle = 0;
    this.lastTurnTime = 0;

    this.activeWeaponSlot = 'primary';
    this.currentWeaponId = null;
    this.currentAmmo = 0;
    this.isReloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;

    this.recoil = 0;
    this.suppression = 0;
    this.currentBurstId = null;
    this.currentSpread = 0;
    this.burstSpreadGain = 0.035;

    this.botBrain = null;
    this.xp = 0;
    this.level = 1;
    this.pointsAvailable = 0;
    this.invulnerableUntil = 0;
  }

  get maxHp() { return this.stats.maxHp; }
  get isAlive() { return this.hp > 0; }

  getActiveWeapon() {
    return WEAPONS[this.currentWeaponId] || null;
  }

  equipWeapon(weaponId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return false;
    this.currentWeaponId = weaponId;
    this.inventory.equip(weapon.slot, { id: weaponId, weight: weapon.weight });
    this.currentAmmo = weapon.magazineSize;
    return true;
  }

  switchWeaponSlot() {
    const targetSlot = this.activeWeaponSlot === 'primary' ? 'secondary' : 'primary';
    const invSlot = targetSlot === 'primary' ? 'weapon' : 'secondary';
    const item = this.inventory.slots[invSlot];
    if (!item) return false;
    const weapon = WEAPONS[item.id];
    if (!weapon) return false;
    this.activeWeaponSlot = targetSlot;
    this.currentWeaponId = item.id;
    this.currentAmmo = weapon.magazineSize;
    this.isReloading = false;
    this.currentBurstId = null;
    return true;
  }

  getDistanceTo(targetGx, targetGy, metric = 'chebyshev') {
    const dx = Math.abs(targetGx - this.gx);
    const dy = Math.abs(targetGy - this.gy);
    return metric === 'euclidean' ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }

  faceMovementDirection() {
    if (this.moveDirection.dx !== 0 || this.moveDirection.dy !== 0) {
      this.facingAngle = Math.atan2(this.moveDirection.dy, this.moveDirection.dx);
    }
  }

  faceTarget(targetGx, targetGy) {
    const dx = targetGx - this.gx;
    const dy = targetGy - this.gy;
    if (dx !== 0 || dy !== 0) this.facingAngle = Math.atan2(dy, dx);
  }

  smoothFaceTarget(targetGx, targetGy, now) {
    if (now - this.lastTurnTime < BOT_TURN_DELAY_MS) return;
    this.faceTarget(targetGx, targetGy);
    this.lastTurnTime = now;
  }

  updateSpriteRotation() {
    if (this.spriteElement) {
      this.spriteElement.style.transform = 'rotate(' + (this.facingAngle + SPRITE_ANGLE_OFFSET) + 'rad)';
      this.spriteElement.style.transformOrigin = (CELL_SIZE / 2) + 'px ' + (CELL_SIZE / 2) + 'px';
    }
  }

  calculateAccuracy(weapon) {
    let accuracy = weapon.accuracy;
    const suppressionPenalty = this.suppression * 0.5;
    accuracy *= (1 - suppressionPenalty);
    const recoilPenalty = this.recoil * (weapon.recoilSpreadMultiplier || 0.5);
    accuracy -= recoilPenalty;
    const enduranceBonus = (this.stats.endurance - 10) * 0.02;
    accuracy += enduranceBonus;
    return Math.max(0.1, Math.min(0.95, accuracy));
  }

  shoot(targetGx, targetGy) {
    const weapon = this.getActiveWeapon();
    if (!weapon) return false;
    const now = performance.now();
    if (now - this.lastShotTime < weapon.fireRate) return false;
    if (this.currentAmmo <= 0) { this.reload(); return false; }
    if (this.getDistanceTo(targetGx, targetGy, 'euclidean') > weapon.range) return false;

    const visible = this.world.losCache.hasLineOfSight(
      this.world.grid, this.gx, this.gy, targetGx, targetGy, now
    );
    if (!visible) return false;

    this.lastShotTime = now;
    this.faceTarget(targetGx, targetGy);
    this.updateSpriteRotation();

    const loudness = SOUND_LOUDNESS[weapon.ammoId] || 0.5;
    this.world.soundManager.emitSound(this.gx, this.gy, loudness, 'gunshot', this);
    this.world.createAlertPOI(this.gx, this.gy);

    const burst = weapon.burstCount > 1;
    const actualBurst = burst
      ? (weapon.burstCount > 2 ? weapon.burstCount + Math.floor(Math.random() * 3) - 1 : weapon.burstCount)
      : 1;

    if (burst) {
      this.fireBurst(targetGx, targetGy, weapon, actualBurst);
    } else {
      this.fireSingle(targetGx, targetGy, weapon);
    }
    return true;
  }

  fireBurst(targetGx, targetGy, weapon, burstCount) {
    const burstId = Date.now() + '_' + Math.random();
    this.currentBurstId = burstId;
    let fired = 0;
    const self = this;
    const fireNext = () => {
      if (self.currentBurstId !== burstId) return;
      if (self.currentAmmo <= 0) return;
      if (self.hp <= 0) return;
      self.fireSingle(targetGx, targetGy, weapon);
      fired++;
      self.currentSpread += self.burstSpreadGain || 0.035;
      if (fired < burstCount) {
        self.world.taskQueue.schedule(weapon.burstInterval, fireNext);
      } else if (self.botBrain) {
        self.botBrain.lastBurstEndTime = performance.now();
      }
    };
    fireNext();
  }

  fireSingle(targetGx, targetGy, weapon) {
    if (this.currentAmmo <= 0) { this.reload(); return; }
    const finalAccuracy = this.calculateAccuracy(weapon);
    const startGx = this.gx;
    const startGy = this.gy;
    const targetX = targetGx + 0.5;
    const targetY = targetGy + 0.5;
    const startX = startGx + 0.5;
    const startY = startGy + 0.5;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;

    const spreadAngle = (1 - finalAccuracy) * 0.8 + this.currentSpread;
    const angleOffset = (Math.random() - 0.5) * spreadAngle;
    const cos = Math.cos(angleOffset);
    const sin = Math.sin(angleOffset);
    const finalDirX = dirX * cos - dirY * sin;
    const finalDirY = dirX * sin + dirY * cos;

    const ammo = AMMUNITION_TYPES[weapon.ammoId];
    const pellets = ammo.pellets || 1;

    for (let i = 0; i < pellets; i++) {
      let pdx = finalDirX;
      let pdy = finalDirY;
      if (pellets > 1) {
        const pAngle = (Math.random() - 0.5) * (1 - weapon.accuracy) * 0.3;
        pdx = finalDirX * Math.cos(pAngle) - finalDirY * Math.sin(pAngle);
        pdy = finalDirX * Math.sin(pAngle) + finalDirY * Math.cos(pAngle);
      }
      const proj = new ProjectileLazy({
        weapon, ammo,
        startGx, startGy,
        dirX: pdx, dirY: pdy,
        owner: this,
        world: this.world
      });
      this.world.addProjectile(proj);
    }

    this.currentAmmo--;
    this.recoil = Math.min(weapon.maxRecoil, this.recoil + weapon.recoilPerShot);
  }

  throwGrenade(targetGx, targetGy, itemId) {
    const now = performance.now();
    if (now - this.lastShotTime < 500) return false;
    if (!targetGx && targetGx !== 0) return false;
    if (!targetGy && targetGy !== 0) return false;

    const beltItem = this.inventory.belt.find((b) => b && b.id === itemId);
    if (!beltItem) return false;

    const idx = this.inventory.belt.findIndex((b) => b && b.id === itemId);
    this.inventory.belt[idx] = null;

    this.lastShotTime = now;
    this.faceTarget(targetGx, targetGy);
    this.updateSpriteRotation();

    const grenade = {
      itemId,
      targetGx,
      targetGy,
      fuseTime: 1500,
      throwTime: now,
      startGx: this.gx,
      startGy: this.gy
    };

    const proj = new ProjectileLazy({
      weapon: null,
      ammo: null,
      startGx: this.gx,
      startGy: this.gy,
      dirX: 0,
      dirY: 0,
      owner: this,
      world: this.world,
      grenade
    });
    this.world.addProjectile(proj);
    this.world.soundManager.emitSound(this.gx, this.gy, 0.3, 'gunshot', this);
    return true;
  }

  reload() {
    if (this.isReloading) return;
    const weapon = this.getActiveWeapon();
    if (!weapon) return;
    if (this.currentAmmo === weapon.magazineSize) return;
    this.currentBurstId = null;
    this.isReloading = true;
    this.reloadEndTime = performance.now() + weapon.reloadTime;
    const self = this;
    this.world.taskQueue.schedule(weapon.reloadTime, () => {
      if (!self.isAlive) return;
      self.currentAmmo = weapon.magazineSize;
      self.isReloading = false;
      self.reloadEndTime = 0;
    });
  }

  updateRecovery(dt) {
    if (this.recoil > 0) {
      const weapon = this.getActiveWeapon();
      if (weapon) {
        const recovery = weapon.recoilRecovery * dt * 60;
        this.recoil = Math.max(0, this.recoil - recovery);
      }
    }
    if (this.currentSpread > 0) {
      this.currentSpread = Math.max(0, this.currentSpread - dt * 0.4);
    }
    if (this.suppression > 0) {
      const recoveryRate = 0.1 * (1 + (this.stats.endurance - 10) * 0.05);
      this.suppression = Math.max(0, this.suppression - recoveryRate * dt);
    }
    if (this.isReloading && performance.now() >= this.reloadEndTime) {
      this.isReloading = false;
      this.reloadEndTime = 0;
    }
  }

  applyDamage(damage, source, zone) {
    if (!this.isAlive) return;
    this.hp -= damage;
    const endurance = this.stats.endurance;
    const supResist = endurance / 20;
    this.suppression = Math.min(1.0, this.suppression + SUPPRESSION_GAIN * (1 - supResist));
    if (this.botBrain && source) {
      this.botBrain.onTakeDamage(damage, source);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.world.removeEntity(this);
    }
  }

  getArmorForZone(zone) {
    const slot = zone.armorSlot;
    const item = this.inventory.slots[slot];
    if (!item) return null;
    const def = ARMOR_ITEMS[item.id];
    if (!def) return null;
    if (!def.coverage.includes(zone.id)) return null;
    return def;
  }

  gainXP(amount) {
    this.xp += amount;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      gx: this.gx,
      gy: this.gy,
      hp: this.hp,
      stats: this.stats.serialize(),
      inventory: this.inventory.serialize(),
      activeWeaponSlot: this.activeWeaponSlot,
      currentWeaponId: this.currentWeaponId,
      currentAmmo: this.currentAmmo,
      facingAngle: this.facingAngle,
      xp: this.xp,
      level: this.level,
      pointsAvailable: this.pointsAvailable
    };
  }
}

let ProjectileLazy = null;
export function setProjectileClass(cls) { ProjectileLazy = cls; }