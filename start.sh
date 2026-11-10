#!/bin/bash
# Runs the API on localhost and the website on the public port; if either exits, the
# container exits so the host restarts it.
set -e

cd /app/api
uvicorn main:app --host 127.0.0.1 --port 8010 &

cd /app/web
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" node server.js &

wait -n
exit 1
