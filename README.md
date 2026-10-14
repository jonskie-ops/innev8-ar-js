# INNEV8-AR-JS

**INNEV8 QR Code Hunt** for the Regional ICT Summit 2026: a Pokémon GO–style game. **Players hunt for
INNEV8 QR codes hidden around the venue.** Scanning one in the app pops a glowing holographic copy of
the code up over it (the AR part); tapping it collects the code. Collect all 10 to win a prize.

## Run

```bash
npm install
npm run dev          # http://localhost:3200 (test mode)
npm run dev:https    # same, over HTTPS so phone cameras work (self-signed certificate)
npm run build && npm start   # production behaviour on :3200
```

To open the dev server from another device, its origin must be in `allowedDevOrigins` in
`next.config.ts` (currently `192.168.1.88`).

## Test mode vs production

| | Test mode (`next dev`, or `NEXT_PUBLIC_TEST_MODE=true`) | Production |
| --- | --- | --- |
| Before Nov 20, 8:00 AM | Hunt is playable. "The countdown is on." sits on the side: HUD timer chip and the Me tab | "The countdown is on." fills the screen; the hunt is locked |
| From Nov 20, 8:00 AM | Hunt | Hunt (unlocks automatically) |
| `/markers` (printable hunt QR codes) | Available (open the address directly) | 404 |

## Deploy

Hosted on Vercel from [github.com/jonskie-ops/innev8-ar-js](https://github.com/jonskie-ops/innev8-ar-js):
every push to `main` redeploys. `.env.production` sets `NEXT_PUBLIC_TEST_MODE=true`, so the live
site is playable now; set it to `false` for the real launch.

## How a catch works

1. Each of the 10 stations has its own QR code, holding `<site>/?s=<code>` (codes live in `lib/hunt.ts`).
2. The in-game scanner (`components/game/ScanView.tsx`) reads the rear camera with
   [jsQR](https://github.com/cozmo/jsQR), and pins a holographic copy of the code on top of it in the camera view.
3. Scanning the same QR with the phone's normal camera app opens the site straight into that encounter.
4. Progress is saved on the device (localStorage).

The camera only works on a secure page: `https://…` or `http://localhost`. Over plain
`http://192.168.x.x` the scanner opens without a camera feed; deep links from the phone's own camera
app still work.

## Before the event

- **Venue map:** the building outlines are real (Leyte Convention Complex, Annex A, the east
  driveway and parking, from OpenStreetMap, in `lib/venue.ts`). The rooms drawn inside them, the QR
  spots and the clues in `lib/hunt.ts` are placeholders until the event floor plan is final.
- **Prize checks need a server.** Progress and the prize claim code live only on the player's phone,
  so they can't be verified yet.
- **QR code values ship in the app's JavaScript**, so a determined player could find them. Server-side
  validation fixes this too.

## Where things live

| File | What it is |
| --- | --- |
| `components/App.tsx` | Countdown gate (production) vs. game |
| `components/Splash.tsx`, `Emblem.tsx` | INNEV8 splash screen |
| `components/CountdownSection.tsx`, `Countdown.tsx` | "The countdown is on." section and clock |
| `components/game/Game.tsx` | Game shell: HUD, tabs, overlays |
| `components/game/MapView.tsx` | Venue map (home) |
| `components/game/ScanView.tsx` | AR camera scanner |
| `components/game/DexView.tsx`, `QuestsView.tsx`, `MeView.tsx` | Codes (collection), Quests and Me tabs |
| `components/game/CatchCard.tsx`, `PrizeCard.tsx`, `Onboarding.tsx` | Catch result, prize, first run |
| `components/game/QrTile.tsx`, `QrGlyph.tsx` | Floating QR tiles; each code's decorative pattern |
| `lib/hunt.ts` | The 10 QR codes: zones, clues, QR values, map positions, points |
| `lib/venue.ts` | Real building outlines for the map (© OpenStreetMap contributors, ODbL) |
| `components/game/VenueMap.tsx` | 3D holographic venue map |
| `lib/store.ts` | Saved progress |
| `lib/site.ts` | Event dates, `TEST_MODE` |
| `app/markers/page.tsx` | Printable hunt QR codes (test mode only) |
| `app/showcase/page.tsx`, `components/showcase/` | AR test (test mode only): virtual 3D QR codes hidden at fixed spots around you, revealed when the camera points at them ([three.js](https://threejs.org)) |
| `app/globals.css`, `app/game.css` | Styles |
