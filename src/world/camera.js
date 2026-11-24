// src/world/camera.js

import { VIEW_W, VIEW_H, CELL_SIZE, CAMERA_MARGIN } from '../core/constants.js';

export class CameraSystem {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  snapTo(playerGx, playerGy, sectorW, sectorH) {
    this.x = Math.max(0, Math.min(playerGx - Math.floor(VIEW_W / 2), sectorW - VIEW_W));
    this.y = Math.max(0, Math.min(playerGy - Math.floor(VIEW_H / 2), sectorH - VIEW_H));
  }

  update(playerGx, playerGy, sectorW, sectorH) {
    let targetX = this.x;
    let targetY = this.y;
    const psx = playerGx - this.x;
    const psy = playerGy - this.y;

    if (psx < CAMERA_MARGIN) targetX = playerGx - CAMERA_MARGIN;
    else if (psx > VIEW_W - 1 - CAMERA_MARGIN) targetX = playerGx - (VIEW_W - 1 - CAMERA_MARGIN);

    if (psy < CAMERA_MARGIN) targetY = playerGy - CAMERA_MARGIN;
    else if (psy > VIEW_H - 1 - CAMERA_MARGIN) targetY = playerGy - (VIEW_H - 1 - CAMERA_MARGIN);

    this.x = Math.max(0, Math.min(targetX, sectorW - VIEW_W));
    this.y = Math.max(0, Math.min(targetY, sectorH - VIEW_H));
  }

  toScreen(gx, gy) {
    return {
      x: Math.floor((gx - this.x) * CELL_SIZE),
      y: Math.floor((gy - this.y) * CELL_SIZE)
    };
  }

  screenToGrid(screenX, screenY) {
    return {
      gx: Math.floor(screenX / CELL_SIZE + this.x),
      gy: Math.floor(screenY / CELL_SIZE + this.y)
    };
  }
}