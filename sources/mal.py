"""
sources/mal.py
--------------
(REMEMBER TO ADD YOUR OWN CLIENT ID TO USE THE MAL LIST!)

Everything specific to MyAnimeList: the API base URL, the Client ID,
and the function that fetches and normalizes one user's list.

Common item shape returned by fetch_mal_list() (matches AniList's, see
sources/anilist.py):
{
    "match_id":    str  -- MAL's own numeric id (as a string). This IS the
                            canonical id used everywhere else in the app to
                            find shared entries -- AniList entries carry the
                            matching MAL id too, when known, precisely so
                            they'll line up with these.
    "title":       str
    "score":       float (0-10 scale, 0 = unscored)
    "status":      str  -- normalized status code, see sources/common.py
    "status_label" str  -- human-readable label
}
"""

import requests

from .common import STATUS_LABELS

# --- Put your own MAL Client ID here (https://myanimelist.net/apiconfig) ---
MAL_CLIENT_ID = "Insert_Your_MAL_Client_ID_Here"

MAL_API_BASE = "https://api.myanimelist.net/v2"


def fetch_mal_list(username, media_type):
    """MAL's own status codes already match our normalized ones -- no mapping needed."""
    endpoint = "animelist" if media_type == "anime" else "mangalist"
    url = f"{MAL_API_BASE}/users/{username}/{endpoint}"
    params = {"fields": "list_status", "limit": 1000}
    headers = {"X-MAL-CLIENT-ID": MAL_CLIENT_ID}

    items = []
    while url:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code == 404:
            raise ValueError(f"MAL user '{username}' was not found.")
        if resp.status_code == 403:
            raise ValueError(f"'{username}'s MAL list is private or restricted.")
        resp.raise_for_status()

        data = resp.json()
        for entry in data.get("data", []):
            node = entry["node"]
            status_info = entry.get("list_status", {})
            code = status_info.get("status", "unknown")
            items.append({
                "match_id": str(node["id"]),  # MAL's own id IS the canonical id
                "title": node["title"],
                "score": float(status_info.get("score", 0)),
                "status": code,
                "status_label": STATUS_LABELS[media_type].get(code, code),
            })

        url = data.get("paging", {}).get("next")
        params = None  # next_url already carries the query string

    return items
