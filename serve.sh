#!/bin/sh
# Serve HospitalRating on http://localhost:8000 (voice input needs localhost or https, not file://)
cd "$(dirname "$0")" && echo "Open http://localhost:8000 in Chrome or Edge" && python3 -m http.server 8000 --bind 127.0.0.1
