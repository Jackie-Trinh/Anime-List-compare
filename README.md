# List Compare (MyAnimeList + AniList)

A local app that fetches public anime/manga lists from MyAnimeList or
AniList, caches them as JSON files on disk, and lets you compare lists
across users -- even mixing MAL users and AniList users in one comparison.

## How it works

- **MyAnimeList**: uses MAL's official API, which needs a free "Client ID".
- **AniList**: uses AniList's public GraphQL API, which needs no key at all.
- **Cross-site matching**: MAL and AniList use different internal IDs for
  the same show. AniList's API also return the matching MAL ID
  for each entry, so that's used as the shared key everywhere. A tiny
  number of very obscure AniList entries have no known MAL ID -- those
  just won't match anything.
- **Caching**: every successful fetch is saved as a JSON file in the
  `data/` folder (e.g. `mal_anime_vytrinh.json`). The "Local files" panel
  reads straight from those files -- no network call -- until you press
  that user's **Update** button, which re-fetches and overwrites the file.

## Step 1 — Get a free MAL Client ID (IMPORTANT IF YOU WANT TO USE MAL LIST!)

1. Log in to MyAnimeList, go to <https://myanimelist.net/apiconfig>, click
   "Create ID".
2. App Type: "web". App Redirect URL: `http://localhost` (unused here, but
   required by the form).
3. Copy the **Client ID** it gives you.
4. Open `sources/mal.py`, find this line near the top, and paste your ID in:
   ```python
   MAL_CLIENT_ID = "PUT_YOUR_MAL_CLIENT_ID_HERE"
   ```
   (AniList needs no equivalent step.)

## Step 2 — Install dependencies

```bash
pip install -r requirements.txt
```

## Step 3 — Run it (during development)

Two ways to run it while you're still building/testing:

- **In a browser tab:** `python app.py`, then open `http://127.0.0.1:5000`.
- **As a desktop window:** `python desktop.py` -- opens a real window with
  no terminal/browser chrome, using the same code.

## Step 4 — Use it

1. Pick a **Source** (MyAnimeList or AniList) and **Type** (Anime/Manga),
   type a username, click **Fetch**. It's saved to `data/` automatically.
2. The **Local files** panel lists everyone you've cached for the current
   Type. Tick 2 or more, click **Compare selected**.
3. The table shows every title present on *all* selected users' lists,
   each user's status/score, and the average score (unscored entries are
   excluded from the average). Click **Title** or **Avg score** to sort;
   click again to reverse.
4. Click a row's **Update** button any time to re-fetch just that person
   without touching the others. **Remove** deletes their cache file.

---

## Packaging it as a real desktop app (step by step)

This turns the project into a double-clickable app -- no terminal, no
`python app.py`. It uses **PyInstaller** to bundle Python + your code into
one executable, and **pywebview** (already wired up in `desktop.py`) to
give it a native window instead of a browser tab.

### Before you start: platform note for pywebview

`pywebview` uses your OS's built-in web engine:
- **Windows**: Edge WebView2 (present on most modern Windows installs).
- **macOS**: WebKit (built in, nothing extra needed).
- **Linux**: needs a system package, e.g. `sudo apt install python3-gi
  gir1.2-webkit2-4.0` (varies by distro).

### Step A — Build with PyInstaller

From inside the project folder, with your virtual environment active:

```bash
pyinstaller --name "ListCompare" --windowed --onedir ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    desktop.py
```

(On macOS/Linux, replace the `^` line continuations with `\`, and the
`;` in `--add-data` with `:` — PyInstaller uses `;` on Windows and `:`
everywhere else: `--add-data "templates:templates" --add-data "static:static"`.)

What the flags mean:
- `--windowed`: don't open a terminal window alongside the app.
- `--onedir`: build a folder containing the exe + its files (recommended
  over `--onefile` here -- it starts faster, since `--onefile` has to
  re-extract everything to a temp folder every single launch).
- `--add-data "templates;templates"` and `--add-data "static;static"`:
  bundle the HTML template and the CSS/JS files inside the package. Both
  are required — without them, `render_template` can't find `index.html`
  and the page will load with no styling or behavior, since `app.py`'s
  `get_base_path()` function specifically looks for bundled files at
  `sys._MEIPASS`, which is where these flags put them.

### Step B — Find and run it

PyInstaller creates `dist/ListCompare/`. Inside that folder is
`ListCompare.exe` (Windows) or `ListCompare` (macOS/Linux) — double-click
it. A `data/` folder will be created right next to the executable the
first time you fetch a list, and will persist across runs (this is what
`get_data_path()` in `app.py` is for: it deliberately writes next to the
*executable*, not inside the temporary bundle, so your cached lists
survive between launches and aren't lost when you rebuild).

### Step C — Distribute it

Zip the whole `dist/ListCompare/` folder and share it — the other person
just unzips and double-clicks, no Python install required on their end.
If they also want to fetch MAL data, they'll need their own free Client
ID too (each person should really use their own, not share one).

### Common packaging pitfalls

- **"Template not found" when running the packaged exe**: you forgot
  `--add-data`, or got the `;`/`:` separator wrong for your OS.
- **Blank/white window**: usually a missing WebView2 runtime on Windows —
  Microsoft's installer: search "WebView2 Runtime download".
- **Antivirus flags the exe**: common false-positive for PyInstaller
  builds; code-signing (a paid certificate) is the real fix if you plan
  to distribute widely.

## Notes and limitations

- Only public lists can be read (both sites).
- "Shared titles" = present on *every* selected user's list at once.
- AniList scores are normalized to a 0-10 scale from whatever scoring
  format that user has chosen on AniList (5-point, 100-point, etc.); this
  is an approximation, most noticeably for AniList's 3-point smiley scale.
- Be reasonable with request volume against both APIs — this is a
  personal-use tool, not a bulk scraper.


## Future Implementations

- Show the anime list of one person
- Show anime information when highlighted / Add hyperlink to MAL/AniList site
- add category filtering (genre, tags)
- potentially add a minigame (based on mutual anime list)
