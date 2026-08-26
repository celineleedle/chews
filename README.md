# Chews 🍜

**Swipe on restaurants with your crew — the first one everyone loves wins.**

Groups join a room with a share link or a 5-letter code, the host sets the search
area, and everyone swipes through the same deck of nearby restaurants. The moment
every member has liked the same place, the session ends with a match. If the deck
runs out first, you get the group's ranked votes instead.

Built as an npm-workspaces monorepo: a React web app (`web/`), a Fastify server
(`server/`), and a shared protocol package (`shared/`).

## Development

```bash
npm install
npm run dev        # server on :8787, web on :5173
```

Without a Google API key the app serves a built-in mock deck of 25 restaurants, so
the full flow works offline. For real data:

```bash
cp .env.example .env
# set GOOGLE_PLACES_API_KEY=... (enable "Places API (New)" in Google Cloud)
# set MOCK_PLACES=0
```

The same key also draws the detail sheet's location preview — enable **Maps Static
API** on it too. Without that the sheet renders fine, just without the map.

Note the billing tier: the deck search asks for `editorialSummary`, `reviews` and
the `serves*` flags, which puts it in Places' **Enterprise + Atmosphere** SKU. It's
still one search per deck (cached for `PLACES_CACHE_TTL_MIN`), not one call per
restaurant.

### Trying it out

1. Open http://localhost:5173, enter a name, **Start a room**, and allow the
   location prompt.
2. In an incognito window, open the
   room link or enter the code under **I have a code**.
3. Start the session from the host tab and like the same restaurant in both →
   match screen with confetti. If nobody agrees, ranked votes appear once
   everyone finishes the deck.

### Tests

```bash
npm test           # unit + integration tests
npm run typecheck  # all three workspaces
```

## Deploy (Fly.io)

```bash
npm run build && npm start          # local prod smoke test on :8787

fly launch --no-deploy              # first time; keeps the checked-in fly.toml
fly secrets set GOOGLE_PLACES_API_KEY=... MOCK_PLACES=0
fly deploy
```

Rooms live in server memory, so the app must run as exactly **one** machine —
`fly.toml` is already configured for that.

## Config

All configuration is server-side env (see `.env.example`); the web client needs none.

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | HTTP + WS port |
| `GOOGLE_PLACES_API_KEY` | _(empty)_ | Places API (New) + Maps Static key; empty ⇒ mock data |
| `MOCK_PLACES` | `0` | `1` forces the mock deck even with a key |
| `PLACES_CACHE_TTL_MIN` | `45` | search-result cache TTL |
