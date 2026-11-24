// src/entities/stats.js

import { STATS_CAP } from '../core/constants.js';

export class Stats {
  constructor(health = 10, strength = 10, accuracy = 10, endurance = 10) {
    this.health = health;
    this.strength = strength;
    this.accuracy = accuracy;
    this.endurance = endurance;
  }

  get maxHp() {
    return this.health * 6;
  }

  get carryCapacityKg() {
    return this.strength * 3;
  }

  canAddStat(stat) {
    return this[stat] !== undefined && this[stat] < STATS_CAP;
  }

  addStat(stat, amount = 1) {
    if (!this.canAddStat(stat)) return false;
    this[stat] = Math.min(STATS_CAP, this[stat] + amount);
    return true;
  }

  clone() {
    return new Stats(this.health, this.strength, this.accuracy, this.endurance);
  }

  serialize() {
    return {
      health: this.health,
      strength: this.strength,
      accuracy: this.accuracy,
      endurance: this.endurance
    };
  }

  static deserialize(data) {
    return new Stats(data.health, data.strength, data.accuracy, data.endurance);
  }
}