const sourceEl = document.getElementById('source');
const mediaTypeEl = document.getElementById('mediaType');
const usernameEl = document.getElementById('username');
const fetchBtn = document.getElementById('fetchBtn');
const fetchStatus = document.getElementById('fetchStatus');
const localListEl = document.getElementById('localList');
const compareBtn = document.getElementById('compareBtn');
const resultsWrap = document.getElementById('resultsWrap');

let localRecords = [];   // records currently shown for the selected media type
let sortKey = 'title';
let sortDir = 1;
let lastResults = null;

mediaTypeEl.addEventListener('change', () => { loadLocal(); renderResults(null, []); });

async function loadLocal() {
  const type = mediaTypeEl.value;
  const resp = await fetch(`/api/local?type=${type}`);
  localRecords = await resp.json();
  renderLocalList();
}

function keyOf(r) { return `${r.source}:${r.type}:${r.username}`; }

function renderLocalList() {
  const checkedKeys = new Set(
    [...localListEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.dataset.key)
  );

  localListEl.innerHTML = '';
  if (localRecords.length === 0) {
    localListEl.innerHTML = '<p class="empty">No cached lists yet for this type. Fetch one above.</p>';
    updateCompareButton();
    return;
  }

  localRecords.forEach(r => {
    const row = document.createElement('div');
    row.className = 'local-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.key = keyOf(r);
    checkbox.checked = checkedKeys.has(keyOf(r));
    checkbox.addEventListener('change', updateCompareButton);

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

  updateCompareButton();
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

function updateCompareButton() {
  const checked = [...localListEl.querySelectorAll('input[type=checkbox]:checked')];
  compareBtn.disabled = checked.length < 2;
  document.getElementById('compareHint').textContent =
    checked.length < 2 ? 'Select at least 2 users above.' : `${checked.length} users selected.`;
}

compareBtn.addEventListener('click', () => {
  const checkedKeys = [...localListEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.dataset.key);
  const selected = localRecords.filter(r => checkedKeys.includes(keyOf(r)));

  // match_id -> { title, perUser: { label: {score, status_label} } }
  const shared = new Map();
  selected.forEach(record => {
    const label = `${record.username} (${record.source === 'mal' ? 'MAL' : 'AniList'})`;
    record.items.forEach(item => {
      if (!shared.has(item.match_id)) {
        shared.set(item.match_id, { title: item.title, perUser: {} });
      }
      shared.get(item.match_id).perUser[label] = { score: item.score, status_label: item.status_label };
    });
  });

  const labels = selected.map(r => `${r.username} (${r.source === 'mal' ? 'MAL' : 'AniList'})`);
  const rows = [];
  shared.forEach(entry => {
    if (Object.keys(entry.perUser).length === labels.length) {
      const scores = labels.map(l => entry.perUser[l].score).filter(s => s > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      rows.push({ title: entry.title, avg, perUser: entry.perUser });
    }
  });

  lastResults = { labels, rows };
  renderResults(labels, rows);
});

function renderResults(labels, rows) {
  if (!rows || rows.length === 0) {
    resultsWrap.innerHTML = lastResults === null ? '' : '<p class="empty">No shared titles found between the selected users.</p>';
    return;
  }
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'title') return sortDir * a.title.localeCompare(b.title);
    const av = a.avg ?? -1, bv = b.avg ?? -1;
    return sortDir * (av - bv);
  });

  let html = '<table><thead><tr><th data-key="title">Title</th><th data-key="score">Avg score</th>';
  labels.forEach(l => html += `<th>${escapeHtml(l)}</th>`);
  html += '</tr></thead><tbody>';

  sorted.forEach(row => {
    html += `<tr><td>${escapeHtml(row.title)}</td><td>${row.avg !== null ? row.avg.toFixed(2) : '—'}</td>`;
    labels.forEach(l => {
      const info = row.perUser[l];
      html += `<td>${info.status_label}${info.score > 0 ? ' · ' + info.score.toFixed(1) : ''}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  resultsWrap.innerHTML = html;

  resultsWrap.querySelectorAll('th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      sortDir = (sortKey === key) ? -sortDir : 1;
      sortKey = key;
      renderResults(lastResults.labels, lastResults.rows);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadLocal();
