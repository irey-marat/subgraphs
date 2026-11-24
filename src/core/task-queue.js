// src/core/task-queue.js

export class TaskQueue {
  constructor() {
    this.tasks = [];
  }

  schedule(delayMs, fn) {
    this.tasks.push({ time: performance.now() + delayMs, fn });
  }

  update(now) {
    if (this.tasks.length === 0) return;
    const ready = [];
    const pending = [];
    for (const task of this.tasks) {
      if (task.time <= now) ready.push(task);
      else pending.push(task);
    }
    this.tasks = pending;
    for (const task of ready) {
      try {
        task.fn();
      } catch (err) {
        console.error('[TaskQueue] task error:', err);
      }
    }
  }

  clear() {
    this.tasks = [];
  }
}