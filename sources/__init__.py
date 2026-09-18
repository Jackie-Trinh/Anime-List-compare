"""
sources/__init__.py
--------------------
Makes `sources` a package and provides one dispatch function so app.py
doesn't need to know which module handles which source. mal.py and
anilist.py stay fully independent of each other -- neither imports from
the other, only from common.py.
"""

from .mal import fetch_mal_list, MAL_CLIENT_ID
from .anilist import fetch_anilist_list

__all__ = ["fetch_list", "MAL_CLIENT_ID"]


def fetch_list(source, username, media_type):
    if source == "mal":
        return fetch_mal_list(username, media_type)
    if source == "anilist":
        return fetch_anilist_list(username, media_type)
    raise ValueError(f"Unknown source '{source}'")
