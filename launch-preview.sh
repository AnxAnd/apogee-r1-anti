#!/usr/bin/env bash
# Apogee R1 Anti - Smart Local Preview Server
# Automatically selects a free port (defaults to checking 8181, 8090, 8888, 3333)

REQUESTED_PORT="$1"

PORT=$(python3 -c "
import socket, sys

requested = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
preferred = [int(requested)] if requested else [8181, 8090, 8888, 3333, 9090]

selected = None
for p in preferred:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', p))
            selected = p
            break
    except OSError:
        continue

if not selected:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        selected = s.getsockname()[1]

print(selected)
" "$REQUESTED_PORT")

echo "=========================================================="
echo "  🚀 Apogee R1 Anti — Local Preview Server"
echo "  🌐 URL: http://localhost:${PORT}"
echo "----------------------------------------------------------"
echo "  Controls:"
echo "    • Mouse Wheel / Up & Down Arrows : Spin Orbital Arcs"
echo "    • 'P' Key or Spacebar            : PTT Side Button"
echo "    • Touch / Mouse Drag             : Pan Arcs"
echo "    • Tap Satellites                 : Open Action Sheet"
echo "=========================================================="

python3 -m http.server "$PORT"
