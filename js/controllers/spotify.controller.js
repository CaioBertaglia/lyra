'use strict';
import { EventBus } from '../core/event-bus.js';
import { StorageService } from '../services/storage.service.js';
import { SpotifyService } from '../services/spotify.service.js';
import { createSong } from '../models.js';


const CLIENT_ID = '';
const CLIENT_SECRET = '';

function init() {
  const input = document.getElementById('music-input');

  if (!input) return;

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (!query) {
      clearResults();
      return;
    }

    SpotifyService.search(
      query,
      CLIENT_ID,
      CLIENT_SECRET
    );
  });

  EventBus.on('spotify:result', ({ songs }) => {
    renderResults(songs);
  });

  EventBus.on('spotify:error', ({ message }) => {
    console.error(message);
  });
}

function clearResults() {
  const container = document.getElementById('spotifyResults');

  if (!container) return;

  container.innerHTML = '';
  container.hidden = true;
}

function renderResults(songs) {
  const container = document.getElementById('spotifyResults');

  if (!container) return;

  if (!songs.length) {
    clearResults();
    return;
  }

  container.hidden = false;

  container.innerHTML = songs.map(song => `
    <div class="spotify-item" data-id="${song.spotifyId}">
      <img src="${song.albumArt}" alt="${song.name}">
      <div>
        <strong>${song.name}</strong>
        <small>${song.artist}</small>
      </div>
    </div>
  `).join('');
}

const addButton = document.getElementById('addButton');

if (addButton) {
  addButton.addEventListener('click', () => {
    console.log('Botão clicado');
  });
}

export const SpotifyController = Object.freeze({
  init
});