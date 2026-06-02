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