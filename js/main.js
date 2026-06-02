/**
 * @fileoverview Data models for Lyra
 *
 * Song: unit of a setlist
 * Setlist: named collection of songs
 * Show: archived snapshot of a completed setlist
 */
 
'use strict';
 
// ─── Song ────────────────────────────────────────────────────────────────────
 
/**
 * @typedef {Object} Song
 * @property {string}  id        - UUID
 * @property {string}  name      - Display name
 * @property {string}  artist    - Artist / band
 * @property {number}  bpm       - Beats per minute (0 = unknown)
 * @property {string}  key       - Musical key, e.g. "Am", "G#"
 * @property {number}  duration  - Seconds (0 = unknown)
 * @property {boolean} played    - Toggled during a live show
 * @property {number}  playedAt  - Timestamp when marked as played (ms)
 * @property {string}  spotifyId - Spotify track ID (optional)
 * @property {string}  albumArt  - Album art URL (optional)
 * @property {string}  notes     - Free-form performer notes
 * @property {number}  addedAt   - Creation timestamp (ms)
 */
 
/**
 * Factory: create a new Song with safe defaults.
 * @param {Partial<Song>} overrides
 * @returns {Song}
 */
export function createSong(overrides = {}) {
  return {
    id:        crypto.randomUUID(),
    name:      '',
    artist:    '',
    bpm:       0,
    key:       '',
    duration:  0,
    played:    false,
    playedAt:  0,
    spotifyId: '',
    albumArt:  '',
    notes:     '',
    addedAt:   Date.now(),
    ...overrides,
  };
}
 
// ─── Setlist ──────────────────────────────────────────────────────────────────
 
/**
 * @typedef {Object} Setlist
 * @property {string}   id        - UUID
 * @property {string}   name      - Display name
 * @property {string}   venue     - Venue name
 * @property {string}   date      - ISO date string (YYYY-MM-DD)
 * @property {Song[]}   songs     - Ordered list of songs
 * @property {boolean}  isActive  - Whether this is the current setlist
 * @property {number}   createdAt - Creation timestamp (ms)
 * @property {number}   updatedAt - Last-modified timestamp (ms)
 */
 
/**
 * Factory: create a new Setlist.
 * @param {Partial<Setlist>} overrides
 * @returns {Setlist}
 */
export function createSetlist(overrides = {}) {
  const now = Date.now();
  return {
    id:        crypto.randomUUID(),
    name:      'Nova Setlist',
    venue:     '',
    date:      new Date().toISOString().slice(0, 10),
    songs:     [],
    isActive:  false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
 
// ─── Show (archive) ───────────────────────────────────────────────────────────
 
/**
 * @typedef {Object} Show
 * @property {string}  id          - UUID
 * @property {string}  setlistId   - Source setlist ID
 * @property {string}  name        - Setlist name at time of show
 * @property {string}  venue       - Venue
 * @property {string}  date        - ISO date
 * @property {Song[]}  songs       - Snapshot of songs at show end
 * @property {number}  startedAt   - Timestamp show started (ms)
 * @property {number}  endedAt     - Timestamp show ended (ms)
 * @property {number}  duration    - Total show duration (ms)
 * @property {number}  songsPlayed - Count of played songs
 */
 
/**
 * Factory: create a Show from a completed setlist.
 * @param {Setlist} setlist
 * @param {number}  startedAt
 * @returns {Show}
 */
export function createShow(setlist, startedAt) {
  const endedAt = Date.now();
  return {
    id:          crypto.randomUUID(),
    setlistId:   setlist.id,
    name:        setlist.name,
    venue:       setlist.venue,
    date:        setlist.date,
    songs:       structuredClone(setlist.songs),
    startedAt,
    endedAt,
    duration:    endedAt - startedAt,
    songsPlayed: setlist.songs.filter(s => s.played).length,
  };
}
 
// ─── Computed helpers ─────────────────────────────────────────────────────────
 
/** @param {Song[]} songs @returns {number} total seconds */
export function totalDuration(songs) {
  return songs.reduce((acc, s) => acc + (s.duration || 0), 0);
}
 
/** @param {number} seconds @returns {string} "mm:ss" */
export function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
 
/** @param {number} ms @returns {string} "hh:mm:ss" */
export function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
 
/** Musical keys in chromatic order */
export const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb',
  'E', 'F', 'F#', 'Gb', 'G', 'G#',
  'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm',
  'Em', 'Fm', 'F#m', 'Gm', 'G#m',
  'Am', 'A#m', 'Bbm', 'Bm',
];

/**
 * @fileoverview StorageService — typed localStorage wrapper with versioning
 * Commit 2: data model + storage service
 *
 * All persistence goes through this module.
 * Keys are namespaced under "lyra_v2_*" to avoid collisions
 * and allow future schema migrations.
 */
 
'use strict';
 
import { createSetlist } from '../models.js';
 
// ─── Constants ────────────────────────────────────────────────────────────────
 
const KEYS = Object.freeze({
  SETLISTS:       'lyra_v2_setlists',
  ACTIVE_SETLIST: 'lyra_v2_active',
  SHOWS:          'lyra_v2_shows',
  SHOW_STATE:     'lyra_v2_show_state',
  SETTINGS:       'lyra_v2_settings',
  SCHEMA_VERSION: 'lyra_v2_schema',
});
 
const SCHEMA_VERSION = 2;
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
 
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[StorageService] write failed:', key, e);
    return false;
  }
}
 
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}
 
// ─── Migration ─────────────────────────────────────────────────────────────
 
/**
 * Migrates legacy v1 data (lyra_setlist) to v2 schema.
 * Runs once on first load of v2.
 */
function migrate() {
  const version = read(KEYS.SCHEMA_VERSION, 1);
  if (version >= SCHEMA_VERSION) return;
 
  const legacy = read('lyra_setlist');
  if (Array.isArray(legacy) && legacy.length > 0) {
    const migrated = createSetlist({
      name:   'Setlist Importada',
      songs:  legacy.map(s => ({
        id:        crypto.randomUUID(),
        name:      s.name ?? '',
        artist:    '',
        bpm:       0,
        key:       '',
        duration:  0,
        played:    s.played ?? false,
        playedAt:  0,
        spotifyId: '',
        albumArt:  '',
        notes:     '',
        addedAt:   Date.now(),
      })),
    });
    write(KEYS.SETLISTS, [migrated]);
    write(KEYS.ACTIVE_SETLIST, migrated.id);
    remove('lyra_setlist');
    console.info('[StorageService] Migrated v1 → v2');
  }
 
  write(KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
}
 
// ─── Setlists ─────────────────────────────────────────────────────────────────
 
/** @returns {import('../models.js').Setlist[]} */
function getSetlists() {
  return read(KEYS.SETLISTS, []);
}
 
/** @param {import('../models.js').Setlist[]} setlists */
function saveSetlists(setlists) {
  // stamp updatedAt on each
  const stamped = setlists.map(sl => ({ ...sl, updatedAt: Date.now() }));
  write(KEYS.SETLISTS, stamped);
}
 
/** @param {import('../models.js').Setlist} setlist */
function upsertSetlist(setlist) {
  const all = getSetlists();
  const idx = all.findIndex(s => s.id === setlist.id);
  if (idx >= 0) {
    all[idx] = { ...setlist, updatedAt: Date.now() };
  } else {
    all.push({ ...setlist, updatedAt: Date.now() });
  }
  write(KEYS.SETLISTS, all);
}
 
/** @param {string} id */
function deleteSetlist(id) {
  const filtered = getSetlists().filter(s => s.id !== id);
  write(KEYS.SETLISTS, filtered);
}
 
/** @returns {string|null} */
function getActiveSetlistId() {
  return read(KEYS.ACTIVE_SETLIST, null);
}
 
/** @param {string} id */
function setActiveSetlistId(id) {
  write(KEYS.ACTIVE_SETLIST, id);
}
 
/** @returns {import('../models.js').Setlist|null} */
function getActiveSetlist() {
  const id  = getActiveSetlistId();
  const all = getSetlists();
  return all.find(s => s.id === id) ?? all[0] ?? null;
}
 
// ─── Shows (archive) ─────────────────────────────────────────────────────────
 
/** @returns {import('../models.js').Show[]} */
function getShows() {
  return read(KEYS.SHOWS, []);
}
 
/** @param {import('../models.js').Show} show */
function saveShow(show) {
  const all = getShows();
  all.unshift(show); // most-recent first
  write(KEYS.SHOWS, all);
}
 
/** @param {string} id */
function deleteShow(id) {
  write(KEYS.SHOWS, getShows().filter(s => s.id !== id));
}
 
// ─── Live show state ──────────────────────────────────────────────────────────
 
/**
 * @typedef {Object} ShowState
 * @property {boolean} running
 * @property {number}  startedAt
 * @property {number}  currentSongIndex
 * @property {number}  currentSongStartedAt
 */
 
/** @returns {ShowState|null} */
function getShowState() {
  return read(KEYS.SHOW_STATE, null);
}
 
/** @param {ShowState|null} state */
function saveShowState(state) {
  if (state === null) {
    remove(KEYS.SHOW_STATE);
  } else {
    write(KEYS.SHOW_STATE, state);
  }
}
 
// ─── Settings ─────────────────────────────────────────────────────────────────
 
const DEFAULT_SETTINGS = {
  spotifyClientId: '',
  autoAdvance:     true,
  countdownBeats:  4,
  theme:           'dark',
};
 
/** @returns {typeof DEFAULT_SETTINGS} */
function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.SETTINGS, {}) };
}
 
/** @param {Partial<typeof DEFAULT_SETTINGS>} patch */
function saveSettings(patch) {
  write(KEYS.SETTINGS, { ...getSettings(), ...patch });
}
 
// ─── Export ───────────────────────────────────────────────────────────────────
 
export const StorageService = Object.freeze({
  migrate,
  // setlists
  getSetlists,
  saveSetlists,
  upsertSetlist,
  deleteSetlist,
  getActiveSetlistId,
  setActiveSetlistId,
  getActiveSetlist,
  // shows
  getShows,
  saveShow,
  deleteShow,
  // live state
  getShowState,
  saveShowState,
  // settings
  getSettings,
  saveSettings,
});

/**
 * @fileoverview EventBus — pub/sub for decoupled module communication
 * Commit 3: event bus + setlist manager
 *
 * Usage:
 *   EventBus.on('setlist:changed', handler)
 *   EventBus.emit('setlist:changed', payload)
 *   EventBus.off('setlist:changed', handler)
 */
 
'use strict';
 
/** @type {Map<string, Set<Function>>} */
const listeners = new Map();
 
function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
}
 
function off(event, handler) {
  listeners.get(event)?.delete(handler);
}
 
/** Subscribe once — handler auto-removed after first call */
function once(event, handler) {
  const wrapper = (payload) => {
    handler(payload);
    off(event, wrapper);
  };
  on(event, wrapper);
}
 
function emit(event, payload = null) {
  listeners.get(event)?.forEach(h => {
    try { h(payload); }
    catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
  });
}
 
export const EventBus = Object.freeze({ on, off, once, emit });
 
// ─── Event catalogue (documentation + autocomplete) ─────────────────────────
//
//  setlist:changed   { setlist }         Active setlist mutated
//  setlist:switched  { setlist }         User switched to a different setlist
//  song:added        { song, setlist }
//  song:removed      { songId, setlist }
//  song:toggled      { song, setlist }   Played toggled
//  song:reordered    { setlist }
//  song:edited       { song, setlist }
//  show:started      { startedAt }
//  show:ended        { show }
//  show:tick         { elapsed, songElapsed, currentSong }
//  spotify:result    { songs }           Search results returned
//  spotify:error     { message }
//  toast             { message, type }   "success" | "error" | "info"
//  modal:open        { id, data }
//  modal:close       { id }