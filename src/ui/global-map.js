// src/ui/global-map.js

import { GLOBAL_LAYOUT } from '../data/global-layout.js';
import { MINIMAP_SIZE } from '../core/constants.js';

const CELL_PX = MINIMAP_SIZE / GLOBAL_LAYOUT.size[0];

export class GlobalMap {
  constructor(world) {
    this.world = world;
    this.container = null;
    this.canvas = null;
    this.visible = true;
  }

  mount(parent) {
    this.container = document.createElement('div');
    this.container.id = 'global-map-container';
    this.container.style.cssText = `position:relative;width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;border:2px solid #555;background:#222;display:inline-block;vertical-align:top;`;
    parent.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.canvas.style.cssText = 'image-rendering:pixelated;display:block;width:100%;height:100%;';
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
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    const bg = this.world.assets.getImage('global_map');
    if (bg) {
      ctx.drawImage(bg, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GLOBAL_LAYOUT.size[0]; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL_PX, 0); ctx.lineTo(i * CELL_PX, h); ctx.stroke();
    }
    for (let i = 0; i <= GLOBAL_LAYOUT.size[1]; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * CELL_PX); ctx.lineTo(w, i * CELL_PX); ctx.stroke();
    }

    const current = GLOBAL_LAYOUT.sectors[this.world.currentSectorId];
    if (current) {
      ctx.fillStyle = 'rgba(0,255,0,0.25)';
      ctx.fillRect(current.gx * CELL_PX, current.gy * CELL_PX, CELL_PX, CELL_PX);
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(current.gx * CELL_PX, current.gy * CELL_PX, CELL_PX, CELL_PX);
    }

    const player = this.world.player;
    const sector = this.world.grid && this.world.grid.sector;
    if (player && current && sector) {
      const px = current.gx * CELL_PX + (player.gx / sector.width) * CELL_PX;
      const py = current.gy * CELL_PX + (player.gy / sector.height) * CELL_PX;
      ctx.fillStyle = '#00FF00';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}