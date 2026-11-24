// src/ai/bot-brain.js

import {
  AI_STATE, AI_CONFIG, INTENT, INTEREST_FACTORS, INTEREST_THRESHOLDS,
  RADIO_MSG_TYPE, SHOOTING_THRESHOLD, POI_TYPE, SOUND_LOUDNESS, CELL_SIZE
} from '../core/constants.js';
import { BALLISTICS } from '../data/ballistics.js';
import { DIRECTIONS } from '../data/obstacles.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';

const BOT_GRENADE_RANGE = 5;
const BOT_MEDKIT_THRESHOLD = 0.35;
const BOT_GRENADE_COOLDOWN_MS = 8000;
const LOST_TARGET_SEARCH_MS = 3000;
const LOST_TARGET_SEARCH_RADIUS = 3;
const ROCKET_TRAJECTORY_CHECK_CELLS = 3;
const ROCKET_OBSTACLE_THRESHOLD = 0.3;
const SHORT_PATH_CELLS = 6;
const PATH_EXPIRY_SHORT_MIN = 1200;
const PATH_EXPIRY_SHORT_MAX = 1800;
const PATH_EXPIRY_LONG_MIN = 2500;
const PATH_EXPIRY_LONG_MAX = 3500;
const SUPPRESSIVE_FIRE_COOLDOWN_MS = 2000;
const SUPPRESSIVE_FIRE_SPREAD = 0.35;

const AWARENESS_MAX = 100;
const AWARENESS_ALERT_THRESHOLD = 25;
const AWARENESS_COMBAT_THRESHOLD = 55;
const AWARENESS_PATROL_DECAY = 6.5;
const AWARENESS_ALERT_DECAY = 4.0;
const AWARENESS_COMBAT_DECAY = 1.5;

export class BotBrain {
  constructor(entity, world, profile) {
    this.entity = entity;
    this.world = world;
    this.profile = profile;
    this.personality = profile.personality || {
      aggression: 0.5, caution: 0.5, discipline: 0.5, accuracySkill: 0.5, enduranceSkill: 0.5
    };

    this.state = AI_STATE.PATROL;
    this.stateEntryTime = performance.now();

    this.currentIntent = INTENT.PATROL;
    this.intentExpiry = 0;
    this.intentStartTime = 0;
    this.intentTarget = null;

    this.awareness = 0;

    this.patrolRoute = [];
    this.patrolIndex = 0;
    this.patrolPauseUntil = 0;

    this.lastSeenPlayerPos = null;
    this.alertPosition = null;
    this.alertStartTime = 0;
    this.coverPosition = null;

    this.interest = 0;
    this.lastInterestDecay = performance.now();

    this.lastThinkTime = 0;
    this.lastMoveTime = 0;
    this.lastStrafeTime = 0;
    this.lastShotTime = 0;
    this.lastBurstEndTime = 0;
    this.lastGrenadeTime = 0;
    this.lastMedkitTime = 0;
    this.holdFireUntil = 0;
    this.lastSuppressiveFireTime = 0;

    this.isAiming = false;
    this.aimStartTime = 0;

    this.tempMoveTarget = null;
    this.tempMoveExpiry = 0;
    this.pendingMoveRequest = null;
    this.lastMoveRequestTime = 0;

    this.lastSentSpottedTime = 0;
    this.lastSentPlayerPos = null;
    this.lastReceivedMsgIds = new Set();
    this.radioQueue = [];

    this.lastRadioMessage = null;
    this.lastRadioMessageTime = 0;

    this.currentPath = null;
    this.pathIndex = 0;
    this.pathExpiry = 0;

    this.lostTargetTime = 0;
    this.searchTargetPos = null;

    this.wasInCombat = false;
    this.wasPlayerVisible = false;

    this.generatePatrolRoute();
  }

  serializeState() {
    return {
      state: this.state,
      currentIntent: this.currentIntent,
      intentStartTime: this.intentStartTime,
      intentExpiry: this.intentExpiry,
      interest: this.interest,
      awareness: this.awareness,
      lastSeenPlayerPos: this.lastSeenPlayerPos ? {
        gx: this.lastSeenPlayerPos.gx,
        gy: this.lastSeenPlayerPos.gy,
        time: this.lastSeenPlayerPos.time
      } : null,
      alertPosition: this.alertPosition,
      coverPosition: this.coverPosition,
      patrolRoute: this.patrolRoute ? this.patrolRoute.map((p) => ({ gx: p.gx, gy: p.gy })) : [],
      patrolIndex: this.patrolIndex,
      lastShotTime: this.lastShotTime,
      lastBurstEndTime: this.lastBurstEndTime,
      lastGrenadeTime: this.lastGrenadeTime,
      lastMedkitTime: this.lastMedkitTime
    };
  }

  deserializeState(data) {
    if (!data) return;
    if (data.state) this.state = data.state;
    if (data.currentIntent) this.currentIntent = data.currentIntent;
    if (data.intentStartTime !== undefined) this.intentStartTime = data.intentStartTime;
    if (data.intentExpiry !== undefined) this.intentExpiry = data.intentExpiry;
    if (data.interest !== undefined) this.interest = data.interest;
    if (data.awareness !== undefined) this.awareness = data.awareness;
    if (data.lastSeenPlayerPos) this.lastSeenPlayerPos = data.lastSeenPlayerPos;
    if (data.alertPosition) this.alertPosition = data.alertPosition;
    if (data.coverPosition) this.coverPosition = data.coverPosition;
    if (Array.isArray(data.patrolRoute) && data.patrolRoute.length > 0) {
      this.patrolRoute = data.patrolRoute;
    }
    if (data.patrolIndex !== undefined) this.patrolIndex = data.patrolIndex;
    if (data.lastShotTime !== undefined) this.lastShotTime = data.lastShotTime;
    if (data.lastBurstEndTime !== undefined) this.lastBurstEndTime = data.lastBurstEndTime;
    if (data.lastGrenadeTime !== undefined) this.lastGrenadeTime = data.lastGrenadeTime;
    if (data.lastMedkitTime !== undefined) this.lastMedkitTime = data.lastMedkitTime;
  }

  getThinkInterval() {
    if (this.state === AI_STATE.COMBAT) {
      return 300 + (1 - this.personality.aggression) * 150;
    }
    if (this.state === AI_STATE.ALERT) {
      return 500 + this.personality.caution * 200;
    }
    return AI_CONFIG.THINK_INTERVAL;
  }

  getMoveDelay() {
    return AI_CONFIG.MOVE_DELAY;
  }

  forceThink() {
    this.lastThinkTime = 0;
  }

  computePathExpiry(pathLength) {
    if (!pathLength || pathLength < SHORT_PATH_CELLS) {
      return performance.now() + PATH_EXPIRY_SHORT_MIN + Math.random() * (PATH_EXPIRY_SHORT_MAX - PATH_EXPIRY_SHORT_MIN);
    }
    return performance.now() + PATH_EXPIRY_LONG_MIN + Math.random() * (PATH_EXPIRY_LONG_MAX - PATH_EXPIRY_LONG_MIN);
  }

  getLeadTarget(player) {
    if (!player || !player.isAlive) return null;
    const weapon = this.entity.getActiveWeapon();
    if (!weapon) return null;

    if (weapon.ammoId === 'pellet' || weapon.ammoId === 'rocket') {
      return { gx: player.gx, gy: player.gy };
    }

    const dx = player.gx - this.entity.gx;
    const dy = player.gy - this.entity.gy;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) return { gx: player.gx, gy: player.gy };

    let vx = 0, vy = 0;
    if (player.moveDirection) {
      vx = player.moveDirection.dx;
      vy = player.moveDirection.dy;
    }
    if (vx === 0 && vy === 0) return { gx: player.gx, gy: player.gy };

    const bulletSpeedCellsPerSec = weapon.bulletSpeedPx / CELL_SIZE;
    if (bulletSpeedCellsPerSec <= 0) return { gx: player.gx, gy: player.gy };

    const timeToHit = distance / bulletSpeedCellsPerSec;
    let predGx = player.gx + vx * timeToHit;
    let predGy = player.gy + vy * timeToHit;

    const sector = this.world.grid.sector;
    if (sector) {
      predGx = Math.max(0, Math.min(sector.width - 1, Math.round(predGx)));
      predGy = Math.max(0, Math.min(sector.height - 1, Math.round(predGy)));
    }

    const maxLead = 3;
    const leadDx = predGx - player.gx;
    const leadDy = predGy - player.gy;
    const leadDist = Math.max(Math.abs(leadDx), Math.abs(leadDy));
    if (leadDist > maxLead) {
      const k = maxLead / leadDist;
      predGx = player.gx + Math.round(leadDx * k);
      predGy = player.gy + Math.round(leadDy * k);
    }

    return { gx: predGx, gy: predGy };
  }

  // -------- Awareness (4a-4) --------

  updateAwareness(now) {
    const player = this.world.player;
    let gain = 0;

    const playerVisible = this.canSeePlayer();

    if (playerVisible && player && player.isAlive) {
      const detection = this.getDetectionChance();
      const baseGain = 4 + detection * 18;

      let fovMult = 1.0;
      if (detection < 0.3) fovMult = 0.5;
      else if (detection < 0.6) fovMult = 0.8;

      let moveMult = 1.0;
      const isMoving = player.moveCooldown > 0 || player.isMoving;
      if (isMoving) moveMult = 1.35;

      let shotBonus = 0;
      if (player.lastShotTime && (now - player.lastShotTime) < 400) {
        shotBonus = 12;
      }

      gain = baseGain * fovMult * moveMult + shotBonus;

      this.lastSeenPlayerPos = { gx: player.gx, gy: player.gy, time: now };
    }

    const sound = this.hearSound();
    if (sound.heard) {
      let soundGain = 6;
      if (sound.type === 'gunshot') soundGain = 12;
      else if (sound.type === 'explosion') soundGain = 18;
      else if (sound.type === 'footstep') soundGain = 5;
      gain += soundGain * (sound.intensity || 0.5);

      if (!this.lastSeenPlayerPos && sound.gx !== undefined) {
        this.lastSeenPlayerPos = { gx: sound.gx, gy: sound.gy, time: now };
      }
    }

    if (gain > 0) {
      this.awareness = Math.min(AWARENESS_MAX, this.awareness + gain);
    }

    let decay = AWARENESS_PATROL_DECAY;
    if (this.state === AI_STATE.COMBAT) decay = AWARENESS_COMBAT_DECAY;
    else if (this.state === AI_STATE.ALERT) decay = AWARENESS_ALERT_DECAY;

    const dt = Math.min(0.5, (now - this.lastInterestDecay) / 1000);
    this.awareness = Math.max(0, this.awareness - decay * dt);
  }

  getAwarenessState() {
    if (this.awareness >= AWARENESS_COMBAT_THRESHOLD && (this.hasLineOfSightTo(this.lastSeenPlayerPos?.gx ?? -1, this.lastSeenPlayerPos?.gy ?? -1) || (this.lastSeenPlayerPos && performance.now() - this.lastSeenPlayerPos.time < 3000))) {
      return 'combat';
    }
    if (this.awareness >= AWARENESS_ALERT_THRESHOLD) {
      return 'alert';
    }
    return 'patrol';
  }

  // -------- Оценка ситуации --------

  assessSituation(now) {
    const player = this.world.player;
    const playerAlive = player && player.isAlive;
    const playerVisible = playerAlive && this.canSeePlayer();
    const lastSeenFresh = this.lastSeenPlayerPos && (now - this.lastSeenPlayerPos.time < 3000);
    const distance = playerAlive ? this.entity.getDistanceTo(player.gx, player.gy, 'euclidean') : Infinity;
    const hpPercent = this.entity.hp / this.entity.maxHp;
    const suppression = this.entity.suppression;
    const weapon = this.entity.getActiveWeapon();
    const preferred = weapon ? weapon.preferredDistance : 8;
    const weaponRange = weapon ? weapon.range : 8;
    const cover = this.coverPosition || this.findBestCover();

    return {
      playerAlive,
      playerVisible,
      lastSeenFresh,
      distance,
      hpPercent,
      suppression,
      weapon,
      preferred,
      weaponRange,
      hasCover: !!cover,
      cover,
      awareness: this.awareness,
      awarenessState: this.getAwarenessState()
    };
  }

  chooseIntent(situation, now) {
    const awarenessState = situation.awarenessState;

    if (situation.playerAlive && situation.playerVisible && awarenessState === 'combat') {
      if (situation.hpPercent < 0.3 || situation.suppression > 0.7) {
        return INTENT.FALL_BACK;
      }
      if (situation.distance > situation.preferred + 2) {
        return INTENT.PUSH;
      }
      if (situation.distance < situation.preferred - 2) {
        return INTENT.FALL_BACK;
      }
      return INTENT.HOLD;
    }

    if (awarenessState === 'alert' || situation.lastSeenFresh) {
      return INTENT.SEARCH;
    }

    if (this.state === AI_STATE.COMBAT && situation.playerAlive) {
      return INTENT.PUSH;
    }

    return INTENT.PATROL;
  }

  setIntent(newIntent, now) {
    if (newIntent === this.currentIntent) return;
    const minDur = AI_CONFIG.INTENT_MIN_DURATION_MS;
    if (now < this.intentExpiry && now - this.intentStartTime < minDur) return;
    this.currentIntent = newIntent;
    this.intentStartTime = now;
    const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
    this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
    this.currentPath = null;
    this.pathIndex = 0;
    this.pathExpiry = 0;
    this.intentTarget = null;
  }

  forceIntent(newIntent, now) {
    this.currentIntent = newIntent;
    this.intentStartTime = now;
    const minDur = AI_CONFIG.INTENT_MIN_DURATION_MS;
    const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
    this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
    this.currentPath = null;
    this.pathIndex = 0;
    this.pathExpiry = 0;
    this.intentTarget = null;
  }

  generatePatrolRoute() {
    const { gx, gy } = this.entity;
    const sector = this.world.grid.sector;
    if (!sector) return;
    this.patrolRoute = [{ gx, gy }];
    for (let i = 0; i < AI_CONFIG.PATROL_POINTS; i++) {
      let attempts = 0;
      while (attempts < 30) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3 + Math.floor(Math.random() * (AI_CONFIG.PATROL_RADIUS - 3));
        const dx = Math.round(Math.cos(angle) * radius);
        const dy = Math.round(Math.sin(angle) * radius);
        const nx = Math.max(0, Math.min(sector.width - 1, gx + dx));
        const ny = Math.max(0, Math.min(sector.height - 1, gy + dy));
        if (this.world.grid.isWalkable(nx, ny, this.entity)) {
          this.patrolRoute.push({ gx: nx, gy: ny });
          break;
        }
        attempts++;
      }
    }
    this.patrolIndex = 0;
  }

  hasLineOfSightTo(tx, ty) {
    return this.world.losCache.hasLineOfSight(
      this.world.grid, this.entity.gx, this.entity.gy, tx, ty, performance.now()
    );
  }

  getDetectionChance() {
    const player = this.world.player;
    if (!player || !player.isAlive) return 0;
    const dx = player.gx - this.entity.gx;
    const dy = player.gy - this.entity.gy;
    const distance = Math.hypot(dx, dy);
    if (distance > AI_CONFIG.VISION_RANGE) return 0;
    if (!this.hasLineOfSightTo(player.gx, player.gy)) return 0;

    const botAngle = this.entity.facingAngle;
    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = Math.abs(targetAngle - botAngle);
    angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    let visibility = 0;
    if (angleDiff < AI_CONFIG.CENTRAL_FOV / 2) visibility = 1.0;
    else if (angleDiff < AI_CONFIG.PERIPHERAL_FOV / 2) {
      const t = (angleDiff - AI_CONFIG.CENTRAL_FOV / 2) / ((AI_CONFIG.PERIPHERAL_FOV - AI_CONFIG.CENTRAL_FOV) / 2);
      visibility = AI_CONFIG.PERIPHERAL_FACTOR * (1 - t);
    } else return 0;

    let distanceFactor = AI_CONFIG.NEAR_FACTOR;
    if (distance > AI_CONFIG.VISION_MID) distanceFactor = AI_CONFIG.FAR_FACTOR;
    else if (distance > AI_CONFIG.VISION_NEAR) distanceFactor = AI_CONFIG.MID_FACTOR;

    return Math.min(1.0, visibility * distanceFactor);
  }

  canSeePlayer() {
    return Math.random() < this.getDetectionChance();
  }

  hearSound() {
    const sound = this.world.soundManager.getSoundAt(
      this.entity.gx, this.entity.gy, performance.now()
    );
    if (sound && sound.heardLoudness > 0.05) {
      let interestGain = INTEREST_FACTORS.SOUND_GUNSHOT * sound.heardLoudness;
      if (sound.type === 'explosion') interestGain = INTEREST_FACTORS.SOUND_EXPLOSION * sound.heardLoudness;
      return {
        heard: true,
        gx: sound.gx,
        gy: sound.gy,
        type: sound.type,
        intensity: sound.heardLoudness,
        interestGain
      };
    }
    return { heard: false, interestGain: 0 };
  }

  sendRadioMessage(type, data, targetBot = null) {
    this.world.radioManager.send(this, type, data, targetBot);
  }

  receiveRadioMessage(msg) {
    if (this.lastReceivedMsgIds.has(msg.id)) return;
    if (this.radioQueue.length >= AI_CONFIG.RADIO_MAX_QUEUE) {
      let idx = -1;
      for (let i = 0; i < this.radioQueue.length; i++) {
        if (this.radioQueue[i].type === RADIO_MSG_TYPE.MOVING_TO ||
            this.radioQueue[i].type === RADIO_MSG_TYPE.HEARD_SHOT) {
          idx = i; break;
        }
      }
      if (idx === -1) return;
      this.radioQueue.splice(idx, 1);
    }
    this.lastReceivedMsgIds.add(msg.id);
    this.radioQueue.push(msg);
    this.processRadioQueue();
  }

  processRadioQueue() {
    while (this.radioQueue.length > 0) {
      const msg = this.radioQueue.shift();
      this.handleRadioMessage(msg);
    }
  }

  handleRadioMessage(msg) {
    const now = performance.now();
    switch (msg.type) {
      case RADIO_MSG_TYPE.SPOTTED_PLAYER:
        if (!this.lastSeenPlayerPos || msg.time > this.lastSeenPlayerPos.time) {
          this.lastSeenPlayerPos = { gx: msg.data.gx, gy: msg.data.gy, time: msg.time };
          this.interest = Math.min(100, this.interest + INTEREST_FACTORS.ALLY_INFO);
          this.awareness = Math.min(AWARENESS_MAX, this.awareness + 8);
          this.forceThink();
        }
        break;
      case RADIO_MSG_TYPE.UNDER_FIRE:
        if (!this.lastSeenPlayerPos || msg.time > this.lastSeenPlayerPos.time - 1000) {
          this.lastSeenPlayerPos = { gx: msg.data.fromGx, gy: msg.data.fromGy, time: msg.time };
          this.interest = Math.min(100, this.interest + INTEREST_FACTORS.ALLY_INFO * 1.5);
          this.awareness = Math.min(AWARENESS_MAX, this.awareness + 12);
          this.forceThink();
        }
        break;
      case RADIO_MSG_TYPE.MOVE_ASIDE:
        if (this.tempMoveTarget && now - this.lastMoveRequestTime < 2000) return;
        this.lastMoveRequestTime = now;
        if (msg.data.freePos) {
          this.tempMoveTarget = msg.data.freePos;
          this.tempMoveExpiry = now + 1500;
          this.sendRadioMessage(RADIO_MSG_TYPE.ACKNOWLEDGE, { originalMsgId: msg.id }, msg.sender);
        }
        break;
      case RADIO_MSG_TYPE.ACKNOWLEDGE:
        if (this.pendingMoveRequest && this.pendingMoveRequest.id === msg.data.originalMsgId) {
          this.pendingMoveRequest = null;
        }
        break;
    }
  }

  requestAllyToMove(ally) {
    const now = performance.now();
    if (this.lastMoveRequestTime && now - this.lastMoveRequestTime < 2000) return;
    this.lastMoveRequestTime = now;
    let freePos = null;
    for (const dir of DIRECTIONS) {
      const nx = ally.gx + dir.dx;
      const ny = ally.gy + dir.dy;
      if (this.world.grid.isWalkable(nx, ny, ally) &&
          !(nx === this.entity.gx && ny === this.entity.gy)) {
        freePos = { gx: nx, gy: ny };
        break;
      }
    }
    if (freePos) {
      this.pendingMoveRequest = { id: Date.now() + '_' + Math.random(), target: ally };
      this.sendRadioMessage(RADIO_MSG_TYPE.MOVE_ASIDE, { freePos }, ally);
    }
  }

  isFriendlyInLine(tx, ty) {
    const cells = this.world.grid.getLineCells(this.entity.gx, this.entity.gy, tx, ty);
    for (let i = 1; i < cells.length - 1; i++) {
      const cell = cells[i];
      for (const ally of this.world.entities.values()) {
        if (ally === this.entity || ally.isPlayer) continue;
        if (!ally.isAlive) continue;
        if (ally.gx === cell.x && ally.gy === cell.y) return ally;
      }
    }
    return null;
  }

  isFriendlyInBlastRadius(tx, ty, radius, excludeTarget = null) {
    for (const ally of this.world.entities.values()) {
      if (ally === this.entity || ally.isPlayer) continue;
      if (ally === excludeTarget) continue;
      if (!ally.isAlive) continue;
      const dist = Math.max(Math.abs(ally.gx - tx), Math.abs(ally.gy - ty));
      if (dist <= radius) return ally;
    }
    return null;
  }

  isRocketTrajectoryBlocked(targetGx, targetGy) {
    const dx = targetGx - this.entity.gx;
    const dy = targetGy - this.entity.gy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    const dirX = dx / len;
    const dirY = dy / len;
    const check = Math.min(ROCKET_TRAJECTORY_CHECK_CELLS, Math.floor(len));
    for (let i = 1; i <= check; i++) {
      const gx = Math.floor(this.entity.gx + dirX * i);
      const gy = Math.floor(this.entity.gy + dirY * i);
      const obs = this.world.grid.getObstacleAtCell(gx, gy);
      if (obs && obs.obstacleResistance >= ROCKET_OBSTACLE_THRESHOLD) return true;
    }
    return false;
  }

  isSelfInBlastRadius(targetGx, targetGy, radius) {
    const dist = Math.max(Math.abs(this.entity.gx - targetGx), Math.abs(this.entity.gy - targetGy));
    return dist <= radius;
  }

  onTakeDamage(damage, source) {
    this.interest = Math.min(100, this.interest + INTEREST_FACTORS.TAKING_DAMAGE);
    this.awareness = Math.min(AWARENESS_MAX, this.awareness + 25);
    if (source && source.gx !== undefined) {
      this.lastSeenPlayerPos = { gx: source.gx, gy: source.gy, time: performance.now() };
    }
    this.sendRadioMessage(RADIO_MSG_TYPE.UNDER_FIRE, {
      fromGx: source?.gx ?? this.entity.gx,
      fromGy: source?.gy ?? this.entity.gy
    });
    if (this.state !== AI_STATE.COMBAT) {
      this.state = AI_STATE.COMBAT;
      this.stateEntryTime = performance.now();
    }
    this.lostTargetTime = 0;
    this.forceThink();
  }

  updateInterest(now) {
    const playerVisible = this.canSeePlayer();
    const sound = this.hearSound();
    let delta = 0;
    let lostSight = false;

    const wasVisible = this.lastSeenPlayerPos && (now - this.lastSeenPlayerPos.time < 2000);

    if (playerVisible) {
      delta += INTEREST_FACTORS.VISUAL_CONTACT * 0.5;
      this.lastSeenPlayerPos = { gx: this.world.player.gx, gy: this.world.player.gy, time: now };
      this.lostTargetTime = 0;
      this.searchTargetPos = null;
      if (now - this.lastSentSpottedTime > AI_CONFIG.RADIO_THROTTLE_MS) {
        const lp = this.lastSentPlayerPos;
        if (!lp || lp.gx !== this.world.player.gx || lp.gy !== this.world.player.gy) {
          this.sendRadioMessage(RADIO_MSG_TYPE.SPOTTED_PLAYER, {
            gx: this.world.player.gx, gy: this.world.player.gy
          });
          this.lastSentSpottedTime = now;
          this.lastSentPlayerPos = { gx: this.world.player.gx, gy: this.world.player.gy };
        }
      }
    } else if (wasVisible && !this.lostTargetTime) {
      lostSight = true;
      this.lostTargetTime = now;
    }

    if (sound.heard) {
      delta += sound.interestGain * 0.5;
      if (!this.lastSeenPlayerPos) {
        this.lastSeenPlayerPos = { gx: sound.gx, gy: sound.gy, time: now };
        if (sound.type === 'gunshot') {
          this.sendRadioMessage(RADIO_MSG_TYPE.HEARD_SHOT, { gx: sound.gx, gy: sound.gy });
        }
      }
    }

    if (lostSight) this.forceThink();

    const decay = this.state === AI_STATE.COMBAT
      ? INTEREST_FACTORS.DECAY_COMBAT
      : (this.state === AI_STATE.ALERT ? INTEREST_FACTORS.DECAY_ALERT : INTEREST_FACTORS.DECAY_PATROL);

    const dt = Math.min(0.5, (now - this.lastInterestDecay) / 1000);
    this.lastInterestDecay = now;
    this.interest = Math.max(0, Math.min(100, this.interest + delta - decay * dt));

    if (now - this.stateEntryTime < AI_CONFIG.MIN_STATE_DURATION) return;

    const oldState = this.state;
    if (this.state === AI_STATE.PATROL && this.interest > INTEREST_THRESHOLDS.PATROL_TO_ALERT) {
      this.state = AI_STATE.ALERT;
      this.stateEntryTime = now;
      this.forceThink();
    } else if (this.state === AI_STATE.ALERT) {
      if (this.interest > INTEREST_THRESHOLDS.ALERT_TO_COMBAT) {
        this.state = AI_STATE.COMBAT;
        this.stateEntryTime = now;
        this.forceThink();
      } else if (this.interest < INTEREST_THRESHOLDS.ALERT_TO_PATROL) {
        this.state = AI_STATE.PATROL;
        this.stateEntryTime = now;
        this.alertPosition = null;
        this.lastSeenPlayerPos = null;
        this.forceThink();
      }
    } else if (this.state === AI_STATE.COMBAT && this.interest < INTEREST_THRESHOLDS.COMBAT_TO_ALERT) {
      this.state = AI_STATE.ALERT;
      this.stateEntryTime = now;
      this.coverPosition = null;
      this.forceThink();
    }
    if (oldState !== this.state) {
      this.sendRadioMessage(RADIO_MSG_TYPE.MOVING_TO, { state: this.state });
    }
  }

  canMoveTo(gx, gy) {
    if (!this.world.grid.isWalkable(gx, gy, this.entity)) return false;
    if (this.world.player && this.world.player.isAlive &&
        this.world.player.gx === gx && this.world.player.gy === gy) return false;
    return true;
  }

  moveTo(gx, gy) {
    const now = performance.now();
    if (now - this.lastMoveTime < this.getMoveDelay()) return false;
    if (!this.canMoveTo(gx, gy)) return false;

    const dx = Math.sign(gx - this.entity.gx);
    const dy = Math.sign(gy - this.entity.gy);
    this.entity.gx = gx;
    this.entity.gy = gy;
    this.entity.moveDirection = { dx, dy };
    this.entity.faceMovementDirection();
    this.entity.updateSpriteRotation();
    this.world.soundManager.emitSound(gx, gy, SOUND_LOUDNESS.footstep, 'footstep', this.entity);
    this.lastMoveTime = now;
    return true;
  }

  moveToward(tx, ty) {
    const pathfinder = this.world.pathfinding;

    if (this.currentPath && this.pathExpiry > performance.now() && this.pathIndex < this.currentPath.length) {
      const next = this.currentPath[this.pathIndex];
      if (this.entity.gx === next.gx && this.entity.gy === next.gy) {
        this.pathIndex++;
      }
      if (this.pathIndex < this.currentPath.length) {
        const step = this.currentPath[this.pathIndex];
        this.moveTo(step.gx, step.gy);
      }
      return;
    }

    const ctx = {
      targetGx: tx,
      targetGy: ty,
      caution: this.personality.caution
    };

    const path = pathfinder.findPath(this.entity.gx, this.entity.gy, tx, ty, this.entity, 30, ctx);
    if (path && path.length > 0) {
      this.currentPath = path;
      this.pathIndex = 0;
      this.pathExpiry = this.computePathExpiry(path.length);
      const step = path[0];
      this.moveTo(step.gx, step.gy);
      return;
    }

    const step = pathfinder.stepToward(this.entity.gx, this.entity.gy, tx, ty, this.entity);
    if (step) this.moveTo(step.gx, step.gy);
  }

  moveAwayFrom(tx, ty) {
    const dx = Math.sign(this.entity.gx - tx);
    const dy = Math.sign(this.entity.gy - ty);
    if (dx !== 0 && this.canMoveTo(this.entity.gx + dx, this.entity.gy)) {
      this.moveTo(this.entity.gx + dx, this.entity.gy);
    } else if (dy !== 0 && this.canMoveTo(this.entity.gx, this.entity.gy + dy)) {
      this.moveTo(this.entity.gx, this.entity.gy + dy);
    }
  }

  strafe(now) {
    const intensity = this.personality.aggression + 0.3;
    if (now - this.lastStrafeTime < 1200 / Math.max(0.2, intensity)) return;
    const options = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const dir = options[Math.floor(Math.random() * options.length)];
    if (this.canMoveTo(this.entity.gx + dir.dx, this.entity.gy + dir.dy)) {
      this.moveTo(this.entity.gx + dir.dx, this.entity.gy + dir.dy);
      this.lastStrafeTime = now;
    }
  }

  findSearchPosition() {
    if (!this.lastSeenPlayerPos) return null;
    const sector = this.world.grid.sector;
    if (!sector) return null;
    const baseGx = this.lastSeenPlayerPos.gx;
    const baseGy = this.lastSeenPlayerPos.gy;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1 + Math.floor(Math.random() * LOST_TARGET_SEARCH_RADIUS);
      const gx = Math.max(0, Math.min(sector.width - 1, baseGx + Math.round(Math.cos(angle) * radius)));
      const gy = Math.max(0, Math.min(sector.height - 1, baseGy + Math.round(Math.sin(angle) * radius)));
      if (this.canMoveTo(gx, gy)) return { gx, gy };
    }
    return null;
  }

  findBestCover() {
    const player = this.world.player;
    if (!player) return null;
    let best = null;
    let bestScore = -1;
    const R = AI_CONFIG.COVER_SEARCH_RADIUS;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const gx = this.entity.gx + dx;
        const gy = this.entity.gy + dy;
        if (!this.world.grid.isWalkable(gx, gy, this.entity)) continue;
        const obs = this.world.grid.getObstacleAtCell(gx, gy);
        const cover = obs ? obs.coverValue : 0;
        if (cover < 0.2) continue;
        const pathLen = this.findPathLength(gx, gy);
        if (pathLen === -1) continue;
        const score = cover / (pathLen + 1);
        if (score > bestScore) {
          bestScore = score;
          best = { gx, gy };
        }
      }
    }
    return best;
  }

  findPathLength(tx, ty) {
    const path = this.world.pathfinding.findPath(this.entity.gx, this.entity.gy, tx, ty, this.entity, 20);
    return path ? path.length : -1;
  }

  tryUseMedkit(now) {
    if (now - this.lastMedkitTime < 3000) return false;
    if (this.entity.hp >= this.entity.maxHp * BOT_MEDKIT_THRESHOLD) return false;

    const belt = this.entity.inventory.belt;
    let idx = -1;
    for (let i = 0; i < belt.length; i++) {
      if (belt[i] && belt[i].id === 'medkit') { idx = i; break; }
    }
    if (idx === -1) return false;

    const item = this.entity.inventory.useBelt(idx);
    if (!item) return false;
    const def = CONSUMABLE_ITEMS[item.id];
    if (!def) return false;

    this.entity.hp = Math.min(this.entity.maxHp, this.entity.hp + def.healAmount);
    this.lastMedkitTime = now;
    return true;
  }

  tryThrowGrenade(now) {
    if (now - this.lastGrenadeTime < BOT_GRENADE_COOLDOWN_MS) return false;

    const player = this.world.player;
    if (!player || !player.isAlive) return false;

    const distance = this.entity.getDistanceTo(player.gx, player.gy, 'euclidean');
    if (distance < 2 || distance > BOT_GRENADE_RANGE + 2) return false;

    const hpPercent = this.entity.hp / this.entity.maxHp;
    const suppression = this.entity.suppression;
    const retreating = hpPercent < 0.5 || suppression > 0.6;

    const belt = this.entity.inventory.belt;
    let smokeIdx = -1;
    let fragIdx = -1;
    for (let i = 0; i < belt.length; i++) {
      if (!belt[i]) continue;
      if (belt[i].id === 'grenade_smoke' && smokeIdx === -1) smokeIdx = i;
      if (belt[i].id === 'grenade_frag' && fragIdx === -1) fragIdx = i;
    }

    if (retreating && smokeIdx !== -1) {
      const tx = Math.round(this.entity.gx + (player.gx - this.entity.gx) * 0.4);
      const ty = Math.round(this.entity.gy + (player.gy - this.entity.gy) * 0.4);
      const ok = this.entity.throwGrenade(tx, ty, 'grenade_smoke');
      if (ok) { this.lastGrenadeTime = now; return true; }
    }

    if (!retreating && fragIdx !== -1 && distance <= BOT_GRENADE_RANGE) {
      if (this.isSelfInBlastRadius(player.gx, player.gy, 2)) return false;
      const ally = this.isFriendlyInBlastRadius(player.gx, player.gy, 2, player);
      if (ally) return false;
      const ok = this.entity.throwGrenade(player.gx, player.gy, 'grenade_frag');
      if (ok) { this.lastGrenadeTime = now; return true; }
    }

    return false;
  }

  shootAtPlayer(now) {
    if (now < this.holdFireUntil) return;

    const weapon = this.entity.getActiveWeapon();
    if (!weapon) return;
    const player = this.world.player;
    if (!player || !player.isAlive) return;
    if (player.invulnerableUntil && now < player.invulnerableUntil) return;
    if (this.lastBurstEndTime && now - this.lastBurstEndTime < AI_CONFIG.BURST_COOLDOWN) return;
    if (now - this.lastShotTime < weapon.fireRate) return;

    const distance = this.entity.getDistanceTo(player.gx, player.gy, 'euclidean');
    if (distance > weapon.range) return;
    if (this.getDetectionChance() < SHOOTING_THRESHOLD) return;

    const friendly = this.isFriendlyInLine(player.gx, player.gy);
    if (friendly) {
      this.requestAllyToMove(friendly);
      this.holdFireUntil = now + AI_CONFIG.INTENT_HOLD_FIRE_AFTER_ALLY_MS;
      return;
    }

    if (weapon.ammoId === 'rocket') {
      if (this.isSelfInBlastRadius(player.gx, player.gy, 3)) return;
      const near = this.isFriendlyInBlastRadius(player.gx, player.gy, 3);
      if (near) return;
      if (this.isRocketTrajectoryBlocked(player.gx, player.gy)) return;
    }

    if (!this.hasLineOfSightTo(player.gx, player.gy)) return;

    let resistance = 0;
    const processed = new Set();
    const cells = this.world.grid.getLineCells(this.entity.gx, this.entity.gy, player.gx, player.gy);
    for (const cell of cells) {
      const obs = this.world.grid.getObstacleAtCell(cell.x, cell.y);
      if (obs && !processed.has(obs.id)) {
        processed.add(obs.id);
        resistance += obs.obstacleResistance;
        if (resistance >= 1.0) return;
      }
    }

    this.lastShotTime = now;

    const lead = this.getLeadTarget(player);
    const targetGx = lead ? lead.gx : player.gx;
    const targetGy = lead ? lead.gy : player.gy;

    this.entity.shoot(targetGx, targetGy);
  }

  trySuppressiveFire(now) {
    if (now - this.lastSuppressiveFireTime < SUPPRESSIVE_FIRE_COOLDOWN_MS) return false;
    if (!this.lastSeenPlayerPos) return false;
    if (now - this.lastSeenPlayerPos.time > 2000) return false;

    const weapon = this.entity.getActiveWeapon();
    if (!weapon) return false;
    if (weapon.ammoId === 'rocket' || weapon.ammoId === 'pellet') return false;
    if (this.entity.currentAmmo < weapon.magazineSize * 0.3) return false;
    if (this.entity.suppression > 0.5) return false;
    if (this.entity.isReloading) return false;
    if (now - this.lastShotTime < weapon.fireRate) return false;

    const friendly = this.isFriendlyInLine(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
    if (friendly) return false;

    this.lastSuppressiveFireTime = now;
    this.lastShotTime = now;

    const offsetX = Math.round((Math.random() - 0.5) * SUPPRESSIVE_FIRE_SPREAD * 4);
    const offsetY = Math.round((Math.random() - 0.5) * SUPPRESSIVE_FIRE_SPREAD * 4);
    const targetGx = this.lastSeenPlayerPos.gx + offsetX;
    const targetGy = this.lastSeenPlayerPos.gy + offsetY;

    this.entity.faceTarget(targetGx, targetGy);
    this.entity.updateSpriteRotation();
    this.entity.shoot(targetGx, targetGy);
    return true;
  }

  findBestPOI() {
    const sectorId = this.world.currentSectorId;
    const pois = this.world.poiManager.getActiveForSector(sectorId);
    if (pois.length === 0) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const poi of pois) {
      if (poi.type === POI_TYPE.LOOT) {
        const dist = this.entity.getDistanceTo(poi.gx, poi.gy, 'chebyshev');
        const score = 50 / (dist + 1) * (1 + this.personality.discipline * 0.2);
        if (score > bestScore) { bestScore = score; best = poi; }
      } else if (poi.type === POI_TYPE.ALERT) {
        const dist = this.entity.getDistanceTo(poi.gx, poi.gy, 'chebyshev');
        const score = 70 / (dist + 1) * (1 + this.personality.aggression);
        if (score > bestScore) { bestScore = score; best = poi; }
      }
    }
    return best;
  }

  update(now) {
    if (now - this.lastThinkTime < this.getThinkInterval()) return;
    this.lastThinkTime = now;

    this.updateInterest(now);
    this.updateAwareness(now);

    const situation = this.assessSituation(now);

    const criticalChange =
      (this.state === AI_STATE.COMBAT && !this.wasInCombat) ||
      (situation.hpPercent < 0.2) ||
      (situation.playerVisible && !this.wasPlayerVisible);

    this.wasInCombat = this.state === AI_STATE.COMBAT;
    this.wasPlayerVisible = situation.playerVisible;

    const newIntent = this.chooseIntent(situation, now);
    if (criticalChange) {
      this.forceIntent(newIntent, now);
    } else {
      this.setIntent(newIntent, now);
    }

    this.executeIntent(now, situation);
  }

  executeIntent(now, situation) {
    if (this.currentIntent === INTENT.FALL_BACK) {
      this.executeFallBack(now, situation);
    } else if (this.currentIntent === INTENT.PUSH) {
      this.executePush(now, situation);
    } else if (this.currentIntent === INTENT.HOLD) {
      this.executeHold(now, situation);
    } else if (this.currentIntent === INTENT.SEARCH) {
      this.executeSearch(now, situation);
    } else {
      this.executePatrol(now, situation);
    }
  }

  executeFallBack(now, situation) {
    this.tryUseMedkit(now);
    if (situation.hasCover && situation.cover) {
      const d = this.entity.getDistanceTo(situation.cover.gx, situation.cover.gy, 'chebyshev');
      if (d > 1) {
        this.moveToward(situation.cover.gx, situation.cover.gy);
        return;
      }
    }
    if (situation.playerAlive) {
      this.moveAwayFrom(this.world.player.gx, this.world.player.gy);
    }
  }

  executePush(now, situation) {
    this.tryUseMedkit(now);
    if (!situation.playerAlive) {
      this.executeSearch(now, situation);
      return;
    }

    const player = this.world.player;
    if (this.tryThrowGrenade(now)) return;

    if (situation.playerVisible) {
      this.entity.smoothFaceTarget(player.gx, player.gy, now);
      this.entity.updateSpriteRotation();
      this.tryShoot(now, situation);
    }

    if (situation.distance > situation.preferred) {
      this.moveToward(player.gx, player.gy);
    } else {
      this.executeHold(now, situation);
    }
  }

  executeHold(now, situation) {
    this.tryUseMedkit(now);

    const player = this.world.player;

    if (situation.playerVisible && player) {
      this.entity.smoothFaceTarget(player.gx, player.gy, now);
      this.entity.updateSpriteRotation();
      this.tryShoot(now, situation);
      if (this.tryThrowGrenade(now)) return;
      if (now - this.lastStrafeTime > 1500 && Math.random() < this.personality.aggression) {
        this.strafe(now);
      }
      return;
    }

    if (situation.lastSeenFresh) {
      if (this.trySuppressiveFire(now)) return;
      if (this.lastSeenPlayerPos) {
        this.entity.faceTarget(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
        this.entity.updateSpriteRotation();
      }
    }
  }

  executeSearch(now, situation) {
    this.tryUseMedkit(now);
    if (!this.lastSeenPlayerPos) {
      this.executePatrol(now, situation);
      return;
    }

    if (this.lostTargetTime && now - this.lostTargetTime > LOST_TARGET_SEARCH_MS) {
      if (!this.coverPosition) this.coverPosition = this.findBestCover();
      if (this.coverPosition) {
        const d = this.entity.getDistanceTo(this.coverPosition.gx, this.coverPosition.gy, 'chebyshev');
        if (d > 1) {
          this.moveToward(this.coverPosition.gx, this.coverPosition.gy);
          return;
        }
      }
    }

    if (!this.searchTargetPos) {
      this.searchTargetPos = this.findSearchPosition();
    }
    if (this.searchTargetPos) {
      const d = this.entity.getDistanceTo(this.searchTargetPos.gx, this.searchTargetPos.gy, 'chebyshev');
      if (d > 1) {
        this.moveToward(this.searchTargetPos.gx, this.searchTargetPos.gy);
      } else {
        this.searchTargetPos = this.findSearchPosition();
      }
      return;
    }

    const d = this.entity.getDistanceTo(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy, 'chebyshev');
    if (d > 1) {
      this.moveToward(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
    }
  }

  executePatrol(now, situation) {
    if (this.tempMoveTarget && now < this.tempMoveExpiry) {
      const dist = this.entity.getDistanceTo(this.tempMoveTarget.gx, this.tempMoveTarget.gy, 'chebyshev');
      if (dist > 1) { this.moveToward(this.tempMoveTarget.gx, this.tempMoveTarget.gy); return; }
      this.tempMoveTarget = null;
    }

    this.tryUseMedkit(now);

    const poi = this.findBestPOI();
    if (poi) {
      const dist = this.entity.getDistanceTo(poi.gx, poi.gy, 'chebyshev');
      if (dist > 1) { this.moveToward(poi.gx, poi.gy); return; }
      if (poi.type === POI_TYPE.LOOT) {
        this.world.collectPOILoot(poi, this.entity);
      } else if (poi.type === POI_TYPE.ALERT) {
        this.world.poiManager.expire(poi);
      }
      return;
    }

    if (this.patrolRoute.length === 0) { this.generatePatrolRoute(); return; }
    const target = this.patrolRoute[this.patrolIndex];
    if (!target) { this.patrolIndex = 0; return; }
    const dist = this.entity.getDistanceTo(target.gx, target.gy, 'chebyshev');
    if (dist <= 1) {
      if (now > this.patrolPauseUntil) {
        this.patrolPauseUntil = now + AI_CONFIG.PATROL_PAUSE_MIN
          + Math.random() * (AI_CONFIG.PATROL_PAUSE_MAX - AI_CONFIG.PATROL_PAUSE_MIN);
        this.patrolIndex = (this.patrolIndex + 1) % this.patrolRoute.length;
      }
      return;
    }
    this.moveToward(target.gx, target.gy);
  }

  tryShoot(now, situation) {
    const player = this.world.player;
    if (!player) return;
    const dx = player.gx - this.entity.gx;
    const dy = player.gy - this.entity.gy;
    const angle = Math.atan2(dy, dx);
    let angleDiff = Math.abs(angle - this.entity.facingAngle);
    angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    if (angleDiff < 0.2) {
      if (!this.isAiming) { this.isAiming = true; this.aimStartTime = now; }
      if (now - this.aimStartTime >= AI_CONFIG.AIM_DURATION) {
        this.shootAtPlayer(now);
        this.isAiming = false;
      }
    } else {
      this.isAiming = false;
    }
  }
}