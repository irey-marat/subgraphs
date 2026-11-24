// src/ai/communication.js

import {
  RADIO_MSG_TYPE, RADIO_PRIORITY, RADIO_DROPPABLE,
  AI_CONFIG
} from '../core/constants.js';

let nextRadioId = 1;

export class RadioMessage {
  constructor(type, sender, data, target = null) {
    this.id = nextRadioId++;
    this.type = type;
    this.sender = sender;
    this.target = target;
    this.data = data;
    this.time = performance.now();
  }
}

export class RadioManager {
  constructor(world) {
    this.world = world;
  }

  send(senderBrain, type, data, targetBot = null) {
    const msg = new RadioMessage(type, senderBrain.entity, data, targetBot);
    senderBrain.lastRadioMessage = type;
    senderBrain.lastRadioMessageTime = msg.time;

    // Эмит для DebugOverlay (лог радиосообщений)
    this.world.eventBus.emit('bot:radio', {
      name: senderBrain.profile?.name || senderBrain.entity.id,
      type,
      data,
      target: targetBot ? (targetBot.profile?.name || targetBot.id) : null
    });

    for (const ally of this.world.entities.values()) {
      if (ally === senderBrain.entity) continue;
      if (ally.isPlayer) continue;
      if (!ally.isAlive) continue;
      if (!ally.botBrain) continue;
      if (targetBot && ally !== targetBot) continue;

      const dist = senderBrain.entity.getDistanceTo(ally.gx, ally.gy, 'chebyshev');
      if (dist > AI_CONFIG.GROUP_COMMUNICATION_RANGE) continue;

      ally.botBrain.receiveRadioMessage(msg);
    }
  }
}