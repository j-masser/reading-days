// Reading Days: a personal calendar of the books you read each day.
// Data lives in localStorage under STORE_KEY:
//   { books: { [id]: {id, title, author, coverId, year} }, days: { "YYYY-MM-DD": [bookId, ...] } }

const STORE_KEY = 'reading-days.v1';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

let state = load();
let view = new Date(); view.setDate(1);
let openDay = null;

const $ = (id) => document.getElementById(id);

// ---------- storage ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.books && s.days) return s;
  } catch {}
  return { books: {}, days: {} };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('Could not save. Your browser may be blocking storage for this page.'); }
}

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const todayKey = () => keyOf(new Date());

// ---------- covers ----------
function hue(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function coverEl(book) {
  const wrap = document.createElement('div');
  wrap.className = 'cover';
  const generated = () => {
    wrap.innerHTML = '';
    wrap.classList.add('gen-cover');
    wrap.style.setProperty('--h', hue(book.title + (book.author || '')));
    const t = document.createElement('span'); t.className = 'gt'; t.textContent = book.title;
    const a = document.createElement('span'); a.className = 'ga'; a.textContent = book.author || '';
    wrap.append(t, a);
  };
  if (book.coverId) {
    const img = document.createElement('img');
    img.src = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`;
    img.alt = book.title;
    img.loading = 'lazy';
    img.onerror = generated;
    wrap.append(img);
  } else {
    generated();
  }
  wrap.title = book.author ? `${book.title} by ${book.author}` : book.title;
  return wrap;
}

// ---------- stats ----------
function readKeys() {
  return Object.keys(state.days).filter((k) => state.days[k]?.length).sort();
}
function computeStats() {
  const keys = readKeys();
  const set = new Set(keys);

  // Current streak: counts back from today, or from yesterday if today isn't logged yet.
  let streak = 0;
  const d = new Date();
  if (!set.has(keyOf(d))) d.setDate(d.getDate() - 1);
  while (set.has(keyOf(d))) { streak++; d.setDate(d.getDate() - 1); }

  let longest = 0, run = 0, prev = null;
  for (const k of keys) {
    const n = dayNum(k);
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }

  const y = view.getFullYear();
  const monthPrefix = `${y}-${pad(view.getMonth() + 1)}`;
  const monthDays = keys.filter((k) => k.startsWith(monthPrefix)).length;
  const yearBooks = new Set(keys.filter((k) => k.startsWith(`${y}-`)).flatMap((k) => state.days[k])).size;

  return { streak, longest, monthDays, yearBooks, year: y };
}

// ---------- render ----------
function render() {
  const y = view.getFullYear(), m = view.getMonth();
  $('month-title').textContent = `${MONTHS[m]} ${y}`;
  document.title = `Reading Days · ${MONTHS[m]} ${y}`;

  const s = computeStats();
  $('stat-streak').textContent = s.streak;
  $('stat-streak').parentElement.classList.toggle('hot', s.streak > 0);
  $('stat-longest').textContent = s.longest;
  $('stat-month-days').textContent = s.monthDays;
  $('stat-month-days-label').textContent = `Days read in ${MONTHS[m]}`;
  $('stat-year-books').textContent = s.yearBooks;
  $('stat-year-label').textContent = `Books in ${s.year}`;

  renderGrid(y, m);
  renderShelf(y, m);
}

function renderGrid(y, m) {
  const grid = $('grid');
  grid.innerHTML = '';
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const tKey = todayKey();

  for (let i = 0; i < first; i++) {
    const b = document.createElement('div'); b.className = 'cell blank'; b.setAttribute('aria-hidden', 'true');
    grid.append(b);
  }
  for (let d = 1; d <= count; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ids = (state.days[key] || []).filter((id) => state.books[id]);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (key === tKey) cell.classList.add('today');
    if (key > tKey) cell.classList.add('future');
    if (ids.length) cell.classList.add('has-books');
    const titles = ids.map((id) => state.books[id].title).join(', ');
    cell.setAttribute('aria-label', `${MONTHS[m]} ${d}${ids.length ? `: ${titles}` : ', nothing logged'}`);

    const num = document.createElement('span'); num.className = 'date-num'; num.textContent = d;
    const covers = document.createElement('div'); covers.className = 'covers';
    ids.slice(0, 3).forEach((id) => covers.append(coverEl(state.books[id])));
    if (ids.length > 1) {
      const more = document.createElement('span'); more.className = 'more'; more.textContent = `×${ids.length}`;
      covers.append(more);
    }
    cell.append(num, covers);
    cell.addEventListener('click', () => openDialog(key));
    grid.append(cell);
  }
}

function renderShelf(y, m) {
  const shelf = $('shelf');
  shelf.innerHTML = '';
  const prefix = `${y}-${pad(m + 1)}`;
  const counts = new Map();
  for (const k of readKeys()) {
    if (!k.startsWith(prefix)) continue;
    for (const id of state.days[k]) {
      if (!state.books[id]) continue;
      const c = counts.get(id) || { days: 0, first: k };
      c.days++;
      counts.set(id, c);
    }
  }
  $('shelf-title').textContent = `On the shelf in ${MONTHS[m]}`;
  $('shelf-count').textContent = counts.size ? `${counts.size} book${counts.size === 1 ? '' : 's'}` : '';
  if (!counts.size) {
    const p = document.createElement('p');
    p.className = 'empty-shelf';
    p.textContent = 'No books logged this month yet. Tap any day on the calendar to add what you read.';
    shelf.append(p);
    return;
  }
  [...counts.entries()].sort((a, b) => a[1].first.localeCompare(b[1].first)).forEach(([id, c]) => {
    const book = state.books[id];
    const item = document.createElement('div'); item.className = 'shelf-item';
    const t = document.createElement('div'); t.className = 'shelf-title'; t.textContent = book.title;
    const meta = document.createElement('div'); meta.className = 'shelf-meta';
    meta.textContent = `${c.days} day${c.days === 1 ? '' : 's'}`;
    item.append(coverEl(book), t, meta);
    shelf.append(item);
  });
}

// ---------- day dialog ----------
const dlg = $('day-dialog');

function openDialog(key) {
  openDay = key;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  $('day-stamp').textContent = `${pad(d)} ${MONTHS[m - 1].slice(0, 3).toUpperCase()} ${y}`;
  $('day-title').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('search').value = '';
  $('results').innerHTML = '';
  $('search-status').textContent = '';
  renderDayBooks();
  dlg.showModal();
  $('search').focus();
}

function bookRow(book, actionEl) {
  const row = document.createElement('div');
  row.className = 'book-row';
  const info = document.createElement('div'); info.className = 'book-info';
  const t = document.createElement('div'); t.className = 'book-title'; t.textContent = book.title;
  const a = document.createElement('div'); a.className = 'book-author';
  a.textContent = [book.author, book.year].filter(Boolean).join(' · ');
  info.append(t, a);
  row.append(coverEl(book), info);
  if (actionEl) row.append(actionEl);
  return row;
}

function renderDayBooks() {
  const list = $('day-books');
  list.innerHTML = '';
  const ids = state.days[openDay] || [];
  if (!ids.length) {
    const li = document.createElement('li'); li.className = 'day-empty';
    li.textContent = 'Nothing logged for this day yet.';
    list.append(li);
  }
  ids.forEach((id) => {
    const book = state.books[id];
    if (!book) return;
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'remove-btn'; rm.textContent = 'Remove';
    rm.setAttribute('aria-label', `Remove ${book.title} from this day`);
    rm.addEventListener('click', () => removeFromDay(id));
    const li = document.createElement('li');
    li.append(bookRow(book, rm));
    list.append(li);
  });
  renderRecent();
}

function renderRecent() {
  const wrap = $('recent');
  wrap.innerHTML = '';
  const onDay = new Set(state.days[openDay] || []);
  // Most recently read books, newest first, skipping ones already on this day.
  const seen = new Set();
  for (const k of readKeys().reverse()) {
    for (const id of state.days[k]) {
      if (!seen.has(id) && !onDay.has(id) && state.books[id]) seen.add(id);
    }
    if (seen.size >= 8) break;
  }
  $('recent-wrap').hidden = seen.size === 0;
  seen.forEach((id) => {
    const book = state.books[id];
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'chip';
    const label = document.createElement('span'); label.textContent = book.title;
    chip.append(coverEl(book), label);
    chip.setAttribute('aria-label', `Add ${book.title} to this day`);
    chip.addEventListener('click', () => addToDay(book));
    wrap.append(chip);
  });
}

function addToDay(book) {
  state.books[book.id] = { ...state.books[book.id], ...book };
  const list = state.days[openDay] || (state.days[openDay] = []);
  if (!list.includes(book.id)) list.push(book.id);
  save();
  $('search').value = '';
  $('results').innerHTML = '';
  $('search-status').textContent = `Added ${book.title}.`;
  renderDayBooks();
  render();
}

function removeFromDay(id) {
  state.days[openDay] = (state.days[openDay] || []).filter((x) => x !== id);
  if (!state.days[openDay].length) delete state.days[openDay];
  // Forget books that no longer appear on any day.
  const used = new Set(Object.values(state.days).flat());
  if (!used.has(id)) delete state.books[id];
  save();
  renderDayBooks();
  render();
}

// ---------- Open Library search ----------
let searchTimer = null;
let searchCtl = null;

$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) {
    if (searchCtl) searchCtl.abort();
    $('results').innerHTML = '';
    $('search-status').textContent = '';
    return;
  }
  searchTimer = setTimeout(() => search(q), 350);
});

async function search(q) {
  if (searchCtl) searchCtl.abort();
  searchCtl = new AbortController();
  $('search-status').textContent = 'Searching Open Library…';
  let docs = [];
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year`;
    const res = await fetch(url, { signal: searchCtl.signal });
    if (!res.ok) throw new Error(res.status);
    docs = (await res.json()).docs || [];
    $('search-status').textContent = docs.length ? '' : 'No matches. You can still add it as typed.';
  } catch (err) {
    if (err.name === 'AbortError') return;
    $('search-status').textContent = 'Could not reach Open Library. You can still add the book as typed.';
  }
  showResults(q, docs);
}

function showResults(q, docs) {
  const list = $('results');
  list.innerHTML = '';
  const books = docs.map((d) => ({
    id: d.key,
    title: d.title,
    author: (d.author_name || [])[0] || '',
    coverId: d.cover_i || null,
    year: d.first_publish_year || null,
  }));
  books.push({ id: `manual:${q.toLowerCase()}`, title: q, author: '', coverId: null, year: null, manual: true });

  books.forEach((book) => {
    const tag = document.createElement('span');
    tag.className = 'add-tag';
    tag.textContent = book.manual ? 'Add as typed' : 'Add';
    const row = bookRow(book, tag);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = row.className;
    btn.append(...row.childNodes);
    btn.addEventListener('click', () => {
      const { manual, ...clean } = book;
      addToDay(clean);
    });
    const li = document.createElement('li');
    li.append(btn);
    list.append(li);
  });
}

// ---------- backup ----------
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reading-days-${todayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded.');
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.books !== 'object' || typeof data.days !== 'object') throw new Error();
    if (!confirm('Replace everything in this browser with the backup?')) return;
    state = { books: data.books, days: data.days };
    save();
    render();
    toast('Backup imported.');
  } catch {
    toast('That file is not a Reading Days backup.');
  }
});

// ---------- misc ----------
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

$('prev').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); render(); });
$('next').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); render(); });
$('today').addEventListener('click', () => { view = new Date(); view.setDate(1); render(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // click backdrop to close

render();
