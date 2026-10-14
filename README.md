# INNEV8-AR-JS

**INNEV8 QR Code Hunt** for the Regional ICT Summit 2026: a Pokémon GO–style game. **Players hunt for
10 virtual INNEV8 QR codes hidden around the venue.** Nothing is printed: each code is invisible until
the phone's camera points at its spot, then it assembles into an animated 3D QR code (the AR part);
tapping it collects it. Collect all 10 to win a prize.

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
| Scanner | Radar and arrows point to the hidden codes | No radar: find them by their clues |

## Deploy

Hosted on Vercel from [github.com/jonskie-ops/innev8-ar-js](https://github.com/jonskie-ops/innev8-ar-js):
every push to `main` redeploys. `.env.production` sets `NEXT_PUBLIC_TEST_MODE=true`, so the live
site is playable now; set it to `false` for the real launch.

## How a catch works

1. Tapping **Scan** opens the AR view (`components/game/ScanView.tsx`, 3D layer in `components/game/ar/`,
   built with [three.js](https://threejs.org)) and hides up to 3 of the player's unfound codes around them.
2. The phone's motion sensors keep the codes fixed in the room as the phone turns (like Pokémon GO's
   AR); without sensors, drag to look. Turning works; walking toward a code doesn't (a phone browser
   can't track position without a reference in the camera image).
3. Each code is invisible until it's held in the scan frame for half a second, then it assembles from
   glowing blocks into a 3D QR code (`ar/qr3d.ts`, its pattern generated from the code's value).
   Tapping it collects it and the catch card opens. Progress is saved on the device (localStorage).

**Placement is a test stand-in:** codes go at random spots around the player each time the scanner
opens. Pinning each code to its real spot at the venue (e.g. image anchors on existing banners and
signs, or GPS for outdoor spots) is still to be decided.

The camera only works on a secure page: `https://…` or `http://localhost`. Over plain
`http://192.168.x.x` the scanner shows a virtual room instead (drag to look). iPhone asks for motion
access when Scan is tapped.

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
| `components/game/ScanView.tsx`, `components/game/ar/` | AR scanner: hidden 3D QR codes over the camera feed |
| `components/game/DexView.tsx`, `QuestsView.tsx`, `MeView.tsx` | Codes (collection), Quests and Me tabs |
| `components/game/CatchCard.tsx`, `PrizeCard.tsx`, `Onboarding.tsx` | Catch result, prize, first run |
| `components/game/QrTile.tsx`, `QrGlyph.tsx` | Floating QR tiles; each code's decorative pattern |
| `lib/hunt.ts` | The 10 QR codes: zones, clues, QR values, map positions, points |
| `lib/venue.ts` | Real building outlines for the map (© OpenStreetMap contributors, ODbL) |
| `components/game/VenueMap.tsx` | 3D holographic venue map |
| `lib/store.ts` | Saved progress |
| `lib/site.ts` | Event dates, `TEST_MODE` |
| `app/globals.css`, `app/game.css` | Styles |
