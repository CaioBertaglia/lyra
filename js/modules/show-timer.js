/**
 * @fileoverview ShowTimer — máquina de estados do show ao vivo
 *
 * Controla:
 *  - Tempo total do show
 *  - Tempo por música
 *  - Índice da música atual
 *  - Pause / resume
 *  - Persistência no localStorage (sobrevive a refresh)
 *
 * Emite via EventBus a cada segundo:
 *  show:tick  { elapsed, songElapsed, currentSong, currentIndex, paused }
 *  show:ended { show }
 */
 
'use strict';
 
import { StorageService } from '../services/storage.service.js';
import { EventBus }       from '../core/event-bus.js';
 
// ─── Estado interno ───────────────────────────────────────────────────────────
 
let _running         = false;
let _paused          = false;
let _startedAt       = 0;
let _pausedAt        = 0;
let _totalPausedMs   = 0;
let _currentIndex    = 0;
let _songStartedAt   = 0;
let _tickInterval    = null;
let _setlist         = null;
 
// ─── Computed ─────────────────────────────────────────────────────────────────
 
const _elapsed     = () => _running ? Math.max(0, Date.now() - _startedAt - _totalPausedMs) : 0;
const _songElapsed = () => Math.max(0, Date.now() - _songStartedAt - _totalPausedMs);
const _currentSong = () => _setlist?.songs[_currentIndex] ?? null;
 
// ─── Tick ─────────────────────────────────────────────────────────────────────
 
function _tick() {
  EventBus.emit('show:tick', {
    elapsed:      _elapsed(),
    songElapsed:  _songElapsed(),
    currentSong:  _currentSong(),
    currentIndex: _currentIndex,
    paused:       _paused,
  });
}
 
function _startTick() { _tickInterval = setInterval(_tick, 1000); _tick(); }
function _stopTick()  { clearInterval(_tickInterval); _tickInterval = null; }
 
// ─── Persistência ─────────────────────────────────────────────────────────────
 
function _saveState() {
  StorageService.saveShowState({
    running:       _running,
    paused:        _paused,
    startedAt:     _startedAt,
    pausedAt:      _pausedAt,
    totalPausedMs: _totalPausedMs,
    currentIndex:  _currentIndex,
    songStartedAt: _songStartedAt,
    setlistId:     _setlist?.id,
  });
}
 
function _clearState() { StorageService.saveShowState(null); }
 
// ─── API pública ──────────────────────────────────────────────────────────────
 
/** @param {import('../models.js').Setlist} setlist */
function start(setlist) {
  if (_running) return;
  _setlist       = setlist;
  _running       = true;
  _paused        = false;
  _startedAt     = Date.now();
  _totalPausedMs = 0;
  _currentIndex  = 0;
  _songStartedAt = Date.now();
  _saveState();
  _startTick();
  EventBus.emit('show:started', { startedAt: _startedAt });
}
 
/**
 * Restaura show após refresh da página.
 * @param {import('../models.js').Setlist} setlist
 * @returns {boolean}
 */
function restore(setlist) {
  const saved = StorageService.getShowState();
  if (!saved?.running || saved.setlistId !== setlist.id) return false;
 
  _setlist       = setlist;
  _running       = true;
  _paused        = saved.paused        ?? false;
  _startedAt     = saved.startedAt;
  _pausedAt      = saved.pausedAt      ?? 0;
  _totalPausedMs = saved.totalPausedMs ?? 0;
  _currentIndex  = saved.currentIndex  ?? 0;
  _songStartedAt = saved.songStartedAt ?? saved.startedAt;
 
  _startTick();
  EventBus.emit('show:restored', { startedAt: _startedAt });
  return true;
}
 
function pause() {
  if (!_running || _paused) return;
  _paused   = true;
  _pausedAt = Date.now();
  _stopTick();
  _saveState();
}
 
function resume() {
  if (!_running || !_paused) return;
  _totalPausedMs += Date.now() - _pausedAt;
  _paused = false;
  _startTick();
  _saveState();
}
 
function togglePause() { _paused ? resume() : pause(); }
 
/** @returns {boolean} false se já estava na última música */
function nextSong() {
  if (!_running) return false;
  if (_currentIndex >= (_setlist?.songs.length ?? 0) - 1) return false;
  _currentIndex++;
  _songStartedAt = Date.now();
  _saveState();
  _tick();
  return true;
}
 
/** @returns {boolean} false se já estava na primeira música */
function prevSong() {
  if (!_running || _currentIndex <= 0) return false;
  _currentIndex--;
  _songStartedAt = Date.now();
  _saveState();
  _tick();
  return true;
}
 
/** @param {number} index */
function jumpTo(index) {
  if (!_running) return;
  if (index < 0 || index >= (_setlist?.songs.length ?? 0)) return;
  _currentIndex  = index;
  _songStartedAt = Date.now();
  _saveState();
  _tick();
}
 
/** Encerra o show e arquiva. */
function end() {
  _stopTick();
  _clearState();
 
  const startedAt = _startedAt;
  const setlist   = _setlist;
 
  _running      = false;
  _paused       = false;
  _setlist      = null;
  _currentIndex = 0;
 
  // SetlistManager arquiva — evitamos dependência circular emitindo o evento
  // e deixando main.js chamar archiveShow
  EventBus.emit('show:ending', { startedAt, setlist });
}
 
const isRunning = () => _running;
const isPaused  = () => _paused;
const getIndex  = () => _currentIndex;
 
export const ShowTimer = Object.freeze({
  start, restore, pause, resume, togglePause,
  nextSong, prevSong, jumpTo, end,
  isRunning, isPaused, getIndex,
});