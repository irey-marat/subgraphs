// src/ai/group-manager.js

import {
  GROUP_ROLE, GROUP_CONFIG, GROUP_ACTION_TYPE
} from '../core/constants.js';

export class GroupManager {
  constructor(world) {
    this.world = world;
    this.groups = new Map();
    this.botToGroup = new Map();
    this.nextGroupId = 1;
    this.lastUpdate = 0;
  }

  updateGroups(now) {
    if (now - this.lastUpdate < 2000) return;
    this.lastUpdate = now;

    const bots = [];
    for (const e of this.world.entities.values()) {
      if (e.isPlayer) continue;
      if (!e.isAlive) continue;
      if (!e.botBrain) continue;
      bots.push(e);
    }

    const assigned = new Set();
    const newGroups = new Map();
    const newBotToGroup = new Map();

    for (const bot of bots) {
      if (assigned.has(bot.id)) continue;

      const groupId = 'group_' + (this.nextGroupId++);
      const members = new Set([bot.id]);
      assigned.add(bot.id);

      for (const other of bots) {
        if (assigned.has(other.id)) continue;
        if (other === bot) continue;
        const d = Math.max(Math.abs(other.gx - bot.gx), Math.abs(other.gy - bot.gy));
        if (d <= GROUP_CONFIG.GROUP_RANGE) {
          members.add(other.id);
          assigned.add(other.id);
        }
      }

      const oldGroup = this.botToGroup.has(bot.id) ? this.groups.get(this.botToGroup.get(bot.id)) : null;

      const group = {
        id: groupId,
        members,
        sharedLastKnown: oldGroup ? oldGroup.sharedLastKnown : null,
        roles: oldGroup ? oldGroup.roles : new Map(),
        reservations: oldGroup ? oldGroup.reservations : new Map(),
        actionLog: oldGroup ? oldGroup.actionLog : [],
        lastRoleAssign: oldGroup ? oldGroup.lastRoleAssign : 0
      };

      newGroups.set(groupId, group);
      for (const memberId of members) {
        newBotToGroup.set(memberId, groupId);
      }
    }

    this.groups = newGroups;
    this.botToGroup = newBotToGroup;

    for (const group of this.groups.values()) {
      this.cleanupReservations(group, now);
      this.cleanupActionLog(group, now);
      if (now - group.lastRoleAssign > GROUP_CONFIG.ROLE_REASSIGN_INTERVAL_MS) {
        this.assignRoles(group, now);
        group.lastRoleAssign = now;
      }
    }
  }

  cleanupReservations(group, now) {
    for (const [key, res] of group.reservations) {
      if (res.until < now) group.reservations.delete(key);
    }
  }

  cleanupActionLog(group, now) {
    group.actionLog = group.actionLog.filter((e) => now - e.time < GROUP_CONFIG.GROUP_ACTION_TTL);
    if (group.actionLog.length > GROUP_CONFIG.GROUP_ACTION_LOG_MAX) {
      group.actionLog = group.actionLog.slice(-GROUP_CONFIG.GROUP_ACTION_LOG_MAX);
    }
  }

  getGroupForBot(bot) {
    const groupId = this.botToGroup.get(bot.id);
    if (!groupId) return null;
    return this.groups.get(groupId) || null;
  }

  getRole(bot) {
    const group = this.getGroupForBot(bot);
    if (!group) return null;
    return group.roles.get(bot.id) || null;
  }

  assignRoles(group, now) {
    const bots = [];
    for (const memberId of group.members) {
      const bot = this.world.entities.get(memberId);
      if (!bot || !bot.isAlive || !bot.botBrain) continue;
      bots.push(bot);
    }

    if (bots.length === 0) {
      group.roles.clear();
      return;
    }

    const sharedLK = group.sharedLastKnown;

    const sorted = bots.slice().sort((a, b) => {
      const aDist = sharedLK
        ? Math.max(Math.abs(a.gx - sharedLK.gx), Math.abs(a.gy - sharedLK.gy))
        : 0;
      const bDist = sharedLK
        ? Math.max(Math.abs(b.gx - sharedLK.gx), Math.abs(b.gy - sharedLK.gy))
        : 0;
      return aDist - bDist;
    });

    let flankCount = 0;
    let suppressCount = 0;

    for (const bot of sorted) {
      const p = bot.botBrain.personality;
      const weapon = bot.getActiveWeapon();
      const weaponId = weapon ? weapon.id : '';
      const inCover = !!bot.botBrain.coverPosition;

      let role = GROUP_ROLE.ANCHOR;

      const suppressScore =
        (p.aggression * 1.0) +
        (weaponId === 'pkm' ? 1.5 : 0) +
        (weaponId === 'ak47' ? 0.8 : 0) +
        (weaponId === 'ppsh41' ? 0.5 : 0) +
        (inCover ? 0.5 : 0);

      const flankScore =
        (p.aggression * 0.8) +
        (weaponId === 'saiga12' ? 1.2 : 0) +
        (weaponId === 'ppsh41' ? 0.8 : 0) +
        (p.caution < 0.4 ? 0.5 : 0);

      const anchorScore =
        (p.discipline * 1.2) +
        (weaponId === 'svd' ? 1.2 : 0) +
        (inCover ? 1.0 : 0);

      if (suppressScore >= flankScore && suppressScore >= anchorScore && suppressCount < GROUP_CONFIG.MAX_SUPPRESSORS) {
        role = GROUP_ROLE.SUPPRESS;
        suppressCount++;
      } else if (flankScore > anchorScore && flankCount < GROUP_CONFIG.MAX_FLANKERS) {
        role = GROUP_ROLE.FLANK;
        flankCount++;
      } else {
        role = GROUP_ROLE.ANCHOR;
      }

      group.roles.set(bot.id, role);
    }
  }

  updateSharedLastKnown(group, pos) {
    if (!pos) return;
    if (pos.gx === undefined) return;
    if (pos.conf !== undefined && pos.conf < GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) return;

    const current = group.sharedLastKnown;
    if (!current) {
      group.sharedLastKnown = { gx: pos.gx, gy: pos.gy, time: pos.time || performance.now(), conf: pos.conf || 0.85 };
      return;
    }

    if ((pos.time || 0) > current.time) {
      group.sharedLastKnown = { gx: pos.gx, gy: pos.gy, time: pos.time || performance.now(), conf: pos.conf || 0.85 };
    }
  }

  getSharedLastKnown(bot) {
    const group = this.getGroupForBot(bot);
    if (!group) return null;
    return group.sharedLastKnown;
  }

  logGroupAction(bot, type, data) {
    const group = this.getGroupForBot(bot);
    if (!group) return;

    const now = performance.now();
    group.actionLog.push({
      botId: bot.id,
      type,
      data: data || {},
      time: now
    });

    if (group.actionLog.length > GROUP_CONFIG.GROUP_ACTION_LOG_MAX) {
      group.actionLog.shift();
    }
  }

  getGroupActions(bot) {
    const group = this.getGroupForBot(bot);
    if (!group) return [];
    const now = performance.now();
    return group.actionLog.filter((e) => now - e.time < GROUP_CONFIG.GROUP_ACTION_TTL);
  }

  reserve(cell, botId, now) {
    const group = this.getGroupForBot({ id: botId });
    if (!group) return true;

    const key = cell.gx + ',' + cell.gy;
    const existing = group.reservations.get(key);
    if (existing && existing.until > now && existing.botId !== botId) return false;

    group.reservations.set(key, { botId, until: now + GROUP_CONFIG.RESERVATION_DURATION_MS });
    return true;
  }

  isReserved(cell, botId, now) {
    const group = this.getGroupForBot({ id: botId });
    if (!group) return false;

    const key = cell.gx + ',' + cell.gy;
    const existing = group.reservations.get(key);
    if (!existing) return false;
    if (existing.until < now) return false;
    if (existing.botId === botId) return false;
    return true;
  }

  countRecentShooters(bot, targetGx, targetGy, now) {
    const group = this.getGroupForBot(bot);
    if (!group) return 0;

    let count = 0;
    for (const memberId of group.members) {
      if (memberId === bot.id) continue;
      const member = this.world.entities.get(memberId);
      if (!member || !member.isAlive || !member.botBrain) continue;
      if (!member.lastShotTime) continue;
      if (now - member.lastShotTime > GROUP_CONFIG.SHOOTER_WINDOW_MS) continue;
      const d = Math.max(Math.abs(member.gx - targetGx), Math.abs(member.gy - targetGy));
      if (d <= 3) count++;
    }
    return count;
  }

  canShoot(bot, targetGx, targetGy, now) {
    const role = this.getRole(bot);
    const recent = this.countRecentShooters(bot, targetGx, targetGy, now);

    if (role === GROUP_ROLE.SUPPRESS) {
      return recent < GROUP_CONFIG.MAX_SUPPRESSORS;
    }

    return recent < GROUP_CONFIG.MAX_SHOOTERS_PER_TARGET;
  }
}