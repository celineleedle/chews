# Chews 🍜

**Swipe on restaurants with your crew — the first one everyone loves wins.**

Groups join a room with a share link or a 5-letter code, the host sets the search
area, and everyone swipes through the same deck of nearby restaurants. The moment
every member has liked the same place, the session ends with a match. If the deck
runs out first, you get the group's ranked votes instead.

## Stack

- **`web/`** — Vite + React 19 + TypeScript, Tailwind v4, Framer Motion (`motion`) swipe deck, Zustand store
- **`server/`** — one Fastify 5 process: static hosting, small REST API, WebSockets (`ws`)
- **`shared/`** — the WS protocol: zod schemas + shared types both sides compile against
- Rooms are ephemeral and live in server memory (grace-period reconnects, GC'd on expiry)
- Restaurant data: Google Places Text Search (New) with an in-memory TTL/LRU cache and a
  server-side photo proxy — the API key never reaches the browser
- No database. (Optional accounts + history are planned for future updates.)

## Development

```bash
npm install
npm run dev        # server on :8787, web on :5173 (proxies /api and /ws)
```

Without a Google API key the app serves a built-in mock deck of 25 restaurants, so the
full flow works offline. For real data:

```bash
cp .env.example .env
# set GOOGLE_PLACES_API_KEY=... (enable "Places API (New)" in Google Cloud)
# set MOCK_PLACES=0
```

### Manual multi-user test

1. Open http://localhost:5173, enter a name, **Start a room**.
2. Open an incognito window (it needs its own localStorage), and open
   the room link or enter the code on **I have a code**.
3. Start the session from the host tab; both tabs get the same deck.
4. Like the same restaurant in both → instant match screen with confetti.
5. Also worth checking: refresh mid-swipe (you resume at the same card), close a tab
   (after ~60s the member is dropped and thresholds recompute), join with a wrong code
   (friendly error — no ghost rooms).

### Tests

```bash
npm test           # vitest: match logic, room lifecycle, codes, cache + real-WS integration
npm run typecheck  # all three workspaces
```

## Production / deploy (Fly.io)

The whole app builds into one container (see `Dockerfile`); the server serves the built
client with an SPA fallback so `/room/CODE` deep links work.

```bash
npm run build && npm start          # local prod smoke test on :8787

fly launch --no-deploy              # first time; keeps the checked-in fly.toml
fly secrets set GOOGLE_PLACES_API_KEY=... MOCK_PLACES=0
fly deploy
```

**Important:** room state is in process memory, so the app must run as exactly **one**
machine (`min_machines_running = 1`, autoscaling off — already set in `fly.toml`).

Deploy checklist: `/healthz` returns 200 · two phones can complete a match over WSS ·
`fly scale show` reports 1 machine · the Places key doesn't appear in `web/dist` ·
photos load via `/api/photo` (no direct `googleapis.com` requests in the network tab).

## Config

All configuration is server-side env (`.env.example`); the client derives API/WS URLs
from `window.location` and has zero env vars.

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | HTTP + WS port |
| `GOOGLE_PLACES_API_KEY` | _(empty)_ | Places API (New) key; empty ⇒ mock data |
| `MOCK_PLACES` | `0` | `1` forces the mock deck even with a key |
| `PLACES_CACHE_TTL_MIN` | `45` | search-result cache TTL |
