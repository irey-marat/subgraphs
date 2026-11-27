// src/ai/bot-brain.js

import {
  AI_STATE, AI_CONFIG, INTENT, INTENT_FAMILY, MIN_INTENT_TIME,
  INTEREST_FACTORS, INTEREST_THRESHOLDS,
  RADIO_MSG_TYPE, SHOOTING_THRESHOLD, POI_TYPE, SOUND_LOUDNESS, CELL_SIZE,
  SOUND_MAX_RANGE,
  GROUP_ROLE, GROUP_ACTION_TYPE, GROUP_CONFIG
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

const SOUND_ERROR_TYPE_MULT = {
  gunshot: 1.0,
  explosion: 1.6,
  footstep: 0.7,
  other: 1.2
};

const MEMORY_LOG_MAX = 12;
const MEMORY_TTL = {
  intent_changed: 12000,
  intent_started: 12000,
  target_acquired: 10000,
  target_lost: 10000,
  path_planned: 8000,
  path_abandoned: 8000,
  position_reached: 8000,
  shot_fired: 8000,
  burst_finished: 8000,
  damage_taken: 20000,
  cover_failed: 25000,
  ally_action: 6000,
  decision_blocked: 10000
};

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
    this.lastIntentChange = 0;

    this.awareness = 0;

    this.memoryLog = [];
    this.lastLogPrune = 0;

    this.patrolRoute = [];
    this.patrolIndex = 0;
    this.patrolPauseUntil = 0;

    this.lastSeenPlayerPos = null;
    this.alertPosition = null;
    this.alertStartTime = 0;
    this.coverPosition = null;
    this.firingPosition = null;

    this.searchPhase = null;
    this.searchPhaseStart = 0;

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

  logEvent(type, data, customTtl) {
    const now = performance.now();
    const ttl = customTtl !== undefined ? customTtl : (MEMORY_TTL[type] || 8000);
    this.memoryLog.push({
      type,
      time: now,
      data: data || {},
      ttl
    });
    if (this.memoryLog.length > MEMORY_LOG_MAX) {
      this.memoryLog.shift();
    }
    if (now - this.lastLogPrune > 2000) {
      this.pruneMemoryLog(now);
      this.lastLogPrune = now;
    }
  }

  pruneMemoryLog(now) {
    this.memoryLog = this.memoryLog.filter((e) => now - e.time < e.ttl);
  }

  publishAllyAction(type, data) {
    this.logEvent('ally_action', { type, data });
    const gm = this.getGroupManager();
    if (gm) {
      gm.logGroupAction(this.entity, type, data);
    }
  }

  readContext() {
    const now = performance.now();
    this.pruneMemoryLog(now);

    const ctx = {
      intentChangesRecent: 0,
      recentDamageFrom: null,
      recentShotFrom: [],
      recentCoverFailed: [],
      recentPathPlanned: null,
      recentAllyAction: null,
      recentDecisionBlocked: 0
    };

    for (const e of this.memoryLog) {
      const age = now - e.time;
      if (e.type === 'intent_changed' && age < 10000) {
        ctx.intentChangesRecent++;
      } else if (e.type === 'damage_taken' && age < 20000 && !ctx.recentDamageFrom) {
        ctx.recentDamageFrom = e.data;
      } else if (e.type === 'shot_fired' && age < 8000) {
        ctx.recentShotFrom.push(e.data);
      } else if (e.type === 'cover_failed' && age < 25000) {
        ctx.recentCoverFailed.push(e.data);
      } else if (e.type === 'path_planned' && age < 8000) {
        ctx.recentPathPlanned = e.data;
      } else if (e.type === 'ally_action' && age < 6000) {
        ctx.recentAllyAction = e.data;
      } else if (e.type === 'decision_blocked' && age < 10000) {
        ctx.recentDecisionBlocked++;
      }
    }

    const gm = this.getGroupManager();
    if (gm) {
      const groupActions = gm.getGroupActions(this.entity);
      if (groupActions.length > 0) {
        const recent = groupActions[groupActions.length - 1];
        if (recent && recent.botId !== this.entity.id) {
          ctx.recentAllyAction = { type: recent.type, data: recent.data, fromBotId: recent.botId };
        }
      }
    }

    return ctx;
  }

  serializeState() {
    return {
      state: this.state,
      currentIntent: this.currentIntent,
      intentStartTime: this.intentStartTime,
      intentExpiry: this.intentExpiry,
      lastIntentChange: this.lastIntentChange,
      interest: this.interest,
      awareness: this.awareness,
      lastSeenPlayerPos: this.lastSeenPlayerPos ? {
        gx: this.lastSeenPlayerPos.gx,
        gy: this.lastSeenPlayerPos.gy,
        time: this.lastSeenPlayerPos.time,
        conf: this.lastSeenPlayerPos.conf || 0.9
      } : null,
      alertPosition: this.alertPosition,
      coverPosition: this.coverPosition,
      firingPosition: this.firingPosition,
      patrolRoute: this.patrolRoute ? this.patrolRoute.map((p) => ({ gx: p.gx, gy: p.gy })) : [],
      patrolIndex: this.patrolIndex,
      lastShotTime: this.lastShotTime,
      lastBurstEndTime: this.lastBurstEndTime,
      lastGrenadeTime: this.lastGrenadeTime,
      lastMedkitTime: this.lastMedkitTime,
      memoryLog: this.memoryLog.slice(-8)
    };
  }

  deserializeState(data) {
    if (!data) return;
    if (data.state) this.state = data.state;
    if (data.currentIntent) this.currentIntent = data.currentIntent;
    if (data.intentStartTime !== undefined) this.intentStartTime = data.intentStartTime;
    if (data.intentExpiry !== undefined) this.intentExpiry = data.intentExpiry;
    if (data.lastIntentChange !== undefined) this.lastIntentChange = data.lastIntentChange;
    if (data.interest !== undefined) this.interest = data.interest;
    if (data.awareness !== undefined) this.awareness = data.awareness;
    if (data.lastSeenPlayerPos) this.lastSeenPlayerPos = data.lastSeenPlayerPos;
    if (data.alertPosition) this.alertPosition = data.alertPosition;
    if (data.coverPosition) this.coverPosition = data.coverPosition;
    if (data.firingPosition) this.firingPosition = data.firingPosition;
    if (Array.isArray(data.patrolRoute) && data.patrolRoute.length > 0) {
      this.patrolRoute = data.patrolRoute;
    }
    if (data.patrolIndex !== undefined) this.patrolIndex = data.patrolIndex;
    if (data.lastShotTime !== undefined) this.lastShotTime = data.lastShotTime;
    if (data.lastBurstEndTime !== undefined) this.lastBurstEndTime = data.lastBurstEndTime;
    if (data.lastGrenadeTime !== undefined) this.lastGrenadeTime = data.lastGrenadeTime;
    if (data.lastMedkitTime !== undefined) this.lastMedkitTime = data.lastMedkitTime;
    if (Array.isArray(data.memoryLog)) this.memoryLog = data.memoryLog;
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

  getAimDelay() {
    const weapon = this.entity.getActiveWeapon();
    const weaponAimTime = weapon ? (weapon.aimTime || 250) : 250;
    const discipline = this.personality.discipline || 0.5;
    const accuracySkill = this.personality.accuracySkill || 0.5;

    let delay = weaponAimTime + 200 - (discipline * 100) - (accuracySkill * 100);
    delay = Math.max(AI_CONFIG.AIMING_DELAY_MIN_MS, Math.min(AI_CONFIG.AIMING_DELAY_MAX_MS, delay));
    return delay;
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

  getGroupManager() {
    return this.world.groupManager || null;
  }

  getGroupRole() {
    const gm = this.getGroupManager();
    if (!gm) return GROUP_ROLE.ANCHOR;
    return gm.getRole(this.entity) || GROUP_ROLE.ANCHOR;
  }

  getGroupSharedLastKnown() {
    const gm = this.getGroupManager();
    if (!gm) return null;
    return gm.getSharedLastKnown(this.entity);
  }

  publishSharedLastKnown(pos) {
    const gm = this.getGroupManager();
    if (!gm) return;
    const group = gm.getGroupForBot(this.entity);
    if (!group) return;
    gm.updateSharedLastKnown(group, pos);
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

      this.lastSeenPlayerPos = { gx: player.gx, gy: player.gy, time: now, conf: 0.9 };
      this.publishSharedLastKnown({ gx: player.gx, gy: player.gy, time: now, conf: 0.9 });
    }

    const sound = this.hearSound();
    if (sound.heard) {
      gain += sound.awarenessGain;

      if (!this.lastSeenPlayerPos || sound.conf > (this.lastSeenPlayerPos.conf || 0.9) * 0.9) {
        this.lastSeenPlayerPos = { gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf };
        if (sound.conf >= GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) {
          this.publishSharedLastKnown({ gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf });
        }
      }
    }

    const shared = this.getGroupSharedLastKnown();
    if (shared && (!this.lastSeenPlayerPos || shared.time > this.lastSeenPlayerPos.time)) {
      if (shared.conf >= GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) {
        this.lastSeenPlayerPos = { gx: shared.gx, gy: shared.gy, time: shared.time, conf: shared.conf };
        this.awareness = Math.min(AWARENESS_MAX, this.awareness + 4);
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

  assessSituation(now) {
    const player = this.world.player;
    const playerAlive = player && player.isAlive;
    const playerVisible = playerAlive && this.canSeePlayer();
    const lastSeenFresh = this.lastSeenPlayerPos && (now - this.lastSeenPlayerPos.time < 3000);
    const lastSeenAge = this.lastSeenPlayerPos ? now - this.lastSeenPlayerPos.time : Infinity;
    const distance = playerAlive ? this.entity.getDistanceTo(player.gx, player.gy, 'euclidean') : Infinity;
    const hpPercent = this.entity.hp / this.entity.maxHp;
    const suppression = this.entity.suppression;
    const weapon = this.entity.getActiveWeapon();
    const preferred = weapon ? weapon.preferredDistance : 8;
    const weaponRange = weapon ? weapon.range : 8;

    return {
      playerAlive,
      playerVisible,
      lastSeenFresh,
      lastSeenAge,
      distance,
      hpPercent,
      suppression,
      weapon,
      preferred,
      weaponRange,
      awareness: this.awareness,
      awarenessState: this.getAwarenessState(),
      role: this.getGroupRole(),
      sharedLastKnown: this.getGroupSharedLastKnown(),
      context: this.readContext()
    };
  }

  chooseIntent(situation, now) {
    const p = this.personality;
    const role = situation.role;
    const ctx = situation.context;
    const scores = {};

    scores[INTENT.HOLD] = 0;
    scores[INTENT.PUSH] = 0;
    scores[INTENT.FALL_BACK] = 0;
    scores[INTENT.SEARCH] = 0;
    scores[INTENT.PATROL] = 0;

    const hasLOS = situation.playerVisible;
    const dist = situation.distance;

    if (hasLOS && dist < situation.weaponRange) {
      scores[INTENT.HOLD] += 40 + p.discipline * 25;
      scores[INTENT.PUSH] += 25 + p.aggression * 30 - p.caution * 15;
    }

    if (situation.suppression > 0.55 || situation.hpPercent < 0.35) {
      scores[INTENT.FALL_BACK] += 50 + p.caution * 40;
    }

    if (situation.lastSeenAge < 3 && !hasLOS) {
      scores[INTENT.SEARCH] += 35 + p.aggression * 15;
      scores[INTENT.HOLD] += 10 * p.discipline;
    }

    if (situation.lastSeenAge > 8) {
      scores[INTENT.PATROL] += 30;
    }

    if (situation.awarenessState === 'patrol') {
      scores[INTENT.PATROL] += 20;
    }

    if (situation.awarenessState === 'alert') {
      scores[INTENT.SEARCH] += 25;
    }

    if (situation.awarenessState === 'combat') {
      scores[INTENT.HOLD] += 15;
      scores[INTENT.PUSH] += 10;
    }

    if (role === GROUP_ROLE.SUPPRESS) {
      scores[INTENT.HOLD] += 30;
      scores[INTENT.PUSH] -= 10;
    } else if (role === GROUP_ROLE.FLANK) {
      scores[INTENT.PUSH] += 35;
      scores[INTENT.HOLD] -= 10;
    } else if (role === GROUP_ROLE.ANCHOR) {
      scores[INTENT.HOLD] += 20;
    }

    if (ctx.intentChangesRecent >= 3) {
      scores[INTENT.PUSH] *= 0.5;
      scores[INTENT.FALL_BACK] *= 0.6;
      scores[INTENT.HOLD] *= 1.2;
    }

    if (ctx.recentDamageFrom && now - (ctx.recentDamageFrom.time || 0) < 3000) {
      scores[INTENT.FALL_BACK] += 15;
      scores[INTENT.PUSH] -= 10;
    }

    if (ctx.recentCoverFailed.length > 0) {
      scores[INTENT.HOLD] -= 10;
    }

    if (ctx.recentAllyAction && ctx.recentAllyAction.type === GROUP_ACTION_TYPE.MOVING_FLANK) {
      scores[INTENT.HOLD] += 15;
      scores[INTENT.PUSH] -= 5;
    }

    const jitter = 0.1;
    for (const k in scores) {
      scores[k] += Math.random() * jitter * Math.max(1, Math.abs(scores[k]));
    }

    let best = INTENT.PATROL;
    let bestScore = -Infinity;
    for (const k in scores) {
      if (scores[k] > bestScore) {
        bestScore = scores[k];
        best = k;
      }
    }
    return best;
  }

  canChangeIntent(newIntent, now) {
    const currentMin = MIN_INTENT_TIME[this.currentIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
    if (now - this.intentStartTime < currentMin) return false;

    if (this.lastIntentChange && now - this.lastIntentChange < AI_CONFIG.INTENT_CHANGE_COOLDOWN_MS) {
      if (newIntent !== INTENT.FALL_BACK) return false;
    }
    return true;
  }

  setIntent(newIntent, now) {
    if (newIntent === this.currentIntent) return;
    if (!this.canChangeIntent(newIntent, now)) {
      this.logEvent('decision_blocked', { intent: newIntent, reason: 'canChangeIntent' });
      return;
    }

    const oldFamily = INTENT_FAMILY[this.currentIntent];
    const newFamily = INTENT_FAMILY[newIntent];
    const keepPath = (oldFamily === newFamily) && (newFamily === 'engage' || newFamily === 'evade' || newFamily === 'search');

    this.logEvent('intent_changed', { from: this.currentIntent, to: newIntent });
    this.currentIntent = newIntent;
    this.intentStartTime = now;
    this.lastIntentChange = now;
    const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
    const minDur = MIN_INTENT_TIME[newIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
    this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
    this.intentTarget = null;

    if (!keepPath) {
      this.currentPath = null;
      this.pathIndex = 0;
      this.pathExpiry = 0;
    }

    if (newIntent === INTENT.SEARCH) {
      this.searchPhase = null;
      this.searchPhaseStart = 0;
    }

    this.isAiming = false;
    this.aimStartTime = 0;
  }

  forceIntent(newIntent, now) {
    if (newIntent === this.currentIntent) return;
    this.logEvent('intent_changed', { from: this.currentIntent, to: newIntent, forced: true });
    this.currentIntent = newIntent;
    this.intentStartTime = now;
    this.lastIntentChange = now;
    const minDur = MIN_INTENT_TIME[newIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
    const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
    this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
    this.intentTarget = null;
    this.currentPath = null;
    this.pathIndex = 0;
    this.pathExpiry = 0;

    if (newIntent === INTENT.SEARCH) {
      this.searchPhase = null;
      this.searchPhaseStart = 0;
    }

    this.isAiming = false;
    this.aimStartTime = 0;
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

  soundErrorRadius(loudness, distance, type) {
    const typeMult = SOUND_ERROR_TYPE_MULT[type] ?? 1.2;
    const base = 1.8 + distance * 0.22;
    const loudnessFactor = 1.4 - loudness * 0.9;
    return Math.max(0.8, Math.min(9.0, base * loudnessFactor * typeMult));
  }

  hearSound() {
    const now = performance.now();
    const sound = this.world.soundManager.getSoundAt(
      this.entity.gx, this.entity.gy, now
    );

    if (!sound || sound.heardLoudness < 0.05) {
      return { heard: false, interestGain: 0, awarenessGain: 0 };
    }

    const dx = sound.gx - this.entity.gx;
    const dy = sound.gy - this.entity.gy;
    const distance = Math.hypot(dx, dy);

    const err = this.soundErrorRadius(sound.loudness, distance, sound.type);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * err;
    const estGx = Math.round(sound.gx + Math.cos(angle) * r);
    const estGy = Math.round(sound.gy + Math.sin(angle) * r);

    const attenuation = sound.heardLoudness / Math.max(0.01, sound.loudness);
    let conf = Math.min(0.95, Math.max(0.05, sound.loudness * (1 - distance / SOUND_MAX_RANGE) * attenuation));

    const age = now - (sound.time || now);
    conf *= Math.exp(-age / 2500);
    conf = Math.max(0.05, Math.min(0.95, conf));

    let awarenessGain = 6;
    if (sound.type === 'explosion') awarenessGain = 18;
    else if (sound.type === 'gunshot') awarenessGain = 12;
    else if (sound.type === 'footstep') awarenessGain = 5;
    awarenessGain *= conf;

    let interestGain = INTEREST_FACTORS.SOUND_GUNSHOT * sound.heardLoudness;
    if (sound.type === 'explosion') interestGain = INTEREST_FACTORS.SOUND_EXPLOSION * sound.heardLoudness;

    return {
      heard: true,
      gx: sound.gx,
      gy: sound.gy,
      estGx,
      estGy,
      conf,
      type: sound.type,
      intensity: sound.heardLoudness,
      interestGain,
      awarenessGain
    };
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
          this.lastSeenPlayerPos = { gx: msg.data.gx, gy: msg.data.gy, time: msg.time, conf: 0.85 };
          this.interest = Math.min(100, this.interest + INTEREST_FACTORS.ALLY_INFO);
          this.awareness = Math.min(AWARENESS_MAX, this.awareness + 8);
          this.forceThink();
        }
        break;
      case RADIO_MSG_TYPE.UNDER_FIRE:
        if (!this.lastSeenPlayerPos || msg.time > this.lastSeenPlayerPos.time - 1000) {
          this.lastSeenPlayerPos = { gx: msg.data.fromGx, gy: msg.data.fromGy, time: msg.time, conf: 0.85 };
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
      this.lastSeenPlayerPos = { gx: source.gx, gy: source.gy, time: performance.now(), conf: 0.9 };
      this.publishSharedLastKnown({ gx: source.gx, gy: source.gy, time: performance.now(), conf: 0.9 });
      this.logEvent('damage_taken', {
        fromGx: source.gx,
        fromGy: source.gy,
        damage,
        time: performance.now()
      });
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
    this.isAiming = false;
    this.aimStartTime = 0;
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
      this.lastSeenPlayerPos = { gx: this.world.player.gx, gy: this.world.player.gy, time: now, conf: 0.9 };
      this.publishSharedLastKnown({ gx: this.world.player.gx, gy: this.world.player.gy, time: now, conf: 0.9 });
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
        this.lastSeenPlayerPos = { gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf };
        if (sound.type === 'gunshot') {
          this.sendRadioMessage(RADIO_MSG_TYPE.HEARD_SHOT, { gx: sound.estGx, gy: sound.estGy });
        }
      }
    }

    if (lostSight) {
      this.isAiming = false;
      this.aimStartTime = 0;
      this.forceThink();
    }

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
      this.logEvent('path_planned', { tx, ty, length: path.length });
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

  isBadCover(gx, gy) {
    const ctx = this.readContext();
    for (const f of ctx.recentCoverFailed) {
      if (Math.abs(f.gx - gx) <= 1 && Math.abs(f.gy - gy) <= 1) return true;
    }
    return false;
  }

  findBestCover() {
    const player = this.world.player;
    let best = null;
    let bestScore = -1;
    const R = AI_CONFIG.COVER_SEARCH_RADIUS;
    const gm = this.getGroupManager();
    const now = performance.now();

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const gx = this.entity.gx + dx;
        const gy = this.entity.gy + dy;
        if (!this.world.grid.isWalkable(gx, gy, this.entity)) continue;
        const obs = this.world.grid.getObstacleAtCell(gx, gy);
        const cover = obs ? obs.coverValue : 0;
        if (cover < 0.2) continue;
        if (gm && gm.isReserved({ gx, gy }, this.entity.id, now)) continue;
        if (this.isBadCover(gx, gy)) continue;
        const pathLen = this.findPathLength(gx, gy);
        if (pathLen === -1) continue;

        let score = cover / (pathLen + 1);

        if (player && player.isAlive && !this.hasLineOfSightTo(gx, gy)) {
          score *= 1.5;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { gx, gy };
        }
      }
    }

    if (best && gm) {
      gm.reserve(best, this.entity.id, now);
    }
    return best;
  }

  findBestFiringPos(targetGx, targetGy) {
    if (targetGx === undefined || targetGy === undefined) return null;
    let best = null;
    let bestScore = -1;
    const R = AI_CONFIG.COVER_SEARCH_RADIUS;
    const weapon = this.entity.getActiveWeapon();
    const preferred = weapon ? weapon.preferredDistance : 8;
    const gm = this.getGroupManager();
    const now = performance.now();
    const ctx = this.readContext();
    const avoid = ctx.recentDamageFrom ? ctx.recentDamageFrom : null;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const gx = this.entity.gx + dx;
        const gy = this.entity.gy + dy;
        if (!this.world.grid.isWalkable(gx, gy, this.entity)) continue;
        const obs = this.world.grid.getObstacleAtCell(gx, gy);
        const cover = obs ? obs.coverValue : 0;
        if (cover < 0.25) continue;
        if (gm && gm.isReserved({ gx, gy }, this.entity.id, now)) continue;
        if (this.isBadCover(gx, gy)) continue;

        const hasLOS = this.hasLineOfSightTo(targetGx, targetGy);
        const dist = Math.max(Math.abs(gx - targetGx), Math.abs(gy - targetGy));
        const distScore = Math.max(0, 1 - Math.abs(dist - preferred) / Math.max(1, preferred));

        const pathLen = this.findPathLength(gx, gy);
        if (pathLen === -1) continue;

        let score = (hasLOS ? 1.2 : 0.4) * cover * distScore / (pathLen + 1);

        if (avoid && Math.abs(gx - avoid.fromGx) <= 2 && Math.abs(gy - avoid.fromGy) <= 2) {
          score *= 0.5;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { gx, gy };
        }
      }
    }

    if (best && gm) {
      gm.reserve(best, this.entity.id, now);
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

    const FRAG_EXPLOSION_RADIUS = 2;
    const FF_BUFFER = AI_CONFIG.GRENADE_FF_BUFFER_CELLS || 1;
    const fragFFRadius = FRAG_EXPLOSION_RADIUS + FF_BUFFER;

    if (retreating && smokeIdx !== -1) {
      const tx = Math.round(this.entity.gx + (player.gx - this.entity.gx) * 0.4);
      const ty = Math.round(this.entity.gy + (player.gy - this.entity.gy) * 0.4);

      // Smoke не наносит урон, но проверим, что не накрываем союзника дымом
      const allyInSmoke = this.isFriendlyInBlastRadius(tx, ty, 1);

      if (!allyInSmoke) {
        const ok = this.entity.throwGrenade(tx, ty, 'grenade_smoke');
        if (ok) { this.lastGrenadeTime = now; return true; }
      }
    }

    if (!retreating && fragIdx !== -1 && distance <= BOT_GRENADE_RANGE) {
      // Строгая проверка FF: радиус взрыва + буфер
      if (this.isSelfInBlastRadius(player.gx, player.gy, fragFFRadius)) return false;
      const ally = this.isFriendlyInBlastRadius(player.gx, player.gy, fragFFRadius, player);
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
      const rocketFFRadius = 3;
      if (this.isSelfInBlastRadius(player.gx, player.gy, rocketFFRadius)) return;
      const near = this.isFriendlyInBlastRadius(player.gx, player.gy, rocketFFRadius);
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

    const gm = this.getGroupManager();
    if (gm && !gm.canShoot(this.entity, player.gx, player.gy, now)) {
      return;
    }

    this.lastShotTime = now;

    const lead = this.getLeadTarget(player);
    const targetGx = lead ? lead.gx : player.gx;
    const targetGy = lead ? lead.gy : player.gy;

    this.logEvent('shot_fired', { fromGx: this.entity.gx, fromGy: this.entity.gy, tx: targetGx, ty: targetGy });

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
    this.publishAllyAction(GROUP_ACTION_TYPE.FALLING_BACK, { gx: this.entity.gx, gy: this.entity.gy });
    this.tryUseMedkit(now);
    if (!this.coverPosition || this.isCoverInvalid()) {
      this.coverPosition = this.findBestCover();
    }
    if (this.coverPosition) {
      const d = this.entity.getDistanceTo(this.coverPosition.gx, this.coverPosition.gy, 'chebyshev');
      if (d > 1) {
        this.moveToward(this.coverPosition.gx, this.coverPosition.gy);
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

    if (situation.role === GROUP_ROLE.FLANK) {
      this.publishAllyAction(GROUP_ACTION_TYPE.MOVING_FLANK, { gx: player.gx, gy: player.gy });
    }

    if (this.tryThrowGrenade(now)) return;

    if (situation.playerVisible) {
      this.entity.smoothFaceTarget(player.gx, player.gy, now);
      this.entity.updateSpriteRotation();
      this.tryShoot(now, situation);
    }

    if (situation.distance > situation.preferred) {
      if (!this.firingPosition || this.isFiringPosInvalid(player.gx, player.gy)) {
        this.firingPosition = this.findBestFiringPos(player.gx, player.gy);
      }
      if (this.firingPosition) {
        const d = this.entity.getDistanceTo(this.firingPosition.gx, this.firingPosition.gy, 'chebyshev');
        if (d > 1 && d < 6) {
          this.moveToward(this.firingPosition.gx, this.firingPosition.gy);
          return;
        }
      }
      this.moveToward(player.gx, player.gy);
    } else {
      this.executeHold(now, situation);
    }
  }

  executeHold(now, situation) {
    this.tryUseMedkit(now);

    const player = this.world.player;
    const role = situation.role;
    const ctx = situation.context;

    if (role === GROUP_ROLE.SUPPRESS) {
      this.publishAllyAction(GROUP_ACTION_TYPE.SUPPRESSING, { gx: this.entity.gx, gy: this.entity.gy });
    } else if (role === GROUP_ROLE.ANCHOR) {
      this.publishAllyAction(GROUP_ACTION_TYPE.HOLDING, { gx: this.entity.gx, gy: this.entity.gy });
    }

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
      if (ctx && ctx.recentAllyAction && ctx.recentAllyAction.type === GROUP_ACTION_TYPE.MOVING_FLANK) {
        if (this.trySuppressiveFire(now)) return;
      } else {
        if (this.trySuppressiveFire(now)) return;
      }
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

    if (!this.searchPhase) {
      this.searchPhase = 'listen';
      this.searchPhaseStart = now;
    }

    const phaseElapsed = now - this.searchPhaseStart;

    if (this.searchPhase === 'listen') {
      const listenDur = AI_CONFIG.LISTEN_DURATION_MIN_MS + Math.random() * (AI_CONFIG.LISTEN_DURATION_MAX_MS - AI_CONFIG.LISTEN_DURATION_MIN_MS);
      this.entity.faceTarget(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
      this.entity.updateSpriteRotation();
      if (phaseElapsed >= listenDur) {
        this.searchPhase = 'investigate';
        this.searchPhaseStart = now;
        const invMin = AI_CONFIG.INVESTIGATE_DURATION_MIN_MS;
        const invMax = AI_CONFIG.INVESTIGATE_DURATION_MAX_MS;
        this.intentExpiry = Math.max(this.intentExpiry, now + invMin + Math.random() * (invMax - invMin));
      }
      return;
    }

    const d = this.entity.getDistanceTo(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy, 'chebyshev');
    if (d > 1.5) {
      this.moveToward(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
    } else {
      if (!this.searchTargetPos) {
        this.searchTargetPos = this.findSearchPosition();
      }
      if (this.searchTargetPos) {
        const sd = this.entity.getDistanceTo(this.searchTargetPos.gx, this.searchTargetPos.gy, 'chebyshev');
        if (sd > 1) {
          this.moveToward(this.searchTargetPos.gx, this.searchTargetPos.gy);
        } else {
          this.searchTargetPos = this.findSearchPosition();
        }
      }
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

  isCoverInvalid() {
    if (!this.coverPosition) return true;
    const obs = this.world.grid.getObstacleAtCell(this.coverPosition.gx, this.coverPosition.gy);
    return !obs || obs.coverValue < 0.2;
  }

  isFiringPosInvalid(targetGx, targetGy) {
    if (!this.firingPosition) return true;
    const obs = this.world.grid.getObstacleAtCell(this.firingPosition.gx, this.firingPosition.gy);
    if (!obs || obs.coverValue < 0.25) return true;
    if (!this.hasLineOfSightTo(targetGx, targetGy)) return true;
    return false;
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
      if (!this.isAiming) {
        this.isAiming = true;
        this.aimStartTime = now;
      }
      if (now - this.aimStartTime >= this.getAimDelay()) {
        this.shootAtPlayer(now);
        this.isAiming = false;
      }
    } else {
      this.isAiming = false;
    }
  }
}