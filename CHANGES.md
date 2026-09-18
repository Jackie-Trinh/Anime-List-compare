# CHANGES — what's new in this update

This describes what changed since the first version (single MAL-only app),
so you know what's new, what moved, and what you still need to fill in.

## New file tree

```
malcompare/
├── app.py                  Flask backend: routes + local cache logic (changed)
├── desktop.py               NEW — desktop window entry point (pywebview)
├── requirements.txt          changed — added pywebview, pyinstaller
├── README.md                 changed — AniList setup, caching, packaging steps
├── sources/                  NEW — replaces the old single sources.py
│   ├── __init__.py           dispatch function fetch_list(source, ...)
│   ├── common.py             shared STATUS_LABELS vocabulary
│   ├── mal.py                MAL-only fetch logic + MAL_CLIENT_ID
│   └── anilist.py            AniList-only fetch logic (no key needed)
├── templates/
│   └── index.html            changed — now markup only, links to static/
├── static/                   NEW
│   ├── style.css              all CSS, extracted from index.html
│   └── script.js               all JavaScript, extracted from index.html
└── data/                     your cached JSON lists land here (gitignored-style, empty at first)
```

## What you need to configure

Same single step as before, just a new location:

**`sources/mal.py`**, near the top:
```python
MAL_CLIENT_ID = "PUT_YOUR_MAL_CLIENT_ID_HERE"
```
Paste your MAL API Client ID there (see README.md Step 1 for how to get
one). AniList needs no key — `sources/anilist.py` works as-is.

Nothing else needs editing to get the app running.

## What changed, and why

### 1. AniList support
- `sources/anilist.py` is a new, fully independent module. It queries
  AniList's public GraphQL API (`https://graphql.anilist.co`) — one
  request returns a user's entire list, no pagination needed.
- AniList lets users pick their own scoring scale (5-point, 100-point,
  etc.), so scores are normalized to the same 0–10 scale MAL uses, based
  on that user's `scoreFormat`.
- **Cross-site matching**: AniList's API returns each entry's matching
  MAL id (`idMal`). That's used as the shared `match_id` everywhere, so a
  MAL user and an AniList user can be compared directly. When AniList
  doesn't know the MAL id for something, that entry gets a source-only id
  that deliberately won't match anything — safer than guessing a match.

### 2. Local JSON caching
- Every successful fetch is saved to `data/<source>_<type>_<username>.json`.
- New endpoint `GET /api/local?type=` reads straight from those files —
  no network call.
- New endpoint `DELETE /api/local?...` removes a cached file (wired to
  each row's **Remove** button).
- `GET /api/fetch?...` (renamed/repurposed from the old single fetch
  route) now always writes/overwrites the cache file after a successful
  fetch — this one route is used both for "add a new user" and for the
  per-row **Update** button, since both actions are really "fetch fresh
  and save."

### 3. UI split into separate files
- `templates/index.html` is now markup only.
- `static/style.css` holds all styling (previously an inline `<style>`
  block).
- `static/script.js` holds all behavior (previously an inline `<script>`
  block) — also rewritten to know about sources and the local-cache
  panel, with a per-row **Update** button and checkbox-based comparison
  selection.
- `app.py` was updated to explicitly point Flask's `static_folder` at the
  same packaging-aware base path as `templates`, so this still works once
  bundled by PyInstaller (see below).

### 4. MAL/AniList code split into separate files
- Old: one `sources.py` with both fetch functions in it.
- New: `sources/mal.py` and `sources/anilist.py` are independent of each
  other — neither imports from the other, only from `sources/common.py`
  (the shared status-label dictionary). `sources/__init__.py` is the only
  place that knows both exist, via one small `fetch_list()` dispatcher.

### 5. Desktop packaging
- `desktop.py` is a new entry point: runs the Flask server on a
  background thread, then opens a native window (via `pywebview`)
  pointing at it. This is the file PyInstaller packages — see README.md's
  "Packaging it as a real desktop app" section for the full
  `pyinstaller` command and an explanation of each flag.
- `app.py` gained two helper functions, `get_base_path()` and
  `get_data_path()`, so the same code works both unpackaged and
  packaged: bundled resources (`templates/`, `static/`) are read from
  PyInstaller's temporary extraction folder, while the writable `data/`
  cache is deliberately kept next to the actual executable so it
  persists across runs instead of vanishing with the temp folder.

## Nothing you need to change in your own copy

If you already have the first version working with your MAL Client ID
filled in, all you need to do is copy that same Client ID string into the
new `sources/mal.py` in the same spot — everything else is drop-in.
