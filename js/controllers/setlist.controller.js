'use strict';

import { EventBus } from '../core/event-bus.js';
import { StorageService } from '../services/storage.service.js';
import { createSong, createSetlist } from '../models.js';

function init() {
  ensureActiveSetlist();

  const addButton = document.getElementById('addButton');
  const input = document.getElementById('music-input');

  addButton?.addEventListener('click', () => {
    const name = input.value.trim();

    if (!name) return;

    addManualSong(name);

    input.value = '';
  });

  EventBus.on('song:added', () => {
    render();
  });

  render();
}

function ensureActiveSetlist() {
  let setlist = StorageService.getActiveSetlist();

  if (!setlist) {
    setlist = createSetlist({
      name: 'Minha Setlist',
      isActive: true
    });

    StorageService.upsertSetlist(setlist);
    StorageService.setActiveSetlistId(setlist.id);
  }
}

function addManualSong(name) {
  const setlist = StorageService.getActiveSetlist();

  const song = createSong({
    name
  });

  setlist.songs.push(song);

  StorageService.upsertSetlist(setlist);

  EventBus.emit('song:added', {
    song,
    setlist
  });
}

function render() {
  const list = document.getElementById('musicList');
  const emptyState = document.getElementById('emptyState');

  const setlist = StorageService.getActiveSetlist();

  if (!setlist) return;

  const songs = setlist.songs;

  if (songs.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';

    list.innerHTML = songs.map(song => `
      <li class="music-item">
        <div>
          <strong>${song.name}</strong>
          ${song.artist ? `<br><small>${song.artist}</small>` : ''}
        </div>
      </li>
    `).join('');
  }

  updateStats(songs);
}

function updateStats(songs) {
  const total = songs.length;
  const played = songs.filter(s => s.played).length;
  const remaining = total - played;
  const percent = total
    ? Math.round((played / total) * 100)
    : 0;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPlayed').textContent = played;
  document.getElementById('statRemaining').textContent = remaining;
  document.getElementById('statPercent').textContent = `${percent}%`;

  document.getElementById('sectionCount').textContent =
    `${total} música${total !== 1 ? 's' : ''}`;
}

export const SetlistController = Object.freeze({
  init,
  render
});