"""
app.py
------
Flask backend. Serves the UI and exposes a small JSON API:

  GET    /api/local?type=anime|manga        -> list cached users (with their items)
  GET    /api/fetch?source=&username=&type= -> fetch fresh from the network,
                                                 save/overwrite the local cache file
  DELETE /api/local?source=&username=&type= -> remove a cached file

Run directly for browser use:   python app.py
Run as a desktop window:        python desktop.py
"""

import sys
import os
import json
import re
from datetime import datetime, timezone

from flask import Flask, jsonify, request, render_template

from sources import fetch_list, MAL_CLIENT_ID


def get_base_path():
    """Where bundled resources (templates/) live. Read-only once packaged."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS  # PyInstaller extracts bundled files here
    return os.path.dirname(os.path.abspath(__file__))


def get_data_path():
    """
    Where the writable JSON cache lives. Must NOT be inside the PyInstaller
    bundle (that folder is temporary/read-only) -- it lives next to the
    actual executable (or next to app.py during development) so it survives
    between runs.
    """
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, "data")
    os.makedirs(path, exist_ok=True)
    return path


app = Flask(
    __name__,
    template_folder=os.path.join(get_base_path(), "templates"),
    static_folder=os.path.join(get_base_path(), "static"),
)


def _safe_filename(source, media_type, username):
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", username.lower())
    return f"{source}_{media_type}_{slug}.json"


def _cache_path(source, media_type, username):
    return os.path.join(get_data_path(), _safe_filename(source, media_type, username))


def _save_cache(source, media_type, username, items):
    record = {
        "username": username,
        "source": source,
        "type": media_type,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "items": items,
    }
    with open(_cache_path(source, media_type, username), "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return record


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/local")
def api_local():
    """List every cached user for the requested media type."""
    media_type = request.args.get("type", "anime")
    records = []
    for filename in os.listdir(get_data_path()):
        if not filename.endswith(".json"):
            continue
        with open(os.path.join(get_data_path(), filename), encoding="utf-8") as f:
            try:
                record = json.load(f)
            except json.JSONDecodeError:
                continue
        if record.get("type") == media_type:
            records.append(record)
    records.sort(key=lambda r: r["username"].lower())
    return jsonify(records)


@app.route("/api/fetch")
def api_fetch():
    """Fetch fresh data from the network and (over)write the local cache file.
    Used both for adding a brand-new user and for the per-row Update button."""
    source = request.args.get("source", "").strip()
    username = request.args.get("username", "").strip()
    media_type = request.args.get("type", "anime")

    if not username:
        return jsonify({"error": "Please provide a username."}), 400
    if source not in ("mal", "anilist"):
        return jsonify({"error": "source must be 'mal' or 'anilist'."}), 400
    if media_type not in ("anime", "manga"):
        return jsonify({"error": "type must be 'anime' or 'manga'."}), 400
    if source == "mal" and MAL_CLIENT_ID == "PUT_YOUR_MAL_CLIENT_ID_HERE":
        return jsonify({"error": "Missing MAL Client ID -- see README.md."}), 500

    try:
        items = fetch_list(source, username, media_type)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:  # network errors, etc.
        return jsonify({"error": f"Request failed: {e}"}), 502

    record = _save_cache(source, media_type, username, items)
    return jsonify(record)


@app.route("/api/local", methods=["DELETE"])
def api_local_delete():
    source = request.args.get("source", "").strip()
    username = request.args.get("username", "").strip()
    media_type = request.args.get("type", "anime")
    path = _cache_path(source, media_type, username)
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"deleted": True})
    return jsonify({"deleted": False}), 404


if __name__ == "__main__":
    app.run(debug=True, port=5000)
