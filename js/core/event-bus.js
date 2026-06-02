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