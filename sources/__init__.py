"""
sources/__init__.py
--------------------
Makes `sources` a package and provides one dispatch function so app.py
doesn't need to know which module handles which source. mal.py and
anilist.py stay fully independent of each other -- neither imports from
the other, only from common.py.
"""

from .mal import fetch_mal_list, fetch_mal_details, MAL_CLIENT_ID
from .anilist import fetch_anilist_list, fetch_anilist_details

__all__ = ["fetch_list", "fetch_details", "MAL_CLIENT_ID"]


def fetch_list(source, username, media_type):
    if source == "mal":
        return fetch_mal_list(username, media_type)
    if source == "anilist":
        return fetch_anilist_list(username, media_type)
    raise ValueError(f"Unknown source '{source}'")


def fetch_details(media_type, mal_id=None, anilist_id=None):
    """
    Fetch one title's info from BOTH sites (whichever ids we have) and
    merge them into a single response for the click-to-see-details popup.
    Either side is allowed to fail independently -- e.g. a title might be
    on AniList but not (yet) have a MAL id -- so each side's error, if any,
    is reported separately rather than failing the whole request.
    """
    mal_info, mal_error = None, None
    if mal_id:
        try:
            mal_info = fetch_mal_details(mal_id, media_type)
        except Exception as e:
            mal_error = str(e)

    anilist_info, anilist_error = None, None
    try:
        # If we don't have a native anilist_id, fall back to looking it up
        # by mal_id -- AniList's `idMal` filter supports that directly.
        anilist_info = fetch_anilist_details(
            media_type,
            anilist_id=anilist_id,
            mal_id=None if anilist_id else mal_id,
        )
    except Exception as e:
        anilist_error = str(e)

    if mal_info is None and anilist_info is None:
        raise ValueError(mal_error or anilist_error or "No details found for this title.")

    title = (mal_info or {}).get("title") or (anilist_info or {}).get("title") or "Unknown title"
    summary = (mal_info or {}).get("synopsis") or (anilist_info or {}).get("description") or ""
    genres = (mal_info or {}).get("genres") or (anilist_info or {}).get("genres") or []
    mal_url = (mal_info or {}).get("url")
    if not mal_url and mal_id:
        endpoint = "anime" if media_type == "anime" else "manga"
        mal_url = f"https://myanimelist.net/{endpoint}/{mal_id}"

    return {
        "title": title,
        "summary": summary,
        "genres": genres,
        "mal": {
            "score": (mal_info or {}).get("score"),
            "url": mal_url,
            "error": mal_error,
        },
        "anilist": {
            "score": (anilist_info or {}).get("score"),
            "url": (anilist_info or {}).get("url"),
            "error": anilist_error,
        },
    }
