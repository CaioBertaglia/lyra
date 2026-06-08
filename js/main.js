/**
 * @fileoverview main.js — Controlador da aplicação
 *
 * Responsabilidades:
 *  - Bootstrap de todos os módulos
 *  - Bind de eventos DOM → chamadas ao manager
 *  - Subscribe no EventBus → chamadas ao renderer
 *  - Zero lógica de negócio aqui
 */

'use strict';

import { SetlistManager }                            from './modules/setlist-manager.js';
import { ShowTimer }                                 from './modules/show-timer.js';
import { SpotifyService }                            from './services/spotify.service.js';
import { StorageService }                            from './services/storage.service.js';
import { EventBus }                                  from './core/event-bus.js';
import { showToast, ModalManager, createDragDrop }   from './modules/ui-components.js';
import { MUSICAL_KEYS }                              from './models.js';
import {
  renderStats, renderMeta, renderSetlistTabs,
  renderSongList, renderShowTick, renderStageList,
  renderShowHistory, renderSpotifyResults,
} from './modules/renderer.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

(function boot() {
  SetlistManager.init();

  // Verifica setlist compartilhada na URL
  const shared = SetlistManager.parseShareUrl();
  if (shared) {
    _showSharedModal(shared);
    history.replaceState(null, '', window.location.pathname);
  }

  _renderAll();
  _bindEvents();
  _bindModalCloseButtons();

  // Restaura show se a página foi recarregada durante um show
  const active = SetlistManager.getActive();
  if (active && ShowTimer.restore(active)) _openStage();
})();

// ─── Re-render completo ───────────────────────────────────────────────────────

let _dragDrop = null;

function _renderAll() {
  const sl = SetlistManager.getActive();
  if (!sl) return;

  renderMeta(sl);
  renderStats(SetlistManager.getStats());
  renderSongList(sl.songs, ShowTimer.isRunning() ? ShowTimer.getIndex() : -1);
  renderSetlistTabs(SetlistManager.getAll(), sl.id);
  renderShowHistory(StorageService.getShows());

  // Re-attach drag-drop após re-render completo
  _dragDrop?.destroy();
  const list = document.getElementById('musicList');
  if (list) {
    _dragDrop = createDragDrop(list, (from, to) => SetlistManager.reorderSongs(from, to));
  }
}

// ─── Subscriptions EventBus ───────────────────────────────────────────────────

EventBus.on('setlist:changed',  () => _renderAll());
EventBus.on('setlist:switched', () => _renderAll());
EventBus.on('song:added',       () => _renderAll());
EventBus.on('song:removed',     () => _renderAll());
EventBus.on('song:toggled',     () => _renderAll());
EventBus.on('song:edited',      () => _renderAll());
EventBus.on('song:reordered',   () => _renderAll());

EventBus.on('show:tick', (tick) => {
  renderShowTick(tick, SetlistManager.getActive()?.songs.length ?? 0);
  renderStageList(SetlistManager.getActive()?.songs ?? [], tick.currentIndex);
});

// show:ending emitido pelo ShowTimer para evitar dependência circular
EventBus.on('show:ending', ({ startedAt, setlist }) => {
  SetlistManager.archiveShow(startedAt);
});

EventBus.on('show:ended', ({ show }) => {
  _closeStage();
  _renderAll();
  const h = (ms) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), hr = Math.floor(m / 60);
    return hr > 0 ? `${hr}h ${m % 60}min` : `${m}min`;
  };
  showToast(`Show encerrado! ${show.songsPlayed} músicas em ${h(show.duration)}.`, 'success', 5000);
});

EventBus.on('spotify:result', ({ songs }) => {
  document.getElementById('spotifySpinner')?.setAttribute('hidden', '');
  renderSpotifyResults(songs, _onSpotifySelect);
});

EventBus.on('spotify:error', ({ message }) => {
  document.getElementById('spotifySpinner')?.setAttribute('hidden', '');
  showToast(`Spotify: ${message}`, 'error');
});

// ─── Bind de eventos DOM ──────────────────────────────────────────────────────

function _bindEvents() {

  // ── Abas de setlist ──
  document.getElementById('setlistTabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.setlist-tab[data-id]');
    if (tab) SetlistManager.switchTo(tab.dataset.id);
  });

  document.getElementById('btnNewSetlist')?.addEventListener('click', () => {
    const name = prompt('Nome da nova setlist:')?.trim();
    if (name) SetlistManager.createNew({ name });
  });

  document.getElementById('btnDeleteSetlist')?.addEventListener('click', () => {
    const sl = SetlistManager.getActive();
    if (!sl) return;
    if (SetlistManager.getAll().length <= 1) {
      showToast('Não é possível remover a única setlist.', 'warning'); return;
    }
    if (confirm(`Remover "${sl.name}" permanentemente?`)) {
      SetlistManager.deleteById(sl.id);
      showToast('Setlist removida.', 'info');
    }
  });

  // ── Meta editável inline ──
  document.getElementById('setlistName')?.addEventListener('click', () => {
    const name = prompt('Nome da setlist:', SetlistManager.getActive()?.name)?.trim();
    if (name) SetlistManager.updateMeta({ name });
  });

  document.getElementById('setlistVenue')?.addEventListener('click', () => {
    const venue = prompt('Local do show:', SetlistManager.getActive()?.venue ?? '')?.trim() ?? '';
    SetlistManager.updateMeta({ venue });
  });

  document.getElementById('setlistDate')?.addEventListener('click', () => {
    const date = prompt('Data (AAAA-MM-DD):', SetlistManager.getActive()?.date ?? '')?.trim() ?? '';
    if (!date || /^\d{4}-\d{2}-\d{2}$/.test(date)) SetlistManager.updateMeta({ date });
  });

  // ── Ações na lista de músicas (delegação) ──
  document.getElementById('musicList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'toggle') {
      SetlistManager.toggleSongPlayed(id);
    } else if (action === 'delete') {
      SetlistManager.removeSong(id);
      showToast('Música removida.', 'info');
    } else if (action === 'edit') {
      _openEditModal(id);
    }
  });

  // ── Stage (clique na lista) ──
  document.getElementById('stageSongList')?.addEventListener('click', e => {
    const item = e.target.closest('[data-index]');
    if (item) ShowTimer.jumpTo(Number(item.dataset.index));
  });

  // ── Adicionar música ──
  document.getElementById('btnAddSong')?.addEventListener('click', _openAddModal);

  // ── Formulário de adição ──
  document.getElementById('songForm')?.addEventListener('submit', e => {
    e.preventDefault();
    _submitSong('add');
  });

  // ── Formulário de edição ──
  document.getElementById('songEditForm')?.addEventListener('submit', e => {
    e.preventDefault();
    _submitSong('edit');
  });

  // ── Busca Spotify ──
  document.getElementById('spotifyQuery')?.addEventListener('input', e => {
    const query = e.target.value.trim();
    if (!query) {
      const r = document.getElementById('spotifyResults');
      if (r) { r.innerHTML = ''; r.hidden = true; }
      return;
    }
    const { spotifyClientId, spotifyClientSecret } = StorageService.getSettings();
    if (!spotifyClientId || !spotifyClientSecret) return;
    document.getElementById('spotifySpinner')?.removeAttribute('hidden');
    SpotifyService.search(query, spotifyClientId, spotifyClientSecret);
  });

  // ── Compartilhar ──
  document.getElementById('btnShare')?.addEventListener('click', () => {
    const url = SetlistManager.buildShareUrl();
    document.getElementById('shareUrlDisplay').textContent = url;
    ModalManager.open('modalShare');
  });

  document.getElementById('btnCopyShare')?.addEventListener('click', () => {
    const url = document.getElementById('shareUrlDisplay')?.textContent;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => showToast('Link copiado!', 'success'));
  });

  // ── Iniciar show ──
  document.getElementById('btnStartShow')?.addEventListener('click', () => {
    const sl = SetlistManager.getActive();
    if (!sl?.songs.length) {
      showToast('Adicione músicas antes de iniciar o show.', 'warning'); return;
    }
    ShowTimer.start(sl);
    _openStage();
  });

  // ── Controles do stage ──
  document.getElementById('btnStagePause')?.addEventListener('click', () => {
    ShowTimer.togglePause();
    const btn = document.getElementById('btnStagePause');
    if (btn) btn.textContent = ShowTimer.isPaused() ? '▶' : '⏸';
  });

  document.getElementById('btnStagePrev')?.addEventListener('click', () => ShowTimer.prevSong());
  document.getElementById('btnStageNext')?.addEventListener('click', () => ShowTimer.nextSong());

  document.getElementById('btnStageEnd')?.addEventListener('click', () => {
    if (confirm('Encerrar o show e arquivar?')) ShowTimer.end();
  });

  // ── Histórico: deletar show ──
  document.getElementById('historyList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="delete-show"]');
    if (!btn) return;
    if (confirm('Remover este show do histórico?')) {
      StorageService.deleteShow(btn.dataset.id);
      renderShowHistory(StorageService.getShows());
    }
  });

  // ── Configurações ──
  document.getElementById('btnSettings')?.addEventListener('click', () => {
    const s = StorageService.getSettings();
    document.getElementById('settingsSpotifyId').value     = s.spotifyClientId     ?? '';
    document.getElementById('settingsSpotifySecret').value = s.spotifyClientSecret ?? '';
    ModalManager.open('modalSettings');
  });

  document.getElementById('settingsForm')?.addEventListener('submit', e => {
    e.preventDefault();
    StorageService.saveSettings({
      spotifyClientId:     document.getElementById('settingsSpotifyId').value.trim(),
      spotifyClientSecret: document.getElementById('settingsSpotifySecret').value.trim(),
    });
    ModalManager.close('modalSettings');
    showToast('Configurações salvas.', 'success');
  });
}

// ─── Botões [data-close] ──────────────────────────────────────────────────────

function _bindModalCloseButtons() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => ModalManager.close(btn.dataset.close));
  });
}

// ─── Helpers de modal ─────────────────────────────────────────────────────────

function _keyOptions(selected = '') {
  return MUSICAL_KEYS.map(k =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${k}</option>`
  ).join('');
}

function _openAddModal() {
  document.getElementById('songForm')?.reset();
  document.getElementById('songAlbumArt').value  = '';
  document.getElementById('songSpotifyId').value = '';
  document.getElementById('songKey').innerHTML   = `<option value="">—</option>${_keyOptions()}`;
  const r = document.getElementById('spotifyResults');
  if (r) { r.innerHTML = ''; r.hidden = true; }
  document.getElementById('spotifyQuery').value = '';
  ModalManager.open('modalAddSong');
}

function _openEditModal(songId) {
  const song = SetlistManager.getSongs().find(s => s.id === songId);
  if (!song) return;

  document.getElementById('editSongId').value       = song.id;
  document.getElementById('editSongName').value     = song.name;
  document.getElementById('editSongArtist').value   = song.artist;
  document.getElementById('editSongBpm').value      = song.bpm || '';
  document.getElementById('editSongNotes').value    = song.notes;
  document.getElementById('editSongDuration').value = song.duration
    ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`
    : '';
  document.getElementById('editSongKey').innerHTML  = `<option value="">—</option>${_keyOptions(song.key)}`;

  ModalManager.open('modalEditSong');
}

function _parseDuration(raw) {
  if (!raw) return 0;
  const parts = raw.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] || 0;
}

function _submitSong(mode) {
  if (mode === 'add') {
    const name = document.getElementById('songName')?.value.trim();
    if (!name) { showToast('Nome é obrigatório.', 'warning'); return; }

    SetlistManager.addSong({
      name,
      artist:    document.getElementById('songArtist')?.value.trim() ?? '',
      bpm:       parseInt(document.getElementById('songBpm')?.value) || 0,
      key:       document.getElementById('songKey')?.value ?? '',
      duration:  _parseDuration(document.getElementById('songDuration')?.value),
      notes:     document.getElementById('songNotes')?.value.trim() ?? '',
      albumArt:  document.getElementById('songAlbumArt')?.value ?? '',
      spotifyId: document.getElementById('songSpotifyId')?.value ?? '',
    });

    showToast(`"${name}" adicionada.`, 'success');
    ModalManager.close('modalAddSong');

  } else {
    const id   = document.getElementById('editSongId')?.value;
    const name = document.getElementById('editSongName')?.value.trim();
    if (!name) { showToast('Nome é obrigatório.', 'warning'); return; }

    SetlistManager.editSong(id, {
      name,
      artist:   document.getElementById('editSongArtist')?.value.trim() ?? '',
      bpm:      parseInt(document.getElementById('editSongBpm')?.value) || 0,
      key:      document.getElementById('editSongKey')?.value ?? '',
      duration: _parseDuration(document.getElementById('editSongDuration')?.value),
      notes:    document.getElementById('editSongNotes')?.value.trim() ?? '',
    });

    showToast('Música atualizada.', 'success');
    ModalManager.close('modalEditSong');
  }
}

function _onSpotifySelect(track) {
  document.getElementById('songName').value     = track.name;
  document.getElementById('songArtist').value   = track.artist;
  document.getElementById('songBpm').value      = track.bpm || '';
  document.getElementById('songAlbumArt').value = track.albumArt;
  document.getElementById('songSpotifyId').value = track.spotifyId;

  if (track.duration) {
    const m = Math.floor(track.duration / 60);
    const s = track.duration % 60;
    document.getElementById('songDuration').value = `${m}:${String(s).padStart(2, '0')}`;
  }
  if (track.key) {
    document.getElementById('songKey').innerHTML = `<option value="">—</option>${_keyOptions(track.key)}`;
  }

  const r = document.getElementById('spotifyResults');
  if (r) { r.innerHTML = ''; r.hidden = true; }
  document.getElementById('spotifyQuery').value = '';
  showToast(`"${track.name}" selecionada do Spotify.`, 'success');
}

// ─── Stage ────────────────────────────────────────────────────────────────────

function _openStage() {
  const stage = document.getElementById('showStage');
  if (stage) { stage.removeAttribute('hidden'); stage.setAttribute('aria-hidden', 'false'); }
}

function _closeStage() {
  const stage = document.getElementById('showStage');
  if (stage) { stage.setAttribute('hidden', ''); stage.setAttribute('aria-hidden', 'true'); }
}

// ─── Setlist compartilhada ────────────────────────────────────────────────────

function _showSharedModal(shared) {
  const preview = document.getElementById('sharedPreview');
  if (preview) {
    preview.innerHTML = `
      <strong>${shared.name}</strong> — ${shared.songs.length} músicas
      ${shared.venue ? `<br><small>${shared.venue}</small>` : ''}
    `;
  }

  document.getElementById('btnImportShared')?.addEventListener('click', () => {
    SetlistManager.createNew({
      name:  shared.name + ' (importada)',
      venue: shared.venue,
      date:  shared.date,
      songs: shared.songs,
    });
    ModalManager.close('modalShared');
    showToast('Setlist importada!', 'success');
  }, { once: true });

  ModalManager.open('modalShared');
}
ENDJS
