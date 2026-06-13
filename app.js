const app = {
    cards: [],
    filtered: [],
    index: 0,
    direction: 'pol-tur',
    flipped: false,
    filters: { easy: true, medium: true, hard: true, unmarked: true, noDateOnly: false, noGroupOnly: false },
    themeMode: 'light',
    inMemoryStorage: {},
    leitnerSessionCount: 0,
    markedWords: new Set(),
    markedExportQueue: {},

    init() {
        this.initTheme();
        this.setupTabs();
        this.loadData();
        this.loadMarked();
        this.loadFromUrl();
        this.setupEventListeners();
        this.updateUI();
        this.leitner._updateSettingsPanel();
    },

    initTheme() {
        const btn = document.getElementById('themeBtn');
        
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('flashcard-theme');
        } catch (e) {
            console.warn('localStorage not available');
        }
        
        this.themeMode = savedTheme || 'dark';
        this.applyTheme();
        
        btn.addEventListener('click', () => {
            this.themeMode = this.themeMode === 'light' ? 'dark' : 'light';
            this.applyTheme();
            
            try {
                localStorage.setItem('flashcard-theme', this.themeMode);
            } catch (e) {
                console.warn('Could not save theme');
            }
        });
    },

    applyTheme() {
        if (this.themeMode === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeBtn').textContent = '☀️';
            document.getElementById('themeStatus').textContent = 'Dark';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeBtn').textContent = '🌙';
            document.getElementById('themeStatus').textContent = 'Light';
        }
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(tabName).classList.add('active');
            });
        });
    },

    setupEventListeners() {
        document.getElementById('flashcard').addEventListener('click', () => this.flipCard());
        document.getElementById('leitnerCard').addEventListener('click', () => this.leitner.flip());
        document.getElementById('directionBtn').addEventListener('click', () => this.toggleDirection());
        document.getElementById('speakBtn').addEventListener('click', () => this.speakCurrent());
        document.getElementById('excelFile').addEventListener('change', (e) => {
            document.getElementById('fileName').textContent = e.target.files[0]?.name || 'No file selected';
        });
        ['chkEasy', 'chkMedium', 'chkHard', 'chkUnmarked'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.applyFilters());
        });
        const noDateCheckbox = document.getElementById('filterNoDateOnly');
        if (noDateCheckbox) {
            noDateCheckbox.addEventListener('change', () => this.applyFilters());
        }
        const noGroupCheckbox = document.getElementById('filterNoGroupOnly');
        if (noGroupCheckbox) {
            noGroupCheckbox.addEventListener('change', () => this.applyFilters());
        }

        // Auto-focus search input when any group multiselect opens
        document.addEventListener('toggle', e => {
            if (e.target.classList && e.target.classList.contains('group-multiselect') && e.target.open) {
                const input = e.target.querySelector('.group-multiselect-search');
                if (input) setTimeout(() => input.focus(), 0);
            }
        }, true);

        const setupDateRangePicker = (fromId, toId) => {
            const fromEl = document.getElementById(fromId);
            const toEl = document.getElementById(toId);
            if (fromEl && toEl) {
                fromEl.addEventListener('change', () => {
                    if (fromEl.value) {
                        const [y, m] = fromEl.value.split('-').map(Number);
                        const lastDay = new Date(y, m, 0).getDate();
                        toEl.value = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
                    }
                    this.applyFilters();
                });
                toEl.addEventListener('change', () => this.applyFilters());
            }
        };
        
        setupDateRangePicker('filterDateFromPicker', 'filterDateToPicker');
    },

    importText() {
        const text = document.getElementById('textInput').value;
        const lines = text.trim().split('\n').filter(l => l.trim());
        const pairs = [];

        lines.forEach(line => {
            const cells = line.split('\t').map(s => s.trim());
            const [pol, tur, date, groupsRaw, ignore] = cells;
            if (!pol || !tur) return;
            const ignoreVal = (ignore || '').toUpperCase();
            if (ignoreVal === 'OK' || ignoreVal === 'YES') return;
            const pair = { pol, tur, difficulty: 'unmarked' };
            if (date) pair.date = date;
            if (groupsRaw) pair.groups = groupsRaw.split('|').map(g => g.trim()).filter(g => g);
            pairs.push(pair);
        });

        if (pairs.length === 0) {
            this.showMessage('textMsg', 'No valid pairs found', 'error');
            return;
        }

        this.cards = pairs;
        this.filtered = [...this.cards];
        this.index = 0;
        this.flipped = false;
        this.saveData();
        this.updateUI();
        this.showMessage('textMsg', `✓ Imported ${pairs.length} pairs`, 'success');
        this.switchTab('study');
    },

    previewQuizFiles() {
        const files = Array.from(document.getElementById('quizJsonFile').files);
        const preview = document.getElementById('quizJsonPreview');
        if (!files.length) { preview.style.display = 'none'; return; }
        let done = 0;
        const results = new Array(files.length);
        files.forEach((file, i) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    results[i] = `<span style="color:var(--success);">✓</span> <strong>${file.name}</strong> — ${Array.isArray(data) ? data.length : '?'} words`;
                } catch {
                    results[i] = `<span style="color:var(--danger);">✗</span> <strong>${file.name}</strong> — invalid JSON`;
                }
                if (++done === files.length) {
                    preview.innerHTML = results.join('<br>');
                    preview.style.display = 'block';
                }
            };
            reader.readAsText(file);
        });
    },

    importQuizJSON() {
        const files = Array.from(document.getElementById('quizJsonFile').files);
        if (!files.length) {
            this.showMessage('quizJsonMsg', 'No file selected', 'error');
            return;
        }
        const mode = document.getElementById('quizJsonMode').value;
        let allPairs = [];
        let pending = files.length;
        let hasError = false;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data) || data.length === 0) throw new Error(`${file.name}: invalid format`);
                    const pairs = data.map(item => ({
                        pol: item.question.trim(),
                        tur: item.options[item.correctIndex].trim(),
                        difficulty: 'unmarked'
                    })).filter(p => p.pol && p.tur);
                    allPairs = allPairs.concat(pairs);
                } catch (err) {
                    hasError = true;
                    this.showMessage('quizJsonMsg', 'Error: ' + err.message, 'error');
                }
                if (--pending === 0 && !hasError) {
                    if (allPairs.length === 0) {
                        this.showMessage('quizJsonMsg', 'No valid pairs found', 'error');
                        return;
                    }
                    if (mode === 'replace') {
                        this.cards = allPairs;
                    } else {
                        this.cards = [...this.cards, ...allPairs];
                    }
                    this.filtered = [...this.cards];
                    this.index = 0;
                    this.flipped = false;
                    this.saveData();
                    this.updateUI();
                    document.getElementById('quizJsonFile').value = '';
                    document.getElementById('quizJsonPreview').style.display = 'none';
                    document.getElementById('quizJsonPreview').innerHTML = '';
                    document.getElementById('quizJsonMsg').innerHTML = '';
                    this.switchTab('study');
                }
            };
            reader.readAsText(file);
        });
    },

    async importExcel() {
        const file = document.getElementById('excelFile').files[0];
        if (!file) {
            this.showMessage('excelMsg', 'No file selected', 'error');
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            const data = this.parseCSV(buffer);
            
            if (data.length === 0) {
                this.showMessage('excelMsg', 'No valid data found. Make sure file has POL and TUR columns', 'error');
                return;
            }

            this.cards = data;
            this.filtered = [...this.cards];
            this.index = 0;
            this.flipped = false;
            this.saveData();
            this.updateUI();
            this.clearExcelInput();
            document.getElementById('excelMsg').innerHTML = '';
            this.switchTab('study');
        } catch (error) {
            console.error('CSV import error:', error);
            this.showMessage('excelMsg', 'Error: ' + error.message, 'error');
        }
    },

    parseCSV(buffer) {
        try {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(new Uint8Array(buffer));
            const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            if (lines.length < 2) return [];

            const header = lines[0];
            let delimiter = '\t';
            if (!header.includes('\t')) {
                if (header.includes(';')) delimiter = ';';
                else if (header.includes(',')) delimiter = ',';
            }

            const headerRow = header.split(delimiter).map(h => h.trim().toUpperCase());
            let polIdx = -1, turIdx = -1, ignoreIdx = -1, dateIdx = -1, groupIdx = -1;

            for (let i = 0; i < headerRow.length; i++) {
                if (headerRow[i].includes('POL') || headerRow[i] === 'POLISH') polIdx = i;
                if (headerRow[i].includes('TUR') || headerRow[i] === 'TURKISH') turIdx = i;
                if (headerRow[i].includes('IGNORE')) ignoreIdx = i;
                if (headerRow[i].includes('DATE')) dateIdx = i;
                if (headerRow[i].includes('GROUP')) groupIdx = i;
            }

            if (polIdx === -1) polIdx = 0;
            if (turIdx === -1) turIdx = 1;
            if (ignoreIdx === -1) ignoreIdx = 2;

            const pairs = [];
            for (let i = 1; i < lines.length; i++) {
                const cells = lines[i].split(delimiter).map(c => c.trim());
                if (!cells[polIdx] || !cells[turIdx]) continue;
                
                if (ignoreIdx >= 0 && ignoreIdx < cells.length && cells[ignoreIdx]) {
                    const ignoreVal = cells[ignoreIdx].trim().toUpperCase();
                    if (ignoreVal === 'OK' || ignoreVal === 'YES') continue;
                }

                const pair = { pol: cells[polIdx], tur: cells[turIdx], difficulty: 'unmarked' };
                if (dateIdx >= 0 && dateIdx < cells.length && cells[dateIdx]) pair.date = cells[dateIdx];
                if (groupIdx >= 0 && groupIdx < cells.length && cells[groupIdx]) {
                    pair.groups = cells[groupIdx].split('|').map(g => g.trim()).filter(g => g);
                }
                pairs.push(pair);
            }

            return pairs;
        } catch (e) {
            return [];
        }
    },

    generateUrl() {
        try {
            const json = document.getElementById('jsonInput').value.trim();
            const data = JSON.parse(json);
            
            if (!Array.isArray(data)) throw new Error('Must be array');

            const encoder = new TextEncoder();
            const bytes = encoder.encode(json);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const encoded = btoa(binary);
            const url = window.location.origin + window.location.pathname + '#words=' + encodeURIComponent(encoded);
            
            document.getElementById('urlOutput').value = url;
            document.getElementById('urlResult').style.display = 'block';
            this.showMessage('urlMsg', 'URL generated!', 'success');
        } catch (error) {
            this.showMessage('urlMsg', 'Error: ' + error.message, 'error');
        }
    },

    copyUrl() {
        const urlOutput = document.getElementById('urlOutput');
        urlOutput.select();
        document.execCommand('copy');
        this.showMessage('urlMsg', 'Copied!', 'success');
    },

    loadFromUrl() {
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        let encoded = params.get('words');
        if (!encoded) {
            if (hash.startsWith('#words=')) encoded = decodeURIComponent(hash.slice('#words='.length));
        }
        if (!encoded) return;

        try {
            const binary = atob(decodeURIComponent(encoded));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            const json = decoder.decode(bytes);
            const data = JSON.parse(json);
            console.log('Loaded from URL:', data.length, 'pairs');
            
            if (Array.isArray(data)) {
                this.cards = data.map(d => {
                    const card = {
                        pol: d.pol || '',
                        tur: d.tur || '',
                        difficulty: d.difficulty || 'unmarked'
                    };
                    if (d.groups && Array.isArray(d.groups)) card.groups = d.groups;
                    if (d.date) card.date = d.date;
                    return card;
                }).filter(d => d.pol && d.tur);
                
                this.filtered = [...this.cards];
                this.saveData();
                this.updateUI();
                
                if (this.cards.length > 0) {
                    setTimeout(() => {
                        this.switchTab('study');
                        this.showMessage('textMsg', `✓ Loaded ${this.cards.length} word pairs from URL`, 'success');
                    }, 100);
                }
            }
        } catch (error) {
            console.error('URL load error:', error);
        }
    },

    flipCard() {
        this.flipped = !this.flipped;
        this.updateCardDisplay();
        if (document.getElementById('autoSpeak').checked) this.speakCurrent();
    },

    nextCard() {
        if (this.filtered.length === 0) return;
        this.index = (this.index + 1) % this.filtered.length;
        this.flipped = false;
        this.updateCardDisplay();
    },

    prevCard() {
        if (this.filtered.length === 0) return;
        this.index = (this.index - 1 + this.filtered.length) % this.filtered.length;
        this.flipped = false;
        this.updateCardDisplay();
    },

    toggleDirection() {
        this.direction = this.direction === 'pol-tur' ? 'tur-pol' : 'pol-tur';
        this.flipped = false;
        this.updateCardDisplay();
    },

    markDifficulty(level) {
        if (this.filtered.length === 0) return;
        const card = this.filtered[this.index];
        const original = this.cards.find(c => c.pol === card.pol && c.tur === card.tur);
        if (original) original.difficulty = level;
        this.saveData();
        this.nextCard();
    },

    updateCardDisplay() {
        const flashcard = document.getElementById('flashcard');
        const label = document.getElementById('cardLabel');
        const text = document.getElementById('cardText');

        if (this.filtered.length === 0) {
            text.textContent = 'No cards';
            label.textContent = '';
            return;
        }

        const card = this.filtered[this.index];
        const [front, back, frontLabel, backLabel] = this.direction === 'pol-tur'
            ? [card.pol, card.tur, 'Polish', 'Turkish']
            : [card.tur, card.pol, 'Turkish', 'Polish'];

        if (this.flipped) {
            text.textContent = back;
            label.textContent = backLabel;
            flashcard.classList.add('flipped');
            text.classList.add('flipped');
            label.classList.add('flipped');
        } else {
            text.textContent = front;
            label.textContent = frontLabel;
            flashcard.classList.remove('flipped');
            text.classList.remove('flipped');
            label.classList.remove('flipped');
        }

        this.updateProgress();
        document.getElementById('directionBtn').textContent =
            this.direction === 'pol-tur' ? 'Polish → Turkish' : 'Turkish → Polish';
        const markBtn = document.getElementById('flashcardMarkBtn');
        if (markBtn && this.filtered.length > 0) {
            markBtn.textContent = this.isMarked(this.filtered[this.index]) ? '🔖 Marked' : '🏷️ Mark';
        }
        if (document.getElementById('autoSpeak').checked) this.speakCurrent();
    },

    updateProgress() {
        const total = this.filtered.length;
        const current = this.index + 1;
        document.getElementById('cardCounter').textContent = `Card ${current} / ${total}`;
        document.getElementById('progressFill').style.width = total > 0 ? (current / total * 100) + '%' : '0%';
    },

    shuffle() {
        for (let i = this.filtered.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.filtered[i], this.filtered[j]] = [this.filtered[j], this.filtered[i]];
        }
        this.index = 0;
        this.flipped = false;
        this.updateCardDisplay();
    },

    resetProgress() {
        this.index = 0;
        this.flipped = false;
        this.updateCardDisplay();
    },

    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Handle HTML date input format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-');
            return new Date(year, month - 1, day);
        }
        
        // Handle DD-MM-YYYY format (backward compatibility)
        const match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (!match) return null;
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
    },

    updateGroupDropdown() {
        const groups = new Set();
        this.cards.forEach(card => {
            if (card.groups && Array.isArray(card.groups)) {
                card.groups.forEach(g => groups.add(g));
            } else if (card.group && card.group.trim()) {
                groups.add(card.group.trim());
            }
        });
        const list = document.getElementById('filterGroupList');
        if (!list) return;
        const checked = this._getCheckedGroups('filterGroupList');
        list.innerHTML = '<input class="group-multiselect-search" placeholder="Search..." type="text"><div class="group-multiselect-items" id="filterGroupItems"></div>';
        const search = list.querySelector('.group-multiselect-search');
        const items = list.querySelector('.group-multiselect-items');
        search.addEventListener('input', () => {
            const q = search.value.toLowerCase();
            items.querySelectorAll('label').forEach(lbl => {
                lbl.style.display = lbl.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
        search.addEventListener('click', e => e.stopPropagation());
        search.addEventListener('keydown', e => e.stopPropagation());
        Array.from(groups).sort().forEach(group => {
            const lbl = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = group;
            cb.checked = checked.includes(group);
            cb.addEventListener('change', () => this.applyFilters());
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(group));
            items.appendChild(lbl);
        });
        this._updateGroupSummary('filterGroupList', 'filterGroupSummary');
    },

    _getCheckedGroups(listId) {
        const list = document.getElementById(listId);
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
    },

    _updateGroupSummary(listId, summaryId) {
        const selected = this._getCheckedGroups(listId);
        const summary = document.getElementById(summaryId);
        if (!summary) return;
        summary.textContent = selected.length === 0 ? '-- All --' : selected.join(', ');
    },

    resetFilters() {
        this.filters = { easy: true, medium: true, hard: true, unmarked: true };
        document.getElementById('chkEasy').checked = true;
        document.getElementById('chkMedium').checked = true;
        document.getElementById('chkHard').checked = true;
        document.getElementById('chkUnmarked').checked = true;
        document.getElementById('filterDateFromPicker').value = '';
        document.getElementById('filterDateToPicker').value = '';
        document.getElementById('filterNoDateOnly').checked = false;
        document.getElementById('filterNoGroupOnly').checked = false;
        const list = document.getElementById('filterGroupList');
        if (list) list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
        this._updateGroupSummary('filterGroupList', 'filterGroupSummary');
        this.applyFilters();
        this.showMessage('textMsg', 'All filters have been reset', 'info');
    },

    applyFilters() {
        this.filters = {
            easy: document.getElementById('chkEasy').checked,
            medium: document.getElementById('chkMedium').checked,
            hard: document.getElementById('chkHard').checked,
            unmarked: document.getElementById('chkUnmarked').checked
        };

        const filterDateFromStr = document.getElementById('filterDateFromPicker').value.trim();
        const filterDateToStr = document.getElementById('filterDateToPicker').value.trim();
        const filterNoDateOnly = document.getElementById('filterNoDateOnly').checked;
        const filterNoGroupOnly = document.getElementById('filterNoGroupOnly').checked;
        const filterDateFrom = filterDateFromStr ? this.parseDate(filterDateFromStr) : null;
        const filterDateTo = filterDateToStr ? this.parseDate(filterDateToStr) : null;
        const selectedGroups = this._getCheckedGroups('filterGroupList');
        this._updateGroupSummary('filterGroupList', 'filterGroupSummary');

        this.filtered = this.cards.filter(card => {
            const diff = card.difficulty || 'unmarked';
            if (!this.filters[diff]) return false;
            
            if (filterNoDateOnly) {
                if (card.date) return false;
            } else if (filterDateFrom || filterDateTo) {
                const cardDate = card.date ? this.parseDate(card.date) : null;
                if (!cardDate) return false;
                if (filterDateFrom && cardDate < filterDateFrom) return false;
                if (filterDateTo && cardDate > filterDateTo) return false;
            }

            if (filterNoGroupOnly) {
                const cardGroups = card.groups || (card.group ? [card.group.trim()] : []);
                if (cardGroups.length > 0) return false;
            }

            if (selectedGroups.length > 0) {
                const cardGroups = card.groups || (card.group ? [card.group.trim()] : []);
                if (!selectedGroups.some(g => cardGroups.includes(g))) return false;
            }
            
            return true;
        });

        console.log("Filtered cards count:", this.filtered.length);
        this.index = 0;
        this.flipped = false;
        this.updateUI();
    },

    clearAll() {
        if (confirm('Delete all words and clear everything?')) {
            this.cards = [];
            this.filtered = [];
            this.markedWords.clear();
            this.saveData();
            this.saveMarked();
            this.updateUI();
            document.getElementById('textInput').value = '';
            document.getElementById('jsonInput').value = '';
            this.clearExcelInput();
            
            // Also clear the quiz and all data for a complete fresh start
            if (typeof quiz !== 'undefined') {
                // Clear quiz state
                quiz.state.questions = [];
                quiz.state.currentQuestionIndex = 0;
                quiz.state.score = 0;
                quiz.state.selectedOption = null;
                quiz.state.quizInProgress = false;
                quiz.state.missedQuestions = [];
                
                // Clear URL parameters
                const url = new URL(window.location);
                url.searchParams.delete('qCont');
                window.history.replaceState({}, '', url);
                
                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();
                
                // Restore all tabs and reset UI
                quiz.setTabsVisibility(false);
                document.getElementById('quizSetup').style.display = 'block';
                document.getElementById('quizQuestion').style.display = 'none';
                document.getElementById('quizResults').style.display = 'none';
            }
        }
    },

    clearExcelInput() {
        document.getElementById('excelFile').value = '';
        document.getElementById('fileName').textContent = 'No file selected';
    },

    exportJSON() {
        const json = JSON.stringify(this.cards, null, 2);
        this.downloadFile(json, 'flashcards.json', 'application/json');
    },

    exportCSV() {
        let csv = 'Polish,Turkish,Difficulty\n';
        this.cards.forEach(c => {
            csv += `"${c.pol.replace(/"/g, '""')}","${c.tur.replace(/"/g, '""')}","${c.difficulty}"\n`;
        });
        this.downloadFile(csv, 'flashcards.csv', 'text/csv');
    },

    _markKey(card) {
        return card.pol + '::' + card.tur;
    },

    isMarked(card) {
        return card ? this.markedWords.has(this._markKey(card)) : false;
    },

    toggleMark(card) {
        if (!card) return;
        const key = this._markKey(card);
        if (this.markedWords.has(key)) {
            this.markedWords.delete(key);
            delete this.markedExportQueue[key];
        } else {
            this.markedWords.add(key);
            // Capture quiz options at mark time if inside an active quiz
            const q = typeof quiz !== 'undefined' && quiz.state.questions.length > 0
                ? quiz.state.questions[quiz.state.currentQuestionIndex] : null;
            if (q && q.options && q.options.length === 4) {
                this.markedExportQueue[key] = { question: q.question, options: q.options, correctIndex: q.options.indexOf(q.correctAnswer) };
            } else {
                // Leitner / flashcard mode: build 4 options from question pool
                const question = card.pol;
                const correctAnswer = card.tur;
                const distractors = this.cards
                    .filter(c => c !== card && c.tur !== correctAnswer)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3)
                    .map(c => c.tur);
                // Pad with unique placeholders if pool is too small
                while (distractors.length < 3) distractors.push(`option${distractors.length + 2}`);
                const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
                this.markedExportQueue[key] = { question, options, correctIndex: options.indexOf(correctAnswer) };
            }
        }
        this.saveMarked();
        this.renderMarkedList();
    },

    saveMarked() {
        try {
            localStorage.setItem('flashcard-marked', JSON.stringify([...this.markedWords]));
            localStorage.setItem('flashcard-marked-queue', JSON.stringify(this.markedExportQueue));
        } catch (e) {}
    },

    loadMarked() {
        try {
            const raw = localStorage.getItem('flashcard-marked');
            if (raw) this.markedWords = new Set(JSON.parse(raw));
            const queue = localStorage.getItem('flashcard-marked-queue');
            if (queue) this.markedExportQueue = JSON.parse(queue);
        } catch (e) {}
        this.renderMarkedList();
    },

    renderMarkedList() {
        const countEl = document.getElementById('markedCount');
        const listEl = document.getElementById('markedList');
        if (!countEl || !listEl) return;
        countEl.textContent = this.markedWords.size;
        if (this.markedWords.size === 0) {
            listEl.innerHTML = '<p class="text-sm text-light">No marked words yet.</p>';
            return;
        }
        listEl.innerHTML = '';
        [...this.markedWords].forEach(key => {
            const [pol, tur] = key.split('::');
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);';
            const span = document.createElement('span');
            span.className = 'text-sm';
            span.textContent = pol + ' → ' + tur;
            const btn = document.createElement('button');
            btn.textContent = '✕';
            btn.title = 'Unmark';
            btn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;padding:0 4px;';
            btn.addEventListener('click', () => this.unmarkByKey(key));
            div.appendChild(span);
            div.appendChild(btn);
            listEl.appendChild(div);
        });
    },

    unmarkByKey(key) {
        this.markedWords.delete(key);
        this.saveMarked();
        this.renderMarkedList();
        this.refreshMarkButtons();
    },

    refreshMarkButtons() {
        const flashcardBtn = document.getElementById('flashcardMarkBtn');
        if (flashcardBtn && document.getElementById('studyContent')?.style.display !== 'none' && this.filtered.length > 0) {
            flashcardBtn.textContent = this.isMarked(this.filtered[this.index]) ? '🔖 Marked' : '🏷️ Mark';
        }
        const leitnerBtn = document.getElementById('leitnerMarkBtn');
        if (leitnerBtn && document.getElementById('leitnerSession')?.style.display !== 'none') {
            const card = this.leitner._session.cards[this.leitner._session.index];
            if (card) leitnerBtn.textContent = this.isMarked(card) ? '🔖 Marked' : '🏷️ Mark';
        }
        const quizBtn = document.getElementById('quizMarkBtn');
        if (quizBtn && document.getElementById('quizQuestion')?.style.display !== 'none') {
            const q = typeof quiz !== 'undefined' ? quiz.state.questions[quiz.state.currentQuestionIndex] : null;
            if (q && q.originalCard) {
                quizBtn.style.display = 'inline-block';
                quizBtn.textContent = this.isMarked(q.originalCard) ? '🔖 Marked' : '🏷️ Mark';
            }
        }
    },

    exportMarked() {
        if (this.markedWords.size === 0) { alert('No marked words to export.'); return; }
        const data = [...this.markedWords].map(key => {
            if (this.markedExportQueue[key]) return this.markedExportQueue[key];
            // Build options on the fly for words marked before queue was captured
            const [pol, tur] = key.split('::');
            const card = this.cards.find(c => c.pol === pol && c.tur === tur);
            if (!card) return null;
            const distractors = this.cards
                .filter(c => c !== card && c.tur !== tur)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
                .map(c => c.tur);
            while (distractors.length < 3) distractors.push(`option${distractors.length + 2}`);
            const options = [tur, ...distractors].sort(() => Math.random() - 0.5);
            return { question: pol, options, correctIndex: options.indexOf(tur) };
        }).filter(Boolean);
        if (data.length === 0) { alert('No marked words with quiz options available. Mark words during a quiz.'); return; }
        this.downloadFile(JSON.stringify(data, null, 2), 'marked_words.json', 'application/json');
    },

    clearMarked() {
        this.markedWords.clear();
        this.saveMarked();
        this.renderMarkedList();
    },

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type + '; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    updateUI() {
        document.getElementById('totalCount').textContent = this.cards.length;
        
        if (this.cards.length === 0) {
            document.getElementById('emptyStudy').style.display = 'block';
            document.getElementById('studyContent').style.display = 'none';
            document.getElementById('leitnerSession').style.display = 'none';
            document.getElementById('leitnerComplete').style.display = 'none';
        } else {
            document.getElementById('emptyStudy').style.display = 'none';
            document.getElementById('studyContent').style.display = 'block';
            document.getElementById('leitnerSession').style.display = 'none';
            document.getElementById('leitnerComplete').style.display = 'none';
            this.leitner._session = { cards: [], index: 0, direction: 'pol-tur', flipped: false, movedUp: 0, movedDown: 0 };
            this.updateGroupDropdown();
            this.updateCardDisplay();
            this.leitner._updateSettingsPanel();
        }
        
        // Update quiz groups directly if quiz module is available
        if (typeof quiz !== 'undefined' && quiz && quiz.populateGroupFilter) {
            quiz.populateGroupFilter();
        }
        
        // Dispatch an event to notify the quiz module that flashcards have been updated
        // This will trigger the resetQuiz() function in quiz.js
        document.dispatchEvent(new CustomEvent('flashcardsUpdated'));
        this.dialog.updateUI();
    },

    speak(text, lang) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = lang;
        utt.rate = 0.8;
        window.speechSynthesis.speak(utt);
    },

    speakCurrent() {
        if (this.filtered.length === 0) return;
        const card = this.filtered[this.index];
        const isPolFront = this.direction === 'pol-tur';
        if (this.flipped) {
            this.speak(isPolFront ? card.tur : card.pol, isPolFront ? 'tr-TR' : 'pl-PL');
        } else {
            this.speak(isPolFront ? card.pol : card.tur, isPolFront ? 'pl-PL' : 'tr-TR');
        }
    },

    showMessage(elementId, message, type) {
        const el = document.getElementById(elementId);
        el.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => { el.innerHTML = ''; }, 3000);
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    },

    saveData() {
        const json = JSON.stringify(this.cards);
        try {
            localStorage.setItem('flashcard-data', json);
            localStorage.setItem('leitner-session', String(this.leitnerSessionCount));
        } catch (e) {
            this.inMemoryStorage.data = json;
        }
    },

    loadData() {
        let json = null;
        try {
            json = localStorage.getItem('flashcard-data');
            const sc = localStorage.getItem('leitner-session');
            if (sc) this.leitnerSessionCount = parseInt(sc) || 0;
        } catch (e) {
            json = this.inMemoryStorage.data;
        }
        
        if (json) {
            try {
                this.cards = JSON.parse(json);
                this.filtered = [...this.cards];
            } catch (e) {
                console.error('Load error:', e);
            }
        }
    },

    dialog: {
        _lines: [],
        _index: 0,
        _revealed: -1,
        _revealedTur: -1,
        _notes: {},

        _getDialogs() {
            const map = {};
            app.cards.forEach(c => {
                const date = c.date || '';
                const cardGroups = (c.groups && c.groups.length > 0) ? c.groups : [c.group || ''];
                cardGroups.forEach(group => {
                    if (!group) return;
                    const key = group;
                    if (!map[key]) map[key] = { date: '', group, lines: [] };
                    map[key].lines.push(c);
                });
            });
            return Object.values(map).filter(d => d.lines.length > 0);
        },

        _populate() {
            const dialogs = this._getDialogs();
            const topicSel = document.getElementById('dialogTopicSelect');
            const topics = [...new Set(dialogs.map(d => d.group))].sort();
            topicSel.innerHTML = '<option value="">-- Any --</option>' + topics.map(t => `<option value="${t}">${t}</option>`).join('');
            topicSel.addEventListener('change', () => this._updateHints());
            document.getElementById('dialogDatePicker').addEventListener('change', () => this._updateHints());
        },

        _fmtDate(raw) {
            // raw is DD-MM-YYYY, display as DD-MM
            return raw ? raw.slice(0, 5) : raw;
        },

        _updateHints() {
            const dialogs = this._getDialogs();
            const dateRaw = document.getElementById('dialogDatePicker').value;
            const topic = document.getElementById('dialogTopicSelect').value;

            // Date → Topics hint
            const dateHint = document.getElementById('dialogDateHint');
            if (dateRaw) {
                const [y, m, d] = dateRaw.split('-');
                const date = `${d}-${m}-${y}`;
                const topics = [...new Set(dialogs.filter(x => x.lines.some(l => l.date === date)).map(x => x.group))].filter(Boolean).sort();
                dateHint.textContent = topics.length ? `Topics: ${topics.join(', ')}` : 'No topics on this date';
            } else {
                dateHint.textContent = '';
            }

            // Topic → Dates badge
            const btn = document.getElementById('dialogTopicDatesBtn');
            if (topic) {
                const match = dialogs.find(x => x.group === topic);
                const dates = match ? [...new Set(match.lines.map(l => l.date).filter(Boolean))] : [];
                dates.sort((a, b) => {
                    const parse = s => { const [dd,mm,yy] = s.split('-'); return new Date(yy,mm-1,dd); };
                    return parse(b) - parse(a);
                });
                this._topicDates = dates;
                if (dates.length > 0) {
                    btn.textContent = `📅 ${dates.length} date${dates.length !== 1 ? 's' : ''}`;
                    btn.style.display = 'inline-block';
                } else {
                    btn.style.display = 'none';
                }
            } else {
                btn.style.display = 'none';
                document.getElementById('dialogDatesPopup').style.display = 'none';
            }
        },

        toggleDatesPopup() {
            const popup = document.getElementById('dialogDatesPopup');
            const grid = document.getElementById('dialogDatesGrid');
            if (popup.style.display !== 'none') { popup.style.display = 'none'; return; }
            grid.innerHTML = (this._topicDates || []).map(d => `<span class="dialog-date-chip">${this._fmtDate(d)}</span>`).join('');
            popup.style.display = 'block';
        },

        load() {
            const dateRaw = document.getElementById('dialogDatePicker').value;
            const group = document.getElementById('dialogTopicSelect').value;
            const dialogs = this._getDialogs();
            let lines;
            if (group) {
                const match = dialogs.find(d => d.group === group);
                if (!match) { alert('No dialog found for that selection.'); return; }
                lines = match.lines;
                if (dateRaw) {
                    const [y, m, d] = dateRaw.split('-');
                    const date = `${d}-${m}-${y}`;
                    lines = lines.filter(l => l.date === date);
                }
            } else if (dateRaw) {
                const [y, m, d] = dateRaw.split('-');
                const date = `${d}-${m}-${y}`;
                const seen = new Set();
                lines = dialogs.flatMap(d => d.lines).filter(l => {
                    if (l.date !== date) return false;
                    const key = l.pol + '\0' + l.tur;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            } else {
                alert('Please select a date or topic.'); return;
            }
            if (!lines || lines.length === 0) { alert('No dialog found for that selection.'); return; }
            if (document.getElementById('dialogRandomize').checked) {
                for (let i = lines.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [lines[i], lines[j]] = [lines[j], lines[i]];
                }
            }
            this._lines = lines;
            this._loadNotes();

            this._index = 0;
            this._revealed = -1;
            this._revealedTur = -1;
            document.getElementById('dialogPlayer').style.display = 'block';
            this._render();
        },

        _noteKey(line) {
            return 'dlg-note:' + line.pol.trim().slice(0, 40);
        },

        _loadNotes() {
            this._notes = {};
            this._lines.forEach(line => {
                const k = this._noteKey(line);
                try { const v = localStorage.getItem(k); if (v) this._notes[k] = v; } catch(e) {}
            });
        },

        _saveNote(line, text) {
            const k = this._noteKey(line);
            try {
                if (text.trim()) { localStorage.setItem(k, text); this._notes[k] = text; }
                else { localStorage.removeItem(k); delete this._notes[k]; }
            } catch(e) {}
        },

        toggleNote(i) {
            const existing = document.getElementById(`dialog-note-${i}`);
            if (existing) { existing.remove(); return; }
            const line = this._lines[i];
            const container = document.querySelectorAll('.dialog-line')[i];
            if (!container) return;
            const k = this._noteKey(line);
            const saved = this._notes[k] || '';
            const wrap = document.createElement('div');
            wrap.id = `dialog-note-${i}`;
            wrap.className = 'dialog-note-wrap';
            wrap.innerHTML = `<textarea class="dialog-note-input" placeholder="Add a note...">${saved}</textarea><button class="dialog-note-save">Save</button>`;
            wrap.querySelector('.dialog-note-save').addEventListener('click', () => {
                const text = wrap.querySelector('textarea').value;
                this._saveNote(line, text);
                // update the note indicator without full re-render
                const btn = container.querySelector('.dialog-note-btn');
                if (btn) btn.textContent = text.trim() ? '📝' : '🖊';
                wrap.remove();
            });
            container.appendChild(wrap);
            wrap.querySelector('textarea').focus();
        },

        _direction() {
            return document.getElementById('dialogDirection').value;
        },

        _render() {
            const container = document.getElementById('dialogLines');
            container.innerHTML = '';
            const dir = this._direction();
            this._lines.forEach((line, i) => {
                const div = document.createElement('div');
                div.className = 'dialog-line' + (i === this._index ? ' active' : '');
                const frontHidden = i > this._revealed;
                const backHidden = i > this._revealedTur;
                const [frontText, backText, frontClass, backClass] = dir === 'pol-tur'
                    ? [line.pol, line.tur, 'dialog-line-pol', 'dialog-line-tur']
                    : [line.tur, line.pol, 'dialog-line-tur', 'dialog-line-pol'];
                const k = this._noteKey(line);
                const hasNote = !!this._notes[k];
                div.innerHTML =
                    `<div class="${frontClass}" style="${frontHidden ? 'filter:blur(6px);user-select:none;' : ''}">${frontText}</div>` +
                    `<div class="${backClass}" style="${backHidden ? 'filter:blur(6px);user-select:none;' : ''}">${backText}</div>` +
                    `<button class="dialog-note-btn" onclick="app.dialog.toggleNote(${i})">${hasNote ? '📝' : '🖊'}</button>`;
                container.appendChild(div);
            });
            const total = this._lines.length;
            document.getElementById('dialogLineCounter').textContent = `Line ${this._index + 1} / ${total}`;
            document.getElementById('dialogProgressFill').style.width = `${((this._index + 1) / total * 100)}%`;
            const frontRevealed = this._index <= this._revealed;
            const backRevealed = this._index <= this._revealedTur;
            const [frontLang, backLang] = dir === 'pol-tur' ? ['Polish', 'Turkish'] : ['Turkish', 'Polish'];
            document.getElementById('dialogRevealBtn').textContent = !frontRevealed ? `Reveal ${frontLang}` : !backRevealed ? `Reveal ${backLang}` : 'Revealed';
            document.getElementById('dialogRevealBtn').style.display = (frontRevealed && backRevealed) ? 'none' : 'inline-block';
            const activeLine = container.querySelector('.dialog-line.active');
            if (activeLine) activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        reveal() {
            if (this._index > this._revealed) {
                this._revealed = this._index;
            } else if (this._index > this._revealedTur) {
                this._revealedTur = this._index;
            }
            this._render();
        },

        next() {
            if (this._index >= this._lines.length - 1) return;
            if (this._index > this._revealedTur) return; // must reveal both first
            this._index++;
            this._render();
        },

        prev() {
            if (this._index <= 0) return;
            this._index--;
            this._render();
        },

        showAll() {
            this._revealed = this._lines.length - 1;
            this._revealedTur = this._lines.length - 1;
            this._render();
        },

        reset() {
            this._index = 0;
            this._revealed = -1;
            this._revealedTur = -1;
            this._render();
        },

        updateUI() {
            const dialogs = this._getDialogs();
            const hasDialogs = dialogs.length > 0;
            document.getElementById('dialogEmpty').style.display = hasDialogs ? 'none' : 'block';
            document.getElementById('dialogContent').style.display = hasDialogs ? 'block' : 'none';
            document.getElementById('dialogPlayer').style.display = 'none';
            this._lines = [];
            this._index = 0;
            this._revealed = -1;
            this._revealedTur = -1;
            if (hasDialogs) {
                this._populate();
                this._updateHints();
            }
        }
    },

    leitner: {
        _session: { cards: [], index: 0, direction: 'pol-tur', flipped: false, movedUp: 0, movedDown: 0 },

        _getDueCards() {
            const sc = app.leitnerSessionCount;
            if (sc === 0) return [];
            const intervals = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
            return app.filtered.filter(c => {
                const box = c.box || 1;
                return sc % intervals[box] === 0;
            });
        },

        _renderCard() {
            const s = this._session;
            const card = s.cards[s.index];
            const [front, frontLabel] = s.direction === 'pol-tur'
                ? [card.pol, 'Polish'] : [card.tur, 'Turkish'];
            document.getElementById('leitnerCardText').textContent = front;
            document.getElementById('leitnerCardLabel').textContent = frontLabel;
            document.getElementById('leitnerBoxBadge').textContent = `\ud83d\udce6 Box ${card.box || 1}`;
            const total = s.cards.length;
            document.getElementById('leitnerCardCounter').textContent = `Card ${s.index + 1} / ${total}`;
            document.getElementById('leitnerProgressFill').style.width = `${((s.index + 1) / total * 100)}%`;
            document.getElementById('leitnerCard').classList.remove('flipped');
            document.getElementById('leitnerCardText').classList.remove('flipped');
            document.getElementById('leitnerCardLabel').classList.remove('flipped');
            document.getElementById('leitnerFlipBtn').style.display = 'inline-block';
            document.getElementById('leitnerAnswerBtns').style.display = 'none';
            const markBtn = document.getElementById('leitnerMarkBtn');
            if (markBtn) markBtn.textContent = app.isMarked(card) ? '🔖 Marked' : '🏷️ Mark';
            s.flipped = false;
        },

        flip() {
            const s = this._session;
            if (s.flipped || document.getElementById('leitnerSession').style.display === 'none') return;
            s.flipped = true;
            const card = s.cards[s.index];
            const [back, backLabel] = s.direction === 'pol-tur'
                ? [card.tur, 'Turkish'] : [card.pol, 'Polish'];
            document.getElementById('leitnerCardText').textContent = back;
            document.getElementById('leitnerCardLabel').textContent = backLabel;
            document.getElementById('leitnerCard').classList.add('flipped');
            document.getElementById('leitnerCardText').classList.add('flipped');
            document.getElementById('leitnerCardLabel').classList.add('flipped');
            document.getElementById('leitnerFlipBtn').style.display = 'none';
            document.getElementById('leitnerAnswerBtns').style.display = 'flex';
        },

        answer(correct) {
            const s = this._session;
            const card = s.cards[s.index];
            const oldBox = card.box || 1;
            if (correct) {
                card.box = Math.min(oldBox + 1, 5);
                if (card.box > oldBox) s.movedUp++;
            } else {
                card.box = 1;
                s.movedDown++;
            }
            if (s.index < s.cards.length - 1) {
                s.index++;
                this._renderCard();
            } else {
                this._showComplete();
            }
        },

        startSession() {
            app.leitnerSessionCount++;
            let due = this._getDueCards();
            if (due.length === 0) {
                app.showMessage('textMsg', 'No cards due for this session!', 'info');
                app.leitnerSessionCount--;
                return;
            }
            const dir = document.getElementById('leitnerDirection').value;
            const randomize = document.getElementById('leitnerRandomize').checked;
            if (randomize) {
                for (let i = due.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [due[i], due[j]] = [due[j], due[i]];
                }
            }
            this._session = { cards: due, index: 0, direction: dir, flipped: false, movedUp: 0, movedDown: 0 };
            document.getElementById('studyContent').style.display = 'none';
            document.getElementById('leitnerComplete').style.display = 'none';
            document.getElementById('leitnerSession').style.display = 'block';
            this._renderCard();
            app.saveData();
        },

        _showComplete() {
            document.getElementById('leitnerSession').style.display = 'none';
            document.getElementById('leitnerMovedUp').textContent = this._session.movedUp;
            document.getElementById('leitnerMovedDown').textContent = this._session.movedDown;
            document.getElementById('leitnerComplete').style.display = 'block';
            app.saveData();
            this._updateSettingsPanel();
        },

        endSession() {
            this._showComplete();
        },

        backToDeck() {
            document.getElementById('leitnerComplete').style.display = 'none';
            document.getElementById('leitnerSession').style.display = 'none';
            document.getElementById('studyContent').style.display = 'block';
            this._updateDueCount();
        },

        _updateDueCount() {
            const due = this._getDueCards();
            document.getElementById('leitnerDueCount').textContent = `${due.length} cards due today`;
        },

        _updateSettingsPanel() {
            document.getElementById('leitnerSessionNum').textContent = app.leitnerSessionCount;
            const counts = [0,0,0,0,0];
            app.cards.forEach(c => { counts[(c.box || 1) - 1]++; });
            document.getElementById('leitnerBoxStats').innerHTML =
                counts.map((n, i) => `Box ${i+1}: ${n} card${n !== 1 ? 's' : ''}`).join('<br>');
            this._updateDueCount();
        },

        resetProgress() {
            if (!confirm('Reset all Leitner progress? All cards will return to Box 1 and session count resets to 0.')) return;
            app.cards.forEach(c => { c.box = 1; });
            app.leitnerSessionCount = 0;
            app.saveData();
            this._updateSettingsPanel();
            app.showMessage('leitnerMsg', 'Leitner progress reset.', 'info');
        },

    }
};

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'dialog') {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); app.dialog.next(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); app.dialog.prev(); }
        if (e.key === ' ') { e.preventDefault(); const d = app.dialog; (d._index <= d._revealed && d._index <= d._revealedTur) ? d.next() : d.reveal(); }
        return;
    }
    if (app.filtered.length === 0) return;
    if (e.key === 'ArrowRight') app.nextCard();
    if (e.key === 'ArrowLeft') app.prevCard();
    if (e.key === ' ') { e.preventDefault(); app.flipCard(); }
});

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});