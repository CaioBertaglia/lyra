// ================================
//  SIMPLIFIED & FULL FUNCTIONALITY
//  - add / remove / toggle played
//  - stats + progress bars
//  - localStorage persistence
//  - Drag & Drop reorder (HTML5 native)
//  - XSS safe rendering
// ================================

(function() {
    // ----- DOM elements -----
    const musicInput = document.getElementById('music-input');
    const addBtn = document.getElementById('addButton');
    const musicListContainer = document.getElementById('musicList');
    const emptyStateDiv = document.getElementById('emptyState');

    // ----- State -----
    let songs = [];         // each object: { name, played }

    // ----- load from localStorage -----
    function loadFromStorage() {
        const stored = localStorage.getItem('lyra_setlist');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    songs = parsed;
                } else {
                    songs = [];
                }
            } catch(e) { songs = []; }
        } else {
            songs = [];
        }
    }

    // ----- save to localStorage -----
    function saveToStorage() {
        localStorage.setItem('lyra_setlist', JSON.stringify(songs));
    }

    // ----- update statistics (total, played, remaining, percentage) -----
    function updateStatsAndUI() {
        const total = songs.length;
        const playedCount = songs.filter(s => s.played === true).length;
        const remainingCount = total - playedCount;
        const percent = total === 0 ? 0 : Math.round((playedCount / total) * 100);

        // update numbers
        document.getElementById('statTotal').innerText = total;
        document.getElementById('statPlayed').innerText = playedCount;
        document.getElementById('statRemaining').innerText = remainingCount;
        document.getElementById('statPercent').innerText = percent + '%';

        // progress bars width (smooth)
        const totalPercentWidth = total > 0 ? 100 : 0;
        const playedPercentWidth = percent;
        const remainingPercentWidth = total === 0 ? 0 : (remainingCount / total) * 100;
        
        const barTotal = document.getElementById('barTotal');
        const barPlayed = document.getElementById('barPlayed');
        const barRemaining = document.getElementById('barRemaining');
        const barPercent = document.getElementById('barPercent');
        
        if (barTotal) barTotal.style.width = totalPercentWidth + '%';
        if (barPlayed) barPlayed.style.width = playedPercentWidth + '%';
        if (barRemaining) barRemaining.style.width = remainingPercentWidth + '%';
        if (barPercent) barPercent.style.width = percent + '%';

        // update section counter text
        const counterSpan = document.getElementById('sectionCount');
        if (counterSpan) {
            counterSpan.innerText = total + (total === 1 ? ' música' : ' músicas');
        }

        // toggle empty state visibility
        if (emptyStateDiv) {
            if (total === 0) {
                emptyStateDiv.classList.remove('hidden');
            } else {
                emptyStateDiv.classList.add('hidden');
            }
        }
    }

    // ----- escape HTML (XSS prevention) -----
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    // ----- render full list with drag & drop attributes -----
    function renderList() {
        if (!musicListContainer) return;
        musicListContainer.innerHTML = '';
        
        songs.forEach((song, idx) => {
            const li = document.createElement('li');
            li.className = 'music-item' + (song.played ? ' played' : '');
            li.setAttribute('data-index', idx);
            li.setAttribute('draggable', 'true');
            
            // drag start handler
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
            
            // inner structure
            const dragSpan = document.createElement('span');
            dragSpan.className = 'drag-handle';
            dragSpan.innerText = '⠿';
            dragSpan.style.cursor = 'grab';
            
            // checkbox / circle
            const checkDiv = document.createElement('div');
            checkDiv.className = 'check-circle';
            checkDiv.innerHTML = `<span class="check-mark">${song.played ? '✓' : ''}</span>`;
            checkDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePlayed(idx);
            });
            
            // index number
            const indexSpan = document.createElement('span');
            indexSpan.className = 'index';
            indexSpan.innerText = String(idx + 1).padStart(2, '0');
            
            // song info block
            const infoDiv = document.createElement('div');
            infoDiv.className = 'song-info';
            const songNameDiv = document.createElement('div');
            songNameDiv.className = 'song-name';
            songNameDiv.innerText = escapeHtml(song.name);
            const metaDiv = document.createElement('div');
            metaDiv.className = 'song-meta';
            metaDiv.innerText = 'adicionada • setlist';
            infoDiv.appendChild(songNameDiv);
            infoDiv.appendChild(metaDiv);
            
            // pill status
            const pillSpan = document.createElement('span');
            pillSpan.className = 'pill-status' + (song.played ? ' played-pill' : '');
            pillSpan.innerText = song.played ? 'TOCADA' : 'NA FILA';
            
            // delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.setAttribute('aria-label', 'Remover música');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSong(idx);
            });
            
            li.appendChild(dragSpan);
            li.appendChild(checkDiv);
            li.appendChild(indexSpan);
            li.appendChild(infoDiv);
            li.appendChild(pillSpan);
            li.appendChild(delBtn);
            
            musicListContainer.appendChild(li);
        });
        
        updateStatsAndUI();
    }
    
    // ----- DRAG & DROP handlers (reordering) -----
    let dragSourceIndex = null;
    
    function handleDragStart(e) {
        const li = e.target.closest('.music-item');
        if (!li) return;
        const idx = li.getAttribute('data-index');
        if (idx !== null) {
            dragSourceIndex = parseInt(idx, 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
        }
        // style
        e.target.style.opacity = '0.5';
    }
    
    function handleDragOver(e) {
        e.preventDefault();  // necessary for drop
        e.dataTransfer.dropEffect = 'move';
    }
    
    function handleDrop(e) {
        e.preventDefault();
        const targetLi = e.target.closest('.music-item');
        if (!targetLi) return;
        const targetIndexAttr = targetLi.getAttribute('data-index');
        if (targetIndexAttr === null) return;
        const targetIndex = parseInt(targetIndexAttr, 10);
        if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
            // reorder songs array
            const [movedItem] = songs.splice(dragSourceIndex, 1);
            songs.splice(targetIndex, 0, movedItem);
            saveToStorage();
            renderList();   // re-render with new order
        }
        // reset opacity for dragged element
        if (e.target && e.target.style) e.target.style.opacity = '';
        dragSourceIndex = null;
    }
    
    // ----- actions -----
    function addSong() {
        const rawName = musicInput.value.trim();
        if (rawName === '') return;
        const newSong = {
            name: rawName,
            played: false
        };
        songs.push(newSong);
        saveToStorage();
        renderList();
        musicInput.value = '';
        musicInput.focus();
    }
    
    function removeSong(index) {
        if (index >= 0 && index < songs.length) {
            songs.splice(index, 1);
            saveToStorage();
            renderList();
        }
    }
    
    function togglePlayed(index) {
        if (index >= 0 && index < songs.length) {
            songs[index].played = !songs[index].played;
            saveToStorage();
            renderList();
        }
    }
    
    // public helper for focus (can be called from anywhere)
    window.focusInput = function() {
        musicInput.focus();
    };
    
    // attach event listeners
    addBtn.addEventListener('click', addSong);
    musicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSong();
        }
    });
    
    // initial load & render
    loadFromStorage();
    renderList();
    
    // reset drag source after drag ends globally
    document.addEventListener('dragend', function(e) {
        if (e.target && e.target.style) e.target.style.opacity = '';
        dragSourceIndex = null;
    });
})();