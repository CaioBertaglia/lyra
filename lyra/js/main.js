// ── SELETORES ──
const input = document.getElementById('music-input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('music-list');
const empty = document.getElementById('empty-state');

// ── ESTADO ──
let songs = JSON.parse(localStorage.getItem('lyra') || '[]');

// ── PERSISTÊNCIA ──
function save() {
    localStorage.setItem('lyra', JSON.stringify(songs));
}

// ── STATS ──
function updateStats() {
    const total = songs.length;
    const played = songs.filter(s => s.played).length;
    const remaining = total - played;
    const pct = total ? Math.round((played / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-played').textContent = played;
    document.getElementById('stat-remaining').textContent = remaining;
    document.getElementById('stat-pct').textContent = pct + '%';

    document.getElementById('bar-total').style.width = total ? '100%' : '0%';
    document.getElementById('bar-played').style.width = pct + '%';
    document.getElementById('bar-remaining').style.width = total ? ((remaining / total) * 100) + '%' : '0%';
    document.getElementById('bar-pct').style.width = pct + '%';

    document.getElementById('section-count').textContent =
        total + (total === 1 ? ' música' : ' músicas');

    empty.classList.toggle('visible', total === 0);
}

// ── SEGURANÇA (evita XSS) ──
function esc(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

// ── RENDERIZAR LISTA ──
function render() {
    list.innerHTML = '';

    songs.forEach((song, i) => {
        const li = document.createElement('li');
        li.className = 'music-item' + (song.played ? ' played' : '');

        li.innerHTML = `
      <span class="drag-handle">⠿</span>
      <button class="check-btn" onclick="toggle(${i})">
        <svg class="check-mark" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#FAEEDA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="music-index">${String(i + 1).padStart(2, '0')}</span>
      <div class="music-info">
        <div class="music-name">${esc(song.name)}</div>
        <div class="music-meta">adicionada hoje</div>
      </div>
      ${song.played
                ? '<span class="pill pill-played">TOCADA</span>'
                : '<span class="pill pill-queue">NA FILA</span>'}
      <button class="delete-btn" onclick="remove(${i})" title="Remover">✕</button>
    `;

        list.appendChild(li);
    });

    updateStats();
}

// ── AÇÕES ──
function addSong() {
    const name = input.value.trim();
    if (!name) return;
    songs.push({ name, played: false });
    save();
    render();
    input.value = '';
    input.focus();
}

function remove(i) {
    songs.splice(i, 1);
    save();
    render();
}

function toggle(i) {
    songs[i].played = !songs[i].played;
    save();
    render();
}

function focusInput() {
    input.focus();
}

// ── EVENTOS ──
addBtn.addEventListener('click', addSong);
input.addEventListener('keydown', e => {
    if (e.key === 'Enter') addSong();
});

// ── INICIAR ──
render();