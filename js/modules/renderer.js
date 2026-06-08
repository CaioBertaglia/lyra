/**
 * @fileoverview renderer.js — camada de apresentação, sem mutações de estado
 *
 * Cada função lê dados e escreve no DOM.
 * Nenhuma lógica de negócio vive aqui.
 */
 
'use strict';
 
import { formatDuration, formatMs } from '../models.js';
 
// ─── Utilitário XSS-safe ──────────────────────────────────────────────────────
 
const esc = (s) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                 .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 
const el = (id) => document.getElementById(id);
 
// ─── Stats ────────────────────────────────────────────────────────────────────
 
/** @param {{ total, played, remaining, totalSecs, pct }} stats */
function renderStats(stats) {
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
 
  set('statTotal',     stats.total);
  set('statPlayed',    stats.played);
  set('statRemaining', stats.remaining);
  set('statPercent',   `${stats.pct}%`);
  set('statDuration',  formatDuration(stats.totalSecs));
 
  // Barras de progresso
  const setBar = (id, pct) => {
    const e = el(id);
    if (e) e.style.width = `${Math.min(100, pct)}%`;
  };
  const pct = stats.total ? (stats.played / stats.total) * 100 : 0;
  setBar('barTotal',     100);
  setBar('barPlayed',    pct);
  setBar('barRemaining', 100 - pct);
  setBar('barPercent',   pct);
}
 
// ─── Meta da setlist ──────────────────────────────────────────────────────────
 
/** @param {import('../models.js').Setlist} setlist */
function renderMeta(setlist) {
  const name  = el('setlistName');
  const venue = el('setlistVenue');
  const date  = el('setlistDate');
 
  if (name)  name.textContent  = setlist.name;
  if (venue) venue.textContent = setlist.venue || 'Adicionar local…';
  if (date)  date.textContent  = setlist.date
    ? new Date(setlist.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}
 
// ─── Abas de setlist ──────────────────────────────────────────────────────────
 
/**
 * @param {import('../models.js').Setlist[]} setlists
 * @param {string} activeId
 */
function renderSetlistTabs(setlists, activeId) {
  const container = el('setlistTabs');
  if (!container) return;
 
  container.innerHTML = setlists.map(sl => `
    <button class="setlist-tab ${sl.id === activeId ? 'setlist-tab--active' : ''}"
            data-id="${esc(sl.id)}" aria-pressed="${sl.id === activeId}">
      ${esc(sl.name)}
    </button>
  `).join('');
}
 
// ─── Lista de músicas ─────────────────────────────────────────────────────────
 
/**
 * @param {import('../models.js').Song[]} songs
 * @param {number} activeIndex
 */
function renderSongList(songs, activeIndex = -1) {
  const list   = el('musicList');
  const empty  = el('emptyState');
  const count  = el('sectionCount');
 
  if (count) count.textContent = `${songs.length} música${songs.length !== 1 ? 's' : ''}`;
 
  if (!list) return;
 
  if (songs.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
 
  if (empty) empty.hidden = true;
  list.innerHTML = songs.map((song, i) => _songItemHTML(song, i, activeIndex)).join('');
}
 
function _songItemHTML(song, index, activeIndex) {
  const isActive = index === activeIndex;
  const dur      = formatDuration(song.duration);
  const art      = song.albumArt
    ? `<img src="${esc(song.albumArt)}" alt="" class="song-art" loading="lazy">`
    : `<span class="song-art song-art--placeholder">♪</span>`;
 
  return `
    <li class="music-item ${song.played ? 'music-item--played' : ''} ${isActive ? 'music-item--active' : ''}"
        data-drag-item data-id="${esc(song.id)}" data-index="${index}">
 
      <span class="drag-handle" aria-hidden="true">⠿</span>
      <span class="song-num mono">${String(index + 1).padStart(2, '0')}</span>
 
      ${art}
 
      <div class="song-info">
        <span class="song-name">${esc(song.name)}</span>
        ${song.artist ? `<span class="song-artist">${esc(song.artist)}</span>` : ''}
      </div>
 
      <div class="song-tags">
        ${song.bpm      ? `<span class="tag mono">${esc(song.bpm)}<small>bpm</small></span>` : ''}
        ${song.key      ? `<span class="tag">${esc(song.key)}</span>` : ''}
        ${song.duration ? `<span class="tag mono">${dur}</span>` : ''}
      </div>
 
      <div class="song-actions">
        <button class="icon-btn icon-btn--edit"   data-action="edit"   data-id="${esc(song.id)}" aria-label="Editar">✎</button>
        <button class="icon-btn icon-btn--play ${song.played ? 'is-played' : ''}"
                data-action="toggle" data-id="${esc(song.id)}"
                aria-label="${song.played ? 'Desmarcar' : 'Marcar como tocada'}" aria-pressed="${song.played}">
          ${song.played ? '✓' : '○'}
        </button>
        <button class="icon-btn icon-btn--delete" data-action="delete" data-id="${esc(song.id)}" aria-label="Remover">✕</button>
      </div>
    </li>`;
}
 
// ─── Stage ao vivo ────────────────────────────────────────────────────────────
 
/**
 * @param {{ elapsed, songElapsed, currentSong, currentIndex, paused }} tick
 * @param {number} totalSongs
 */
function renderShowTick(tick, totalSongs) {
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
 
  set('showElapsed',     formatMs(tick.elapsed));
  set('showSongElapsed', formatMs(tick.songElapsed));
  set('showCurrentSong', tick.currentSong?.name ?? '—');
  set('showSongNum',     `${tick.currentIndex + 1} / ${totalSongs}`);
 
  const bar = el('showSongProgress');
  if (bar && tick.currentSong?.duration) {
    const pct = Math.min(100, (tick.songElapsed / 1000 / tick.currentSong.duration) * 100);
    bar.style.width = `${pct}%`;
  }
}
 
function renderStageList(songs, activeIndex) {
  const list = el('stageSongList');
  if (!list) return;
 
  list.innerHTML = songs.map((s, i) => `
    <li class="stage-song ${i === activeIndex ? 'stage-song--active' : ''} ${s.played ? 'stage-song--played' : ''}"
        data-index="${i}">
      <span class="mono">${String(i + 1).padStart(2, '0')}</span>
      <span>${esc(s.name)}</span>
    </li>`).join('');
}
 
// ─── Histórico de shows ───────────────────────────────────────────────────────
 
/** @param {import('../models.js').Show[]} shows */
function renderShowHistory(shows) {
  const list = el('historyList');
  if (!list) return;
 
  if (shows.length === 0) {
    list.innerHTML = `<li class="history-empty">Nenhum show arquivado ainda.</li>`;
    return;
  }
 
  list.innerHTML = shows.map(show => `
    <li class="history-item" data-id="${esc(show.id)}">
      <div class="history-head">
        <span class="history-name">${esc(show.name)}</span>
        <span class="history-date mono">
          ${new Date(show.endedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div class="history-meta">
        ${show.venue ? `<span class="tag">📍 ${esc(show.venue)}</span>` : ''}
        <span class="tag mono">⏱ ${formatMs(show.duration)}</span>
        <span class="tag">♪ ${show.songsPlayed}/${show.songs.length}</span>
      </div>
      <button class="icon-btn icon-btn--delete" data-action="delete-show" data-id="${esc(show.id)}" aria-label="Remover show">✕</button>
    </li>`).join('');
}
 
// ─── Resultados do Spotify ────────────────────────────────────────────────────
 
/**
 * @param {Object[]} tracks
 * @param {Function} onSelect
 */
function renderSpotifyResults(tracks, onSelect) {
  const container = el('spotifyResults');
  if (!container) return;
 
  container.hidden = tracks.length === 0;
 
  if (tracks.length === 0) {
    container.innerHTML = '';
    return;
  }
 
  container.innerHTML = '';
  tracks.forEach(track => {
    const btn = document.createElement('button');
    btn.className = 'spotify-item';
    btn.type = 'button';
    btn.innerHTML = `
      ${track.albumArt ? `<img src="${esc(track.albumArt)}" alt="" class="spotify-item__art">` : ''}
      <div class="spotify-item__info">
        <span class="spotify-item__name">${esc(track.name)}</span>
        <span class="spotify-item__artist">${esc(track.artist)}</span>
      </div>
      <div class="spotify-item__meta mono">
        ${track.bpm ? `<span>${track.bpm}bpm</span>` : ''}
        ${track.key ? `<span>${esc(track.key)}</span>` : ''}
        <span>${formatDuration(track.duration)}</span>
      </div>`;
    btn.addEventListener('click', () => onSelect(track));
    container.appendChild(btn);
  });
}
 
export {
  renderStats, renderMeta, renderSetlistTabs,
  renderSongList, renderShowTick, renderStageList,
  renderShowHistory, renderSpotifyResults, esc,
};
 