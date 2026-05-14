# Dart Kiosk

Two-app setup for a Raspberry Pi ad kiosk:

- `webapp`: React + Mantine web interface with APIs for uploading, editing, and scheduling ads.
- `kiosk`: Electron fullscreen player for Raspberry Pi that polls the webapp playlist and plays ads like a media player.

## Webapp

```bash
cd webapp
npm install
npm run dev
```

The web interface runs at `http://localhost:5173`. The API runs at `http://localhost:4173` and stores uploaded ads in `webapp/storage`.

## Vercel deployment

Deploy the repository root as the Vercel project root. The root `vercel.json` installs and builds the `webapp` directory, serves `webapp/dist`, and exposes root `/api/*` serverless functions that call the webapp API code.

Production URL:

- Web UI: `https://media.safety-linq.com`
- API base: `https://media.safety-linq.com`
- Playlist endpoint: `https://media.safety-linq.com/api/playlist`

1. Create a Vercel Blob store in the Vercel project.
2. Make sure Vercel adds `BLOB_READ_WRITE_TOKEN` to the project environment.
3. Add `media.safety-linq.com` as the production domain in the Vercel project.
4. Deploy with:

```bash
vercel
```

In Vercel, the API routes live under `/api/*` and image/playlist data is stored in Vercel Blob. Local development uses `webapp/storage` when `BLOB_READ_WRITE_TOKEN` is not set.

## Kiosk

```bash
cd kiosk
npm install
KIOSK_API_URL=http://localhost:4173 npm start
```

On the Raspberry Pi, point `KIOSK_API_URL` at the webapp server on your network, for example:

```bash
KIOSK_API_URL=http://192.168.1.50:4173 npm start
```

For a deployed Vercel webapp, use the production URL:

```bash
KIOSK_API_URL=https://media.safety-linq.com npm start
```

The kiosk defaults to `https://media.safety-linq.com` when `KIOSK_API_URL` is not set. Use `KIOSK_API_URL=http://localhost:4173` for local API testing.

The kiosk opens fullscreen and loops through the playlist returned by `/api/playlist`.

### Raspberry Pi autostart

Install the kiosk as a user-level systemd service from the repo on the Pi:

```bash
cd /path/to/dart-kiosk/kiosk
chmod +x scripts/install-autostart.sh
KIOSK_API_URL=https://media.safety-linq.com ./scripts/install-autostart.sh
```

The installer writes `~/.config/systemd/user/dart-kiosk.service`, runs `npm install`, enables the service, and starts it immediately.

Useful commands:

```bash
systemctl --user status dart-kiosk.service
journalctl --user -u dart-kiosk.service -f
systemctl --user restart dart-kiosk.service
systemctl --user disable --now dart-kiosk.service
```

This service starts with the Pi user's graphical session. Make sure the Pi is configured to auto-login to the desktop session if you want the kiosk to appear after a reboot without manual login.

Keyboard controls:

- `Ctrl+W` closes the kiosk.
- `Ctrl+Q` closes the kiosk.
- `D` toggles the hidden debug overlay.
