"""
sources/common.py
------------------
Status vocabulary shared by every source. Both mal.py and anilist.py
translate their site's own status codes into these, so the rest of the
app never has to know or care which site an item came from.
"""

STATUS_LABELS = {
    "anime": {
        "watching": "Watching",
        "completed": "Completed",
        "on_hold": "On Hold",
        "dropped": "Dropped",
        "plan_to_watch": "Plan to Watch",
    },
    "manga": {
        "reading": "Reading",
        "completed": "Completed",
        "on_hold": "On Hold",
        "dropped": "Dropped",
        "plan_to_read": "Plan to Read",
    },
}
