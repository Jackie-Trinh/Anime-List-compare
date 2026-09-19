const sourceEl = document.getElementById('source');
const mediaTypeEl = document.getElementById('mediaType');
const usernameEl = document.getElementById('username');
const fetchBtn = document.getElementById('fetchBtn');
const fetchStatus = document.getElementById('fetchStatus');
const localListEl = document.getElementById('localList');
const viewBtn = document.getElementById('viewBtn');
const compareBtn = document.getElementById('compareBtn');
const resultsWrap = document.getElementById('resultsWrap');
const detailModal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

let localRecords = [];   // records currently shown for the selected media type
let sortKey = 'title';
let sortDir = 1;
// currentView holds whatever's currently in the results table, so sorting
// can re-render without re-running a compare or re-fetching a single list.
// mode 'compare': { mode:'compare', labels: [...], rows: [...] }
// mode 'single':  { mode:'single', label: '...', rows: [...] }
let currentView = null;

mediaTypeEl.addEventListener('change', () => { loadLocal(); currentView = null; renderView(); });

async function loadLocal() {
  const type = mediaTypeEl.value;
  const resp = await fetch(`/api/local?type=${type}`);
  localRecords = await resp.json();
  renderLocalList();
}

function keyOf(r) { return `${r.source}:${r.type}:${r.username}`; }
function labelOf(r) { return `${r.username} (${r.source === 'mal' ? 'MAL' : 'AniList'})`; }

function renderLocalList() {
  const checkedKeys = new Set(
    [...localListEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.dataset.key)
  );

  localListEl.innerHTML = '';
  if (localRecords.length === 0) {
    localListEl.innerHTML = '<p class="empty">No cached lists yet for this type. Fetch one above.</p>';
    updateActionButtons();
    return;
  }

  localRecords.forEach(r => {
    const row = document.createElement('div');
    row.className = 'local-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.key = keyOf(r);
    checkbox.checked = checkedKeys.has(keyOf(r));
    checkbox.addEventListener('change', updateActionButtons);

    const badge = document.createElement('span');
    badge.className = 'badge ' + r.source;
    badge.textContent = r.source === 'mal' ? 'MAL' : 'AniList';

    const name = document.createElement('span');
    name.textContent = r.username;
    name.className = 'grow';

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${r.items.length} entries · updated ${formatDate(r.fetched_at)}`;

    const updateBtn = document.createElement('button');
    updateBtn.className = 'secondary';
    updateBtn.textContent = 'Update';
    updateBtn.addEventListener('click', () => updateOne(r, updateBtn));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeOne(r));

    row.append(checkbox, badge, name, meta, updateBtn, removeBtn);
    localListEl.appendChild(row);
  });

  updateActionButtons();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

async function updateOne(record, btn) {
  btn.disabled = true;
  btn.textContent = 'Updating…';
  try {
    const resp = await fetch(`/api/fetch?source=${record.source}&username=${encodeURIComponent(record.username)}&type=${record.type}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Update failed');
  } catch (e) {
    alert(`Could not update ${record.username}: ${e.message}`);
  }
  await loadLocal();
}

async function removeOne(record) {
  await fetch(`/api/local?source=${record.source}&username=${encodeURIComponent(record.username)}&type=${record.type}`, { method: 'DELETE' });
  await loadLocal();
}

fetchBtn.addEventListener('click', async () => {
  const source = sourceEl.value;
  const type = mediaTypeEl.value;
  const username = usernameEl.value.trim();
  if (!username) return;

  fetchBtn.disabled = true;
  fetchStatus.textContent = 'Fetching…';
  fetchStatus.className = 'status';

  try {
    const resp = await fetch(`/api/fetch?source=${source}&username=${encodeURIComponent(username)}&type=${type}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Fetch failed');
    fetchStatus.textContent = `Saved ${data.items.length} entries for ${username}.`;
    usernameEl.value = '';
    if (type === mediaTypeEl.value) await loadLocal();
  } catch (e) {
    fetchStatus.textContent = e.message;
    fetchStatus.className = 'status err';
  }
  fetchBtn.disabled = false;
});

function updateActionButtons() {
  const checked = [...localListEl.querySelectorAll('input[type=checkbox]:checked')];
  viewBtn.disabled = checked.length !== 1;
  compareBtn.disabled = checked.length < 2;

  const hint = document.getElementById('compareHint');
  if (checked.length === 0) {
    hint.textContent = 'Select at least 2 users to compare, or exactly 1 to view its full list.';
  } else if (checked.length === 1) {
    hint.textContent = '1 user selected — click "View list" to see their full list.';
  } else {
    hint.textContent = `${checked.length} users selected.`;
  }
}

// ---------------------------------------------------------- View list

viewBtn.addEventListener('click', () => {
  const checkedKey = localListEl.querySelector('input[type=checkbox]:checked')?.dataset.key;
  const record = localRecords.find(r => keyOf(r) === checkedKey);
  if (!record) return;

  const rows = record.items.map(item => ({
    title: item.title,
    score: item.score > 0 ? item.score : null,
    status_label: item.status_label,
    mal_id: item.mal_id,
    anilist_id: item.anilist_id,
  }));

  currentView = { mode: 'single', label: labelOf(record), rows };
  renderView();
});

// -------------------------------------------------------------- Compare

compareBtn.addEventListener('click', () => {
  const checkedKeys = [...localListEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.dataset.key);
  const selected = localRecords.filter(r => checkedKeys.includes(keyOf(r)));

  // match_id -> { title, mal_id, anilist_id, perUser: { label: {score, status_label} } }
  const shared = new Map();
  selected.forEach(record => {
    const label = labelOf(record);
    record.items.forEach(item => {
      if (!shared.has(item.match_id)) {
        shared.set(item.match_id, { title: item.title, mal_id: item.mal_id, anilist_id: item.anilist_id, perUser: {} });
      }
      const entry = shared.get(item.match_id);
      // Fill in whichever id this particular source knows, in case an
      // earlier contributor to this shared entry didn't have it.
      entry.mal_id = entry.mal_id || item.mal_id;
      entry.anilist_id = entry.anilist_id || item.anilist_id;
      entry.perUser[label] = { score: item.score, status_label: item.status_label };
    });
  });

  const labels = selected.map(labelOf);
  const rows = [];
  shared.forEach(entry => {
    if (Object.keys(entry.perUser).length === labels.length) {
      const scores = labels.map(l => entry.perUser[l].score).filter(s => s > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      rows.push({ title: entry.title, avg, mal_id: entry.mal_id, anilist_id: entry.anilist_id, perUser: entry.perUser });
    }
  });

  currentView = { mode: 'compare', labels, rows };
  renderView();
});

// ---------------------------------------------------------- Rendering

function renderView() {
  if (!currentView || currentView.rows.length === 0) {
    resultsWrap.innerHTML = currentView === null ? '' : '<p class="empty">No shared titles found between the selected users.</p>';
    return;
  }

  const sorted = [...currentView.rows].sort((a, b) => {
    if (sortKey === 'title') return sortDir * a.title.localeCompare(b.title);
    const scoreOf = row => (currentView.mode === 'compare' ? row.avg : row.score) ?? -1;
    return sortDir * (scoreOf(a) - scoreOf(b));
  });

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(makeSortableHeader('Title', 'title'));

  if (currentView.mode === 'compare') {
    headRow.appendChild(makeSortableHeader('Avg score', 'score'));
    currentView.labels.forEach(l => {
      const th = document.createElement('th');
      th.textContent = l;
      headRow.appendChild(th);
    });
  } else {
    headRow.appendChild(makeSortableHeader('Score', 'score'));
    const th = document.createElement('th');
    th.textContent = 'Status';
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  sorted.forEach(row => {
    const tr = document.createElement('tr');
    tr.appendChild(makeTitleCell(row.title, row.mal_id, row.anilist_id));

    if (currentView.mode === 'compare') {
      const avgTd = document.createElement('td');
      avgTd.textContent = row.avg !== null ? row.avg.toFixed(2) : '—';
      tr.appendChild(avgTd);
      currentView.labels.forEach(l => {
        const info = row.perUser[l];
        const td = document.createElement('td');
        td.textContent = info.status_label + (info.score > 0 ? ' · ' + info.score.toFixed(1) : '');
        tr.appendChild(td);
      });
    } else {
      const scoreTd = document.createElement('td');
      scoreTd.textContent = row.score !== null ? row.score.toFixed(1) : '—';
      tr.appendChild(scoreTd);
      const statusTd = document.createElement('td');
      statusTd.textContent = row.status_label;
      tr.appendChild(statusTd);
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  resultsWrap.innerHTML = '';
  if (currentView.mode === 'single') {
    const caption = document.createElement('p');
    caption.className = 'meta';
    caption.style.marginTop = '0';
    caption.textContent = `Showing ${currentView.label}'s full list · click a title for details`;
    resultsWrap.appendChild(caption);
  }
  resultsWrap.appendChild(table);
}

function makeSortableHeader(text, key) {
  const th = document.createElement('th');
  th.textContent = text;
  th.dataset.key = key;
  th.addEventListener('click', () => {
    sortDir = (sortKey === key) ? -sortDir : 1;
    sortKey = key;
    renderView();
  });
  return th;
}

function makeTitleCell(title, malId, anilistId) {
  const td = document.createElement('td');
  td.textContent = title;
  td.className = 'clickable-title';
  td.title = 'Click for details';
  td.addEventListener('click', () => openDetails(malId, anilistId, title));
  return td;
}

// ------------------------------------------------------------- Modal

async function openDetails(malId, anilistId, fallbackTitle) {
  detailModal.classList.remove('hidden');
  modalBody.innerHTML = `<p class="empty">Loading “${escapeHtml(fallbackTitle)}”…</p>`;

  const type = mediaTypeEl.value;
  const params = new URLSearchParams({ type });
  if (malId) params.set('mal_id', malId);
  if (anilistId) params.set('anilist_id', anilistId);

  try {
    const resp = await fetch(`/api/details?${params.toString()}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Could not load details.');
    renderModal(data);
  } catch (e) {
    modalBody.innerHTML = `<h3>${escapeHtml(fallbackTitle)}</h3><p class="empty">${escapeHtml(e.message)}</p>`;
  }
}

function renderModal(data) {
  const genresHtml = (data.genres || [])
    .map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`)
    .join('');

  modalBody.innerHTML = `
    <h3>${escapeHtml(data.title)}</h3>
    <div class="genres">${genresHtml}</div>
    <p class="summary">${escapeHtml(data.summary || 'No summary available.')}</p>
    <div class="scores">
      ${scoreBlockHtml('MAL', data.mal, v => v.toFixed(2) + ' / 10')}
      ${scoreBlockHtml('AniList', data.anilist, v => v + '%')}
    </div>
    <div class="links">
      ${data.mal && data.mal.url ? `<a class="site-link mal" href="${data.mal.url}" target="_blank" rel="noopener">Open on MAL</a>` : ''}
      ${data.anilist && data.anilist.url ? `<a class="site-link anilist" href="${data.anilist.url}" target="_blank" rel="noopener">Open on AniList</a>` : ''}
    </div>
  `;
}

function scoreBlockHtml(label, info, format) {
  const hasScore = info && typeof info.score === 'number';
  const valueHtml = hasScore
    ? `<div class="value">${format(info.score)}</div>`
    : `<div class="value none">${info && info.error ? escapeHtml(info.error) : 'Not rated yet'}</div>`;
  return `<div class="score-block"><div class="label">${label}</div>${valueHtml}</div>`;
}

modalClose.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function closeModal() {
  detailModal.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadLocal();
