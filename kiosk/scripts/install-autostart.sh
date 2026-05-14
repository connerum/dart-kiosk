#!/usr/bin/env bash
set -euo pipefail

API_URL="${KIOSK_API_URL:-https://media.safety-linq.com}"
KIOSK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_PATH="${SERVICE_DIR}/dart-kiosk.service"
TEMPLATE_PATH="${KIOSK_DIR}/systemd/dart-kiosk.service"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before installing the kiosk service." >&2
  exit 1
fi

mkdir -p "${SERVICE_DIR}"

sed \
  -e "s#__KIOSK_DIR__#${KIOSK_DIR}#g" \
  -e "s#KIOSK_API_URL=https://media.safety-linq.com#KIOSK_API_URL=${API_URL}#g" \
  "${TEMPLATE_PATH}" > "${SERVICE_PATH}"

cd "${KIOSK_DIR}"
npm install

systemctl --user daemon-reload
systemctl --user enable dart-kiosk.service
systemctl --user restart dart-kiosk.service

cat <<EOF
Dart Kiosk autostart installed.

Service: ${SERVICE_PATH}
API URL: ${API_URL}

Useful commands:
  systemctl --user status dart-kiosk.service
  journalctl --user -u dart-kiosk.service -f
  systemctl --user restart dart-kiosk.service
  systemctl --user disable --now dart-kiosk.service

The kiosk starts when this user's graphical session starts.
EOF

