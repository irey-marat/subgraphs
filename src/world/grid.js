// src/world/grid.js

import { OBSTACLE_TYPES, IMAGE_REGISTRY } from '../data/obstacles.js';
import { getMaterialForObstacle } from '../data/materials.js';

export class GridSystem {
  constructor(db, world) {
    this.db = db;
    this.world = world;
    this.sector = null;
    this.occupancy = [];
    this.transitions = [];
    this.obstacleList = [];
    this.obstacleAnchors = new Map();
    this.spawnPoints = [];
    this._skippedObstacles = 0;
  }

  async loadSector(id) {
    this.sector = await this.db.get('maps', id);
    if (!this.sector) throw new Error('Sector ' + id + ' not found');
    this.transitions = await this.loadTransitions(id);
    this.spawnPoints = await this.loadSpawnPoints(id);
    this.buildOccupancy();
  }

  async loadTransitions(sectorId) {
    const keys = await this.db.getAllKeys('transitions');
    const all = [];
    for (const key of keys) {
      const t = await this.db.get('transitions', key);
      if (t && t.from && t.from.sectorId === sectorId) all.push(t);
    }
    return all;
  }

  async loadSpawnPoints(sectorId) {
    const data = await this.db.get('spawn_points', sectorId);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.points)) return data.points;
    return [];
  }

  buildOccupancy() {
    const w = this.sector.width;
    const h = this.sector.height;
    this.occupancy = Array.from({ length: h }, () => Array(w).fill(null));
    this.obstacleList = [];
    this.obstacleAnchors.clear();
    this._skippedObstacles = 0;

    const obst = this.sector.obstacles || {};
    for (const key in obst) {
      const rawKey = String(obst[key]).trim();
      const [anchorGx, anchorGy] = key.split('|').map(Number);
      const logicType = (IMAGE_REGISTRY[rawKey] || rawKey).trim();
      const def = OBSTACLE_TYPES[logicType];
      if (!def) {
        this._skippedObstacles++;
        if (this._skippedObstacles <= 5) {
          console.warn('[Grid] Skipped obstacle (unknown type):', { key, rawKey, logicType });
        }
        continue;
      }

      const material = getMaterialForObstacle(logicType);

      const obstacle = {
        id: anchorGx + '|' + anchorGy,
        anchorGx, anchorGy,
        rawKey, logicType, material,
        size: def.size,
        blocksMovement: def.blocksMovement,
        visionBlock: def.visionBlock,
        soundBlock: def.soundBlock,
        obstacleResistance: def.obstacleResistance,
        coverValue: def.coverValue
      };

      this.obstacleList.push(obstacle);
      this.obstacleAnchors.set(obstacle.id, obstacle);

      for (let dy = 0; dy < def.size[1]; dy++) {
        for (let dx = 0; dx < def.size[0]; dx++) {
          const gx = anchorGx + dx;
          const gy = anchorGy + dy;
          if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
            this.occupancy[gy][gx] = obstacle;
          }
        }
      }
    }
    if (this._skippedObstacles > 5) {
      console.warn('[Grid] Total skipped obstacles:', this._skippedObstacles);
    }
  }

  getObstacleAtCell(gx, gy) {
    if (!this.sector) return null;
    if (gx < 0 || gy < 0 || gx >= this.sector.width || gy >= this.sector.height) return null;
    if (!this.occupancy[gy]) return null;
    return this.occupancy[gy][gx] || null;
  }

  isWalkable(gx, gy, excludeEntity) {
    if (!this.sector) return false;
    if (gx < 0 || gy < 0 || gx >= this.sector.width || gy >= this.sector.height) return false;
    const obs = this.getObstacleAtCell(gx, gy);
    if (obs && obs.blocksMovement) return false;
    if (this.world && this.world.entities) {
      for (const entity of this.world.entities.values()) {
        if (entity === excludeEntity) continue;
        if (!entity.isAlive) continue;
        if (entity.gx === gx && entity.gy === gy) return false;
      }
    }
    return true;
  }

  hasLineOfSight(x0, y0, x1, y1) {
    const cells = this.getLineCells(x0, y0, x1, y1);
    const processed = new Set();
    for (let i = 1; i < cells.length - 1; i++) {
      const cell = cells[i];
      const obs = this.getObstacleAtCell(cell.x, cell.y);
      if (obs && !processed.has(obs.id)) {
        processed.add(obs.id);
        if (obs.visionBlock >= 1.0) return false;
      }
      if (this.world && this.world.isSmokeAt && this.world.isSmokeAt(cell.x, cell.y)) {
        return false;
      }
    }
    return true;
  }

  getSoundAttenuation(x0, y0, x1, y1) {
    if (!this.sector) return 1.0;
    const cells = this.getLineCells(x0, y0, x1, y1);
    const processed = new Set();
    let totalBlock = 0;
    for (let i = 1; i < cells.length - 1; i++) {
      const obs = this.getObstacleAtCell(cells[i].x, cells[i].y);
      if (obs && !processed.has(obs.id)) {
        processed.add(obs.id);
        totalBlock += obs.soundBlock;
        if (totalBlock >= 1.0) return 0;
      }
    }
    return Math.max(0, 1 - totalBlock);
  }

  getLineCells(x0, y0, x1, y1) {
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return [];
    const cells = [];
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let iterations = 0;
    const maxIter = 1000;
    while (true) {
      iterations++;
      if (iterations > maxIter) break;
      cells.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return cells;
  }

  getTransitionAt(gx, gy) {
    for (const t of this.transitions) {
      if (t.from.gx === gx && t.from.gy === gy) return t;
    }
    return null;
  }
}