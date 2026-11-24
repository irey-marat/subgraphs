// src/ui/menu.js

import { t } from '../core/strings.js';

export class Menu {
  constructor(world, saveManager) {
    this.world = world;
    this.saveManager = saveManager;
    this.container = null;
    this.visible = false;
  }

  mount() {
    this.container = document.createElement('div');
    this.container.id = 'menu-screen';
    this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:24px;z-index:1002;display:none;color:#eee;font-family:monospace;
      min-width:360px;
    `;
    document.body.appendChild(this.container);
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) this.render();
  }

  async render() {
    const saves = await this.saveManager.listSaves();

    const saveRow = (label, data, key) => {
      const when = data ? new Date(data.savedAt).toLocaleString() : '—';
      return `
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
          <span style="flex:1;">${label}</span>
          <span style="font-size:10px;color:#888;min-width:120px;text-align:right;">${when}</span>
          ${data ? `<button data-load="${key}" style="padding:2px 6px;background:#2e7d32;color:#fff;border:none;cursor:pointer;">${t('menu.load')}</button>` : ''}
          ${data ? `<button data-del="${key}" style="padding:2px 6px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">${t('common.delete')}</button>` : ''}
        </div>
      `;
    };

    const manualRows = saves.manual.map((m) => {
      const key = 'manual_save_' + m.slot;
      const row = saveRow('Ручное ' + m.slot, m.data, key);
      const saveBtn = `<button data-save="${m.slot}" style="padding:2px 6px;background:#1565c0;color:#fff;border:none;cursor:pointer;margin-left:4px;">${t('menu.save')}</button>`;
      return row.replace('</div>', saveBtn + '</div>');
    }).join('');

    this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;">${t('menu.title')}</h2>
        <button id="menu-data" title="${t('menu.data')}" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;">ⓘ</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        <button data-action="resume" style="padding:8px;background:#2e7d32;color:#fff;border:none;cursor:pointer;">${t('common.close')}</button>
        <button data-action="settings" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">${t('menu.settings')}</button>
        <button data-action="saves" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">${t('save.title')}</button>
        <button data-action="quit" style="padding:8px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">${t('menu.quit')}</button>
      </div>
      <div id="menu-saves" style="display:none;border-top:1px solid #555;padding-top:12px;">
        <h4 style="margin-top:0;">${t('save.title')}</h4>
        ${saves.auto ? saveRow(t('save.auto'), saves.auto, 'auto_save') : `<div style="color:#888;margin-bottom:4px;">${t('save.auto')}: ${t('save.empty')}</div>`}
        ${saves.autoBackup ? saveRow(t('save.auto') + ' (резерв)', saves.autoBackup, 'auto_save_backup') : ''}
        ${manualRows}
      </div>
    `;

    this.container.querySelector('#menu-data').onclick = () => {
      this.toggle();
      this.world.ui.dataScreen.toggle();
    };

    this.container.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.onclick = () => this.handle(btn.dataset.action);
    });

    this.container.querySelectorAll('button[data-save]').forEach((btn) => {
      btn.onclick = async () => {
        await this.saveManager.saveManual(Number(btn.dataset.save));
        await this.render();
      };
    });

    this.container.querySelectorAll('button[data-load]').forEach((btn) => {
      btn.onclick = async () => {
        const key = btn.dataset.load;
        if (key === 'auto_save') await this.saveManager.loadAuto();
        else if (key === 'auto_save_backup') await this.saveManager.loadAutoBackup();
        else if (key.startsWith('manual_save_')) await this.saveManager.loadManual(Number(key.split('_').pop()));
        this.toggle();
        this.world.eventBus.emit('hud:message', t('save.loaded'));
      };
    });

    this.container.querySelectorAll('button[data-del]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm(t('save.deleteConfirm'))) return;
        await this.saveManager.deleteSave(btn.dataset.del);
        await this.render();
      };
    });
  }

  async handle(action) {
    if (action === 'resume') this.toggle();
    else if (action === 'quit') {
      await this.saveManager.saveManual(1);
      this.world.eventBus.emit('hud:message', t('save.saved'));
    } else if (action === 'settings') {
      this.toggle();
      this.world.ui.settings.toggle();
    } else if (action === 'saves') {
      const el = this.container.querySelector('#menu-saves');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
  }
}