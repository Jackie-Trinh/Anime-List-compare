"""
desktop.py
----------
Entry point for running the app as a desktop window instead of "open your
browser to localhost:5000". This is the file PyInstaller packages.

It starts the Flask server on a background thread, then opens a native
window (via pywebview) pointing at it -- so from the user's point of view
it's just an app icon that opens a window, no terminal involved.
"""

import threading
import webview

from app import app, get_data_path


def run_server():
    # use_reloader=False is required: the reloader tries to re-launch the
    # process, which breaks when running inside a packaged executable.
    app.run(host="127.0.0.1", port=5000, threaded=True, use_reloader=False)


if __name__ == "__main__":
    get_data_path()  # make sure ./data exists next to the executable before we start

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    webview.create_window(
        "List Compare",
        "http://127.0.0.1:5000",
        width=1150,
        height=780,
        min_size=(800, 600),
    )
    webview.start()
