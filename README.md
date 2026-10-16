# INNEV8-AR-JS

**INNEV8 QR Code Hunt** for the Regional ICT Summit 2026: a Pokémon GO–style game. **Players hunt for
virtual INNEV8 QR codes hidden around the venue (a test sample of 8 for now).** Nothing is printed: each code is invisible until
the phone's camera points at its spot, then it assembles into an animated 3D QR code (the AR part);
tapping it collects it. Collect them all to win a prize.

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
2. **Android (Chrome on ARCore phones):** the scanner starts a WebXR AR session, which tracks the
   phone's movement. Codes are ~60 cm panels 2 to 5 m away, fixed in the room: back away and they
   shrink, walk up and they grow. If the browser needs a fresh tap to start AR, a **Start full AR** button
   appears; the phone's back button ends AR and closes the scanner.
   **Everywhere else (iPhone, Android phones without ARCore, in-app browsers like Messenger's):** the
   motion sensors keep the codes fixed in the room as the phone turns (like Pokémon GO's AR; without
   sensors, drag to look), and walking is read from the camera picture (`ar/flow.ts`): as the room
   zooms out when you back away, the codes shrink with it, and they grow as you walk up. Steps to the
   side aren't tracked this way. In test mode, a chip at the top of the scanner says which tracking
   is running.
   All 8 codes sit in a strip along the bottom of the scanner, one selected: the one you came for
   (Find it), else the first still to find. Tap another to look for it instead: its clue shows
   above the strip, and in test mode the radar shows only it (blinking). It's hidden around you
   straight away if it wasn't already; the camera keeps running. Any code you find still counts.
3. The codes are spread out: one near (about 3 m), the others farther off (up to about 9 m; 5 m with
   WebXR), between chest and head height. Until revealed, a code is only a faint "?" outline and a
   shimmer, small from far away and bigger as you walk up. It reveals once you're close enough
   (about 4 m; 2.6 m with WebXR) and hold it in the scan frame for half a second; farther off, the
   hint says "A QR code is about 6 m ahead: walk closer" and Qufoo keeps sniffing. Then it assembles
   from glowing blocks into a 3D QR code (`ar/qr3d.ts`, its pattern generated from the code's value)
   and stays put as you move. Tapping it collects it and the catch card opens. Without a camera
   (walking can't be read) every code is near. Progress is saved on the device (localStorage).

**Placement is a test stand-in:** codes go at random spots around the player each time the scanner
opens. Pinning each code to its real spot at the venue (e.g. image anchors on existing banners and
signs, or GPS for outdoor spots) is still to be decided.

The camera only works on a secure page: `https://…` or `http://localhost`. Over plain
`http://192.168.x.x` the scanner shows a virtual room instead (drag to look). iPhone asks for motion
access when Scan is tapped.

## Qufoo, the mascot

After the splash, Qufoo, the QR hunting buddy (a talking Dalmatian), rises from the bottom of the
screen and talks in a speech bubble (`components/Mascot.tsx`). Each line types out while he talks
and waits for a tap (no timers); Skip or Esc sends him away. He stays away when a QR code link
opens the scanner.

- **New players:** a hello after the splash, then a small Qufoo above the sign-up's Next button
  says what to do on each step (name, province, Let's Go). Then he tours the menu: right after
  sign-up he explains the hunt and the Map, and the first time each menu button is tapped (Codes,
  Quests, Me, Scan) he explains what's there; for Scan, the scanner opens when he's done. Each part
  is explained once (saved with the profile; deleting the profile starts the tour over). Players who
  signed up before the tour existed don't get it.
- **Returning players:** welcome back, and how many codes they've found.
- **Help any time:** a small Qufoo waits above the menu's right end, moving gently; tap him and he
  explains the page you're on. He steps away while the big Qufoo talks, while a QR code's card
  is open on the map, and when you scroll to the end of a page (so he never covers its last
  button); scroll back up and he's there again.
- **In the scanner:** a small Qufoo in the bottom corner sniffs (`sniff.webp`) while you search,
  and talks once a hidden code comes on screen ("I smell a QR code!"), then as you find and collect
  it. Decorative: taps go through him to the AR view.
- **Animation:** `public/assets/img/mascot/talk.webp` is a 2.4 s talking loop cut out of the
  original GIF (36 frames as a sprite sheet, 516 KB instead of the GIF's 10.9 MB), drawn on a
  canvas so he can stop on a closed mouth when he's quiet; `idle.webp` is its first frame.
  `sniff.webp` is a 2 s sniffing loop, cut the same way. To rebuild them from new GIFs on a white
  background: `node scripts/mascot.mjs <talking.gif>` and `node scripts/mascot.mjs <sniffing.gif> sniff`
  (uses `sharp`, which comes with Next.js), then copy the numbers they print into `Mascot.tsx`.
- **Voice:** every Qufoo (the big one, the sign-up guide and the scanner's) says his lines out
  loud, with the words typed as he says them and his mouth moving for as long as the clip plays.
  The clips are MP3s named after the line they say, recorded into `Qufoo voice lines/` (not
  committed); `node scripts/voice.mjs` copies them to `public/assets/audio/qufoo/` and writes
  `lib/voice-clips.json`, and each line finds its clip by its words (`lib/voice.ts`: letters and
  numbers only, so punctuation a file name can't hold doesn't matter). Run it again after adding
  or re-recording clips. A clip can't say the player's name, so those lines carry `say`: the words
  of their clip (e.g. "Welcome back!" for "Welcome back, Joshua!"). In the scanner, "Sniff Sound" loops
  while he sniffs, in step with his sniffing (its first 2 s match the 2 s sniff loop; each frame
  is picked from where the sound is), and stops when he speaks up ("I smell a QR code!"). A line
  with no clip stays text only.
  Phones block sound until the page is tapped, so his hello after the splash waits with "Tap to
  hear Qufoo" and that tap starts it. The first tap also readies the one audio element he speaks
  through, so the scanner's lines (which come on their own) can play later.

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
| `components/Mascot.tsx`, `scripts/mascot.mjs` | The talking mascot after the splash; the script that builds its sprite |
| `lib/voice.ts`, `lib/voice-clips.json`, `scripts/voice.mjs` | Qufoo's voice clips and the script that adds them |
| `components/CountdownSection.tsx`, `Countdown.tsx` | "The countdown is on." section and clock |
| `components/game/Game.tsx` | Game shell: HUD, tabs, overlays |
| `components/game/MapView.tsx` | Venue map (home) |
| `components/game/ScanView.tsx`, `components/game/ar/` | AR scanner: hidden 3D QR codes over the camera feed |
| `components/game/DexView.tsx`, `QuestsView.tsx`, `MeView.tsx` | Codes (collection), Quests and Me tabs |
| `components/game/CatchCard.tsx`, `PrizeCard.tsx`, `Onboarding.tsx` | Catch result, prize, first run |
| `components/game/QrTile.tsx`, `QrGlyph.tsx` | Floating QR tiles; each code's decorative pattern |
| `lib/hunt.ts` | The QR codes (8-code test sample): zones, clues, values, map positions, points |
| `lib/venue.ts` | Real building outlines for the map (© OpenStreetMap contributors, ODbL) |
| `components/game/VenueMap.tsx` | 3D holographic venue map |
| `lib/store.ts` | Saved progress |
| `lib/site.ts` | Event dates, `TEST_MODE` |
| `app/globals.css`, `app/game.css` | Styles |
