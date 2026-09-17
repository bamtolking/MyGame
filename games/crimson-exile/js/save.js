'use strict';
const Save = {
  save() { try { if (!Game.player) return; localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(Game.player.serialize())); } catch (e) { console.warn('save failed', e); } },
  load() { try { const s = localStorage.getItem(CFG.SAVE_KEY); if (!s) return null; return Player.deserialize(JSON.parse(s)); } catch (e) { console.warn('load failed', e); return null; } },
  exists() { try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; } },
  peek() { try { const s = localStorage.getItem(CFG.SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) { } },
};
