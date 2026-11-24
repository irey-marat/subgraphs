// src/ui/minimap.js

import { MINIMAP_PX_PER_CELL, MINIMAP_SIZE } from '../core/constants.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';

export class Minimap {
  constructor(world) {
    this.world = world;
    this.container = null;
    this.canvas = null;
    this.visible = true;
  }

  mount(parent) {
    this.container = document.createElement('div');
    this.container.id = 'minimap-container';
    this.container.style.cssText = `position:relative;width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;border:2px solid #555;background:#222;display:inline-block;vertical-align:top;`;
    parent.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap-canvas';
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.canvas.style.cssText = `width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;image-rendering:pixelated;display:block;`;
    this.container.appendChild(this.canvas);
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (this.container) {
      this.container.style.display = this.visible ? 'inline-block' : 'none';
    }
  }

  toggle() {
    this.setVisible(!this.visible);
  }

  draw() {
    if (!this.visible || !this.canvas) return;
    const grid = this.world.grid;
    if (!grid || !grid.sector) return;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.fillStyle = '#CC9966';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    for (const obs of grid.obstacleList) {
      const def = OBSTACLE_TYPES[obs.logicType];
      if (!def) continue;
      ctx.fillStyle = obs.logicType === 'water' ? '#336699' : '#336600';
      ctx.fillRect(
        obs.anchorGx * MINIMAP_PX_PER_CELL,
        obs.anchorGy * MINIMAP_PX_PER_CELL,
        def.size[0] * MINIMAP_PX_PER_CELL,
        def.size[1] * MINIMAP_PX_PER_CELL
      );
    }

    ctx.fillStyle = '#FFFF00';
    for (const tr of grid.transitions) {
      ctx.fillRect(tr.from.gx * MINIMAP_PX_PER_CELL, tr.from.gy * MINIMAP_PX_PER_CELL, 4, 4);
    }

    const player = this.world.player;
    if (player) {
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(
        player.gx * MINIMAP_PX_PER_CELL - 1,
        player.gy * MINIMAP_PX_PER_CELL - 1,
        4, 4
      );
    }

    for (const e of this.world.entities.values()) {
      if (e.isPlayer || !e.isAlive) continue;
      if (e.gx === undefined) continue;
      ctx.fillStyle = '#FF3333';
      ctx.fillRect(
        e.gx * MINIMAP_PX_PER_CELL,
        e.gy * MINIMAP_PX_PER_CELL,
        2, 2
      );
    }
  }
}