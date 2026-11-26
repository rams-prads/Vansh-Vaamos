#!/bin/bash
# ---------------------------------------------------------------
#  Vamoss - start the site on this Mac.
#
#  Double-click this file in Finder. Close the window (or press
#  Ctrl+C) to stop the site.
#
#  If double-clicking does nothing, open Terminal in this folder
#  and run this once:
#      chmod +x start.command
# ---------------------------------------------------------------

set -u

# Finder starts scripts in your home folder, so move to this file's folder.
cd "$(dirname "$0")" || exit 1

pause_and_exit() {
    echo
    read -n 1 -s -r -p "  Press any key to close this window..."
    echo
    exit "${1:-0}"
}

echo
echo "  =========================================="
echo "    VAMOSS - starting the local site"
echo "  =========================================="
echo

# --- is Node installed? ---
if ! command -v node >/dev/null 2>&1; then
    echo "  [X] Node.js was not found on this Mac."
    echo
    echo "      The site needs it to run. Install the LTS version from:"
    echo "        https://nodejs.org"
    echo "      then double-click this file again."
    pause_and_exit 1
fi

echo "  Node $(node --version) found."

# --- is the server file here? ---
if [ ! -f "server.js" ]; then
    echo "  [X] server.js is missing from this folder."
    echo "      Make sure start.command sits next to server.js."
    pause_and_exit 1
fi

# --- install dependencies the first time only ---
if [ ! -d "node_modules" ]; then
    echo "  First run - installing dependencies, this takes a moment..."
    echo
    if ! npm install --no-fund --no-audit; then
        echo
        echo "  [X] npm install failed. Scroll up to see why."
        pause_and_exit 1
    fi
    echo
fi

echo "  Shop:   http://localhost:3000"
echo "  Orders: http://localhost:3000/admin.html"
echo
echo "  Press Ctrl+C or close this window to stop the site."
echo

# --- open the browser once the server is up (skip with --no-open) ---
if [ "${1:-}" != "--no-open" ]; then
    ( sleep 2; open "http://localhost:3000" >/dev/null 2>&1 ) &
fi

# --- run the server in this window so you can see what it prints ---
node server.js

# --- if we get here the server stopped ---
echo
echo "  The site has stopped."
echo
echo "  If that was not on purpose, the usual cause is that port 3000"
echo "  is already in use - close the other window and try again."
pause_and_exit 0
