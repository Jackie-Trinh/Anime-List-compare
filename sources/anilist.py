"""
sources/anilist.py
-------------------
Everything specific to AniList: the GraphQL query, its status vocabulary,
its per-user score-format quirk, and the function that fetches and
normalizes one user's list.

Common item shape returned by fetch_anilist_list() (matches MAL's, see
sources/mal.py):
{
    "match_id":    str  -- the matching MyAnimeList id when AniList knows
                            it (this is what lets a MAL user and an AniList
                            user be compared against each other). Falls
                            back to an AniList-only id ("anilist-only-123")
                            for the rare entry with no known MAL match --
                            which correctly won't match anything, rather
                            than risking a wrong guess.
    "title":       str
    "score":       float (0-10 scale, 0 = unscored)
    "status":      str  -- normalized status code, see sources/common.py
    "status_label" str  -- human-readable label
}
"""

import requests

from .common import STATUS_LABELS

ANILIST_API = "https://graphql.anilist.co"

_QUERY = """
query ($userName: String, $type: MediaType) {
  MediaListCollection(userName: $userName, type: $type) {
    user {
      mediaListOptions { scoreFormat }
    }
    lists {
      entries {
        score
        status
        media {
          idMal
          id
          title { romaji english }
        }
      }
    }
  }
}
"""

_STATUS_MAP = {
    "anime": {
        "CURRENT": "watching",
        "REPEATING": "watching",
        "PLANNING": "plan_to_watch",
        "COMPLETED": "completed",
        "DROPPED": "dropped",
        "PAUSED": "on_hold",
    },
    "manga": {
        "CURRENT": "reading",
        "REPEATING": "reading",
        "PLANNING": "plan_to_read",
        "COMPLETED": "completed",
        "DROPPED": "dropped",
        "PAUSED": "on_hold",
    },
}


def _normalize_score(raw_score, score_format):
    """AniList users can score on different scales; convert everything to 0-10."""
    if not raw_score:
        return 0.0
    if score_format == "POINT_100":
        return raw_score / 10
    if score_format == "POINT_5":
        return raw_score * 2
    if score_format == "POINT_3":  # smiley scale: 1=bad, 2=ok, 3=good
        return raw_score * (10 / 3)
    return float(raw_score)  # POINT_10 / POINT_10_DECIMAL are already 0-10


def fetch_anilist_list(username, media_type):
    variables = {"userName": username, "type": media_type.upper()}
    resp = requests.post(
        ANILIST_API,
        json={"query": _QUERY, "variables": variables},
        timeout=15,
    )
    if resp.status_code == 404:
        raise ValueError(f"AniList user '{username}' was not found.")
    resp.raise_for_status()

    payload = resp.json()
    if payload.get("errors"):
        msg = payload["errors"][0].get("message", "Unknown AniList error")
        raise ValueError(f"AniList error: {msg}")

    collection = payload["data"]["MediaListCollection"]
    if collection is None:
        raise ValueError(f"AniList user '{username}' was not found.")

    score_format = collection["user"]["mediaListOptions"]["scoreFormat"]
    status_map = _STATUS_MAP[media_type]

    items = []
    for group in collection["lists"]:
        for entry in group["entries"]:
            media = entry["media"]
            title = media["title"]["english"] or media["title"]["romaji"]
            code = status_map.get(entry["status"], "unknown")
            match_id = str(media["idMal"]) if media.get("idMal") else f"anilist-only-{media['id']}"
            items.append({
                "match_id": match_id,
                "title": title,
                "score": _normalize_score(entry["score"], score_format),
                "status": code,
                "status_label": STATUS_LABELS[media_type].get(code, code),
            })

    return items
