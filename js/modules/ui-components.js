/**
 * @fileoverview ui-components.js — Toast, ModalManager, DragDrop
 *
 * Componentes de UI reutilizáveis e desacoplados do estado.
 */
 
'use strict';
 
import { EventBus } from '../core/event-bus.js';
 
// ─── Toast ────────────────────────────────────────────────────────────────────
 
/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration ms
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
 
  const icons = { success: '✓', error: '✕', info: '♪', warning: '⚠' };
 
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] ?? '♪'}</span>
    <span class="toast__msg">${message}</span>
  `;
 
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
 
  const dismiss = () => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };
 
  const timer = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}
 
// Integra com EventBus
EventBus.on('toast', ({ message, type }) => showToast(message, type));
 
// ─── ModalManager ─────────────────────────────────────────────────────────────
 
const ModalManager = (() => {
  /** @type {{ id: string, el: HTMLElement }[]} */
  const _stack = [];
 
  function open(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
 
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.dataset.open = 'true';
    _stack.push({ id: modalId, el });
 
    requestAnimationFrame(() => {
      const first = el.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    });
  }
 
  function close(modalId) {
    const entry = _stack.find(m => m.id === modalId);
    if (!entry) return;
    entry.el.setAttribute('hidden', '');
    entry.el.setAttribute('aria-hidden', 'true');
    delete entry.el.dataset.open;
    _stack.splice(_stack.indexOf(entry), 1);
  }
 
  function closeTop() {
    if (_stack.length) close(_stack.at(-1).id);
  }
 
  const isOpen = (id) => _stack.some(m => m.id === id);
 
  // Fecha ao clicar no backdrop
  document.addEventListener('click', e => {
    if (e.target.matches('.modal-backdrop[data-open]')) closeTop();
  });
 
  // Fecha com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTop();
  });
 
  return Object.freeze({ open, close, closeTop, isOpen });
})();
 
// ─── DragDrop ─────────────────────────────────────────────────────────────────
 
/**
 * Habilita reordenação drag-and-drop numa lista.
 * @param {HTMLElement} listEl
 * @param {(from: number, to: number) => void} onReorder
 * @returns {{ destroy: () => void }}
 */
function createDragDrop(listEl, onReorder) {
  let dragSrc  = null;
  let dragFrom = -1;
 
  const getItems = () => [...listEl.querySelectorAll('[data-drag-item]')];
  const getIndex = (el) => getItems().indexOf(el);
 
  function onDragStart(e) {
    dragSrc  = e.currentTarget;
    dragFrom = getIndex(dragSrc);
    dragSrc.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragFrom);
  }
 
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target === dragSrc) return;
    const from = getIndex(dragSrc);
    const to   = getIndex(target);
    if (from < to) target.after(dragSrc);
    else           target.before(dragSrc);
  }
 
  function onDragEnd() {
    const toIdx = getIndex(dragSrc);
    dragSrc?.classList.remove('is-dragging');
    if (dragFrom !== toIdx) onReorder(dragFrom, toIdx);
    dragSrc  = null;
    dragFrom = -1;
  }
 
  function attach(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover',  onDragOver);
    item.addEventListener('dragend',   onDragEnd);
  }
 
  function detach(item) {
    item.removeAttribute('draggable');
    item.removeEventListener('dragstart', onDragStart);
    item.removeEventListener('dragover',  onDragOver);
    item.removeEventListener('dragend',   onDragEnd);
  }
 
  // Attach inicial
  getItems().forEach(attach);
 
  // Observer: auto-attach em novos itens
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.matches('[data-drag-item]')) attach(node);
        node.querySelectorAll?.('[data-drag-item]').forEach(attach);
      });
    });
  });
 
  observer.observe(listEl, { childList: true, subtree: true });
 
  return { destroy: () => { observer.disconnect(); getItems().forEach(detach); } };
}
 
export { showToast, ModalManager, createDragDrop };
 