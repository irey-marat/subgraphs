// src/main.js

import { DBManager } from './core/db.js';
import { AssetManager } from './core/assets.js';
import { GameEngine } from './game/game.js';

(async function main() {
  'use strict';

  const db = new DBManager();
  await db.init();

  const assets = new AssetManager(db);

  const game = new GameEngine(db, assets);
  try {
    await game.init();
    game.start();
    console.log('[Subgraphs] Ready');
  } catch (err) {
    console.error('[Subgraphs] Init failed:', err);
    alert('Ошибка инициализации. Проверьте консоль.');
  }

  window.__subgraphs = { game, db, assets };
})();