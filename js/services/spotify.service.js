/**
 * @fileoverview SpotifyService — search tracks via Spotify Web API
 * Commit 4: Spotify integration
 *
 * Uses the Client Credentials flow (no user login required).
 * Token is cached and refreshed transparently.
 *
 * To enable: set your Client ID + Secret in Settings.
 * Get them at: https://developer.spotify.com/dashboard
 *
 * NOTE: The Client Secret must NOT be shipped in a production app.
 * For Phase 3 (backend), move token exchange server-side.
 */
 
'use strict';
 
import { EventBus } from '../core/event-bus.js';
 
// ─── Token cache ──────────────────────────────────────────────────────────────
 
let _token    = null;
let _tokenExp = 0;
 
async function _getToken(clientId, clientSecret) {
  if (_token && Date.now() < _tokenExp) return _token;
 
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });
 
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
 
  const data = await res.json();
  _token    = data.access_token;
  _tokenExp = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}
 
// ─── Search ───────────────────────────────────────────────────────────────────
 
/**
 * @typedef {Object} SpotifyTrack
 * @property {string} spotifyId
 * @property {string} name
 * @property {string} artist
 * @property {string} albumArt
 * @property {number} duration  - seconds
 * @property {number} bpm       - from audio features (separate call)
 * @property {number} popularity
 */
 
let _debounceTimer = null;
 
/**
 * Search for tracks. Results are emitted on EventBus as 'spotify:result'.
 * Debounced 400 ms.
 * @param {string} query
 * @param {string} clientId
 * @param {string} clientSecret
 */
function search(query, clientId, clientSecret) {
  clearTimeout(_debounceTimer);
  if (!query?.trim() || !clientId || !clientSecret) return;
 
  _debounceTimer = setTimeout(() => _doSearch(query, clientId, clientSecret), 400);
}
 
async function _doSearch(query, clientId, clientSecret) {
  try {
    const token = await _getToken(clientId, clientSecret);
 
    // 1. Search tracks
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
 
    const items = searchData.tracks?.items ?? [];
    if (items.length === 0) {
      EventBus.emit('spotify:result', { songs: [] });
      return;
    }
 
    // 2. Fetch audio features for BPM (batch)
    const ids = items.map(t => t.id).join(',');
    const featRes = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${ids}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const featData = featRes.ok ? await featRes.json() : { audio_features: [] };
    const features = featData.audio_features ?? [];
 
    // 3. Map to SpotifyTrack[]
    const songs = items.map((track, i) => ({
      spotifyId: track.id,
      name:      track.name,
      artist:    track.artists.map(a => a.name).join(', '),
      albumArt:  track.album.images[1]?.url ?? track.album.images[0]?.url ?? '',
      duration:  Math.round((track.duration_ms ?? 0) / 1000),
      bpm:       Math.round(features[i]?.tempo ?? 0),
      key:       _pitchClassToKey(features[i]?.key, features[i]?.mode),
      popularity: track.popularity,
    }));
 
    EventBus.emit('spotify:result', { songs });
  } catch (err) {
    console.error('[SpotifyService]', err);
    EventBus.emit('spotify:error', { message: err.message });
  }
}
 
/**
 * Convert Spotify pitch class + mode to readable key string.
 * @param {number} pitchClass 0-11 (C=0)
 * @param {number} mode       1=major 0=minor
 */
function _pitchClassToKey(pitchClass, mode) {
  if (pitchClass == null || pitchClass < 0) return '';
  const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const note  = notes[pitchClass] ?? '';
  return mode === 1 ? note : `${note}m`;
}
 
export const SpotifyService = Object.freeze({ search });