// src/ai/pathfinding.js

import { DIRECTIONS } from '../data/obstacles.js';

const BASE_STEP_COST = 1;
const COVER_BONUS = -0.5;
const OPEN_PENALTY_NEAR_TARGET = 1.0;
const OPEN_NEAR_TARGET_RADIUS = 3;
const SUPPRESSION_PENALTY = 2.0;

export class Pathfinding {
  constructor(world) {
    this.world = world;
    this.maxIterations = 4000;
  }

  isWalkable(gx, gy, entity) {
    return this.world.grid.isWalkable(gx, gy, entity);
  }

  getCellCost(gx, gy, ctx) {
    let cost = BASE_STEP_COST;

    const obs = this.world.grid.getObstacleAtCell(gx, gy);
    if (obs && obs.coverValue >= 0.2) {
      cost += COVER_BONUS * obs.coverValue;
    }

    if (ctx && ctx.targetGx !== undefined && ctx.caution !== undefined) {
      const distToTarget = Math.max(Math.abs(gx - ctx.targetGx), Math.abs(gy - ctx.targetGy));
      if (distToTarget <= OPEN_NEAR_TARGET_RADIUS && (!obs || obs.coverValue < 0.2)) {
        cost += OPEN_PENALTY_NEAR_TARGET * ctx.caution * (1 - distToTarget / (OPEN_NEAR_TARGET_RADIUS + 1));
      }
    }

    if (this.world.isSmokeAt && this.world.isSmokeAt(gx, gy)) {
      cost += SUPPRESSION_PENALTY;
    }

    return Math.max(0.1, cost);
  }

  findPath(sx, sy, tx, ty, entity, maxDepth = 30, ctx = null) {
    if (sx === tx && sy === ty) return [];

    const open = new MinHeap();
    const gScore = new Map();
    const cameFrom = new Map();
    const closed = new Set();

    const startKey = sx + ',' + sy;
    const targetKey = tx + ',' + ty;

    gScore.set(startKey, 0);
    open.push({ gx: sx, gy: sy, g: 0, f: this.heuristic(sx, sy, tx, ty) });

    let iterations = 0;

    while (!open.isEmpty()) {
      iterations++;
      if (iterations > this.maxIterations) break;

      const current = open.pop();
      const currentKey = current.gx + ',' + current.gy;

      if (currentKey === targetKey) {
        return this.reconstruct(cameFrom, currentKey);
      }

      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      const currentG = gScore.get(currentKey) ?? Infinity;
      if (current.g > currentG) continue;

      if (current.g >= maxDepth) continue;

      for (const dir of DIRECTIONS) {
        const nx = current.gx + dir.dx;
        const ny = current.gy + dir.dy;

        if (!this.isWalkable(nx, ny, entity)) continue;

        const key = nx + ',' + ny;
        if (closed.has(key)) continue;

        const stepCost = this.getCellCost(nx, ny, ctx);
        const tentativeG = current.g + stepCost;
        const knownG = gScore.get(key);
        if (knownG !== undefined && tentativeG >= knownG) continue;

        gScore.set(key, tentativeG);
        cameFrom.set(key, currentKey);
        open.push({ gx: nx, gy: ny, g: tentativeG, f: tentativeG + this.heuristic(nx, ny, tx, ty) });
      }
    }

    return null;
  }

  heuristic(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }

  reconstruct(cameFrom, targetKey) {
    const path = [];
    let key = targetKey;
    while (cameFrom.has(key)) {
      const [gx, gy] = key.split(',').map(Number);
      path.push({ gx, gy });
      key = cameFrom.get(key);
    }
    path.reverse();
    return path;
  }

  smoothPath(path, entity) {
    if (!path || path.length < 3) return path;
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1) {
        if (this.hasDirectLOS(path[i], path[j])) break;
        j--;
      }
      out.push(path[j]);
      i = j;
    }
    return out;
  }

  hasDirectLOS(a, b) {
    return this.world.grid.hasLineOfSight(a.gx, a.gy, b.gx, b.gy);
  }

  stepToward(sx, sy, tx, ty, entity) {
    const dx = Math.sign(tx - sx);
    const dy = Math.sign(ty - sy);
    if (dx === 0 && dy === 0) return null;

    if ((dx !== 0 || dy !== 0) && this.isWalkable(sx + dx, sy + dy, entity)) {
      return { gx: sx + dx, gy: sy + dy };
    }
    if (dx !== 0 && this.isWalkable(sx + dx, sy, entity)) {
      return { gx: sx + dx, gy: sy };
    }
    if (dy !== 0 && this.isWalkable(sx, sy + dy, entity)) {
      return { gx: sx, gy: sy + dy };
    }
    return null;
  }
}

class MinHeap {
  constructor() { this.arr = []; }
  isEmpty() { return this.arr.length === 0; }
  push(node) {
    this.arr.push(node);
    this._bubbleUp(this.arr.length - 1);
  }
  pop() {
    if (this.arr.length === 0) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.arr[i].f >= this.arr[parent].f) break;
      [this.arr[i], this.arr[parent]] = [this.arr[parent], this.arr[i]];
      i = parent;
    }
  }
  _bubbleDown(i) {
    const n = this.arr.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.arr[l].f < this.arr[smallest].f) smallest = l;
      if (r < n && this.arr[r].f < this.arr[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.arr[i], this.arr[smallest]] = [this.arr[smallest], this.arr[i]];
      i = smallest;
    }
  }
}