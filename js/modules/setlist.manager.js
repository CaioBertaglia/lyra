/**
 * @fileoverview SetlistManager — fonte única de verdade para estado das setlists
 *
 * Padrão: Comando → Mutação → Persistência → Evento
 * Nenhuma outra camada escreve no storage diretamente.
 */
 
'use strict';
 
import { createSong, createSetlist, createShow, totalDuration } from '../models.js';
import { StorageService } from '../services/storage.service.js';
import { EventBus }       from '../core/event-bus.js';
 
// ─── Estado interno ───────────────────────────────────────────────────────────
 
/** @type {import('../models.js').Setlist|null} */
let _active = null;
 
/** @type {import('../models.js').Setlist[]} */
let _all = [];
 
// ─── Bootstrap ────────────────────────────────────────────────────────────────
 
function init() {
  StorageService.migrate();
  _all    = StorageService.getSetlists();
  _active = StorageService.getActiveSetlist();
 
  if (!_active) {
    const fresh = createSetlist({ name: 'Minha Setlist' });
    _all    = [fresh];
    _active = fresh;
    _persist();
  }
}
 
// ─── Getters ──────────────────────────────────────────────────────────────────
 
const getActive = () => _active;
const getAll    = () => [..._all];
const getSongs  = () => _active?.songs ?? [];
 
function getStats() {
  const songs     = getSongs();
  const played    = songs.filter(s => s.played).length;
  const totalSecs = totalDuration(songs);
  const pct       = songs.length ? Math.round((played / songs.length) * 100) : 0;
  return { total: songs.length, played, remaining: songs.length - played, totalSecs, pct };
}
 
// ─── Comandos de setlist ──────────────────────────────────────────────────────
 
function switchTo(id) {
  const found = _all.find(s => s.id === id);
  if (!found || found.id === _active?.id) return;
  _active = found;
  StorageService.setActiveSetlistId(id);
  EventBus.emit('setlist:switched', { setlist: _active });
}
 
function updateMeta(meta) {
  _active = { ..._active, ...meta };
  _persist();
  EventBus.emit('setlist:changed', { setlist: _active });
}
 
function createNew(overrides = {}) {
  const sl = createSetlist({ name: `Setlist ${_all.length + 1}`, ...overrides });
  _all.push(sl);
  _active = sl;
  StorageService.setActiveSetlistId(sl.id);
  _persist();
  EventBus.emit('setlist:switched', { setlist: _active });
  return sl;
}
 
function deleteById(id) {
  _all = _all.filter(s => s.id !== id);
  if (_active?.id === id) {
    _active = _all[0] ?? null;
    if (!_active) {
      const fresh = createSetlist({ name: 'Minha Setlist' });
      _all    = [fresh];
      _active = fresh;
    }
    StorageService.setActiveSetlistId(_active.id);
  }
  _persist();
  EventBus.emit('setlist:switched', { setlist: _active });
}
 
// ─── Comandos de músicas ──────────────────────────────────────────────────────
 
/** @param {Partial<import('../models.js').Song>} data */
function addSong(data = {}) {
  const song = createSong(data);
  _active.songs.push(song);
  _persist();
  EventBus.emit('song:added', { song, setlist: _active });
  return song;
}
 
/** @param {string} songId */
function removeSong(songId) {
  _active.songs = _active.songs.filter(s => s.id !== songId);
  _persist();
  EventBus.emit('song:removed', { songId, setlist: _active });
}
 
/**
 * @param {string} songId
 * @param {Partial<import('../models.js').Song>} patch
 */
function editSong(songId, patch) {
  const idx = _active.songs.findIndex(s => s.id === songId);
  if (idx < 0) return;
  _active.songs[idx] = { ..._active.songs[idx], ...patch };
  _persist();
  EventBus.emit('song:edited', { song: _active.songs[idx], setlist: _active });
}
 
function toggleSongPlayed(songId) {
  const song = _active.songs.find(s => s.id === songId);
  if (!song) return;
  song.played   = !song.played;
  song.playedAt = song.played ? Date.now() : 0;
  _persist();
  EventBus.emit('song:toggled', { song, setlist: _active });
}
 
function resetPlayed() {
  _active.songs.forEach(s => { s.played = false; s.playedAt = 0; });
  _persist();
  EventBus.emit('setlist:changed', { setlist: _active });
}
 
/**
 * Reordena músicas via drag-and-drop.
 * @param {number} from  índice de origem
 * @param {number} to    índice de destino
 */
function reorderSongs(from, to) {
  if (from === to) return;
  const songs = [..._active.songs];
  const [moved] = songs.splice(from, 1);
  songs.splice(to, 0, moved);
  _active.songs = songs;
  _persist();
  EventBus.emit('song:reordered', { setlist: _active });
}
 
// ─── Arquivo de show ──────────────────────────────────────────────────────────
 
/** @param {number} startedAt */
function archiveShow(startedAt) {
  const show = createShow(_active, startedAt);
  StorageService.saveShow(show);
  EventBus.emit('show:ended', { show });
  return show;
}
 
// ─── Compartilhamento via URL ─────────────────────────────────────────────────
 
function buildShareUrl() {
  const payload = JSON.stringify({
    v:     2,
    name:  _active.name,
    venue: _active.venue,
    date:  _active.date,
    songs: _active.songs.map(({ name, artist, bpm, key, duration }) =>
      ({ name, artist, bpm, key, duration })
    ),
  });
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const url     = new URL(window.location.href);
  url.searchParams.set('share', encoded);
  url.hash = '';
  return url.toString();
}
 
/** @returns {import('../models.js').Setlist|null} */
function parseShareUrl() {
  try {
    const param = new URLSearchParams(window.location.search).get('share');
    if (!param) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(param))));
    if (payload.v !== 2) return null;
    return createSetlist({
      name:  payload.name,
      venue: payload.venue,
      date:  payload.date,
      songs: payload.songs.map(s => createSong(s)),
    });
  } catch {
    return null;
  }
}
 
// ─── Interno ──────────────────────────────────────────────────────────────────
 
function _persist() {
  const idx = _all.findIndex(s => s.id === _active.id);
  if (idx >= 0) _all[idx] = _active;
  else          _all.push(_active);
  StorageService.saveSetlists(_all);
}
 
// ─── Exportação ───────────────────────────────────────────────────────────────
 
export const SetlistManager = Object.freeze({
  init,
  getActive, getAll, getSongs, getStats,
  switchTo, updateMeta, createNew, deleteById,
  addSong, removeSong, editSong, toggleSongPlayed, resetPlayed, reorderSongs,
  archiveShow, buildShareUrl, parseShareUrl,
});