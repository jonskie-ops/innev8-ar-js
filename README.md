# INNEV8-AR-JS

**INNEV8 QR Code Hunt** for the Regional ICT Summit 2026: a Pokémon GO–style game. **Players hunt for
virtual INNEV8 QR codes hidden around the venue (a test sample of 8 for now).** Nothing is printed: each code is invisible until
the phone's camera points at its spot, then it assembles into an animated 3D QR code (the AR part);
tapping it collects it, and collecting them wins the prizes the organisers set.

**The organisers set the hunt in the admin** ([INNEV8-AR-ADMIN](../INNEV8-AR-ADMIN)): the QR codes
(names, clues, spots, map pins, rarity, points, on or off), the zones, the prizes, the event dates,
test mode and the prize desk. Both use the same Supabase database: the admin saves to it, and the
game reads it (see "Where the hunt comes from" below).

## Run

```bash
npm install
npm run dev          # http://localhost:3200 (test mode)
npm run dev:https    # same, over HTTPS so phone cameras work (self-signed certificate)
npm run build && npm start   # production behaviour on :3200
```

To open the dev server from another device, its origin must be in `allowedDevOrigins` in
`next.config.ts` (currently `192.168.1.88`).

## Where the hunt comes from

- **`/api/hunt`** (`lib/hunt-server.ts`) reads the codes and prizes that are on, the zones and the
  event settings from the admin's database, with its **public** key: the database only lets that key
  see what players may see. It keeps the answer for 30 seconds and refreshes it in the background,
  so the database is asked about twice a minute however many phones are playing.
- **The phone** (`lib/huntStore.ts`) asks when the game opens, when it comes back to the front, when
  the signal returns and every minute while it's open, and keeps the latest copy for offline. A
  change saved in the admin shows up within about a minute.
- **Codes turned off after a player found them** stay in their collection and keep counting toward
  their points and prizes.
- **Not set up, or no answer:** the phone keeps what it has. A phone that has never heard from the
  admin plays the built-in 8-code sample in `lib/hunt.ts`.
- **Settings:** `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the admin's project URL and public
  key; never the secret key), in `.env.local` here and under Vercel → Settings → Environment
  Variables for the live site.

## Test mode vs production

Test mode is the switch on the admin's Event page.

| | Test mode | Production |
| --- | --- | --- |
| Before Nov 20, 8:00 AM | Hunt is playable. "The countdown is on." sits on the side: HUD timer chip and the Me tab | "The countdown is on." fills the screen; the hunt is locked |
| From Nov 20, 8:00 AM | Hunt | Hunt (unlocks automatically) |
| Scanner | Radar and arrows point to the hidden codes; chips show the tracking and the GPS accuracy | No radar: find them by their clues and the distance meter |

## Deploy

Hosted on Vercel from [github.com/jonskie-ops/innev8-ar-js](https://github.com/jonskie-ops/innev8-ar-js):
every push to `main` redeploys. Test mode, the dates and everything else in the hunt are set in the
admin; `.env.production`'s `NEXT_PUBLIC_TEST_MODE` is only what a phone starts with before it has heard
from it.

## How a catch works

1. Tapping **Scan** opens the AR view (`components/game/ScanView.tsx`, 3D layer in `components/game/ar/`,
   built with [three.js](https://threejs.org)). Each code still to find shows once the player is within
   its distance of its spot (see "Where the codes are" below); with random spots, up to 3 are hidden
   around them.
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
4. Opening the scanner with every code already found shows the **Hunt complete** pop-up
   (`AllFoundCard.tsx`): their points, and the way to their collection and prizes, or to close it.

## Where the codes are (GPS)

Each code has a real spot on the ground: its GPS spot, set in the admin (best on site, from an
organiser's phone), or else where its pin is on the venue map (traced from OpenStreetMap, so it has
coordinates; `lib/geo.ts`). The scanner shows a code only once the player is within its distance of
that spot: 10 m unless the organisers set more (indoors, where GPS is rougher).

- **Where the player is:** `lib/location.ts` follows the phone's GPS while the scanner (or the map's
  "you are here") is open, and smooths it: each reading counts by how sure the phone is, the estimate
  allows for walking pace, a bad reading (worse than 60 m) is skipped, and a sure jump of more than
  25 m starts again from there (back in the app after a walk). A code comes in range at its
  distance and stays in until a little past it (5 m, or half its distance), so it doesn't flicker.
- **The distance meter** at the top of the scanner: the code headed for (the one chosen in the strip,
  or Find it; else the nearest), how far, and a bar that fills as you get close. Once the compass is
  known an arrow points to it. In range it says **Here!** and the phone buzzes; Qufoo speaks up. The
  strip shows every code's distance.
- **North:** the 3D view turns with the motion sensors, which don't know north. The compass gives it:
  Android's `deviceorientationabsolute`, iPhone's `webkitCompassHeading` (after the motion permission
  asked at Scan), compared with the view's own heading and smoothed (`ar/stage.ts`). With WebXR, north
  carries over into the AR session's frame as it starts.
- **Placing a code in range:** in its direction from the player (somewhere ahead until north is
  known, then moved), at about its GPS distance kept to what the view can show (3–9 m; 2–8 m with
  WebXR), and then it stays put. It's moved only if the GPS and the view disagree a lot about where it
  is while it's off screen. Phone GPS is good to a few metres, so up close a code is where the player
  is looking around, not to the metre: the meter shows a pulse, not an arrow, once in range.
- **The map:** the player's dot with a ring for how sure the GPS is (on by itself once the site is
  allowed the location; the button by the zoom) with a cone for which way they're facing (the compass,
`lib/heading.ts`: the back camera held up, the top of the phone lying flat), each code's range ring when selected, and its
  distance on its card.

**Locations:** the hunt can be played somewhere other than Leyte Academic Center. The organisers add
locations on the admin's Locations page, and each code is at one; the hunt (`places` in `/api/hunt`)
has every location that's on, and only their codes. Leyte Academic Center's map is drawn by hand
(`lib/venue.ts`) until the admin draws it from OpenStreetMap (`hand` on its place); any other's comes from OpenStreetMap's buildings, roads and grounds around it,
drawn by the admin into the same plan units (`planOf` in `lib/geo.ts`: north up, its middle at
(180, 260), its width across 300 units) and shown in the same holographic style. With more than
one location on, chips above the map switch between them; the map opens on the player's nearest
(or a picked code's). Before the admin's locations update, `places` is null: Leyte Academic Center
only, as before. With every location off (or no code on), the map and the scanner say there are no QR codes
right now (`NoCodes`), and the codes come back by themselves once one is on. The codes are listed
location by location, then by number (`inOrder`): each location's numbers start at 1.

**Random spots** (the admin's Event page) is for trying the scanner away from the venue: a few codes
go at random spots around the player each time the scanner opens, as before. In test mode, if the
phone can't give its location, the scanner offers it too. The location, like the camera, only works on
a secure page.

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
  is explained once (saved with the profile). Players who
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
- **Sponsors:** every QR code can carry a sponsor's logo in a circle on its top-right corner (the
  tiles everywhere, and the 3D code in the camera). The organisers keep the sponsors on the admin's
  Sponsors page (name and logo; the admin makes the round badge) and choose each code's; they come
  with the hunt (`sponsors` in `/api/hunt`). An uploaded badge is served at the game's own address,
  `/assets/sponsors/up/<file>` (`app/assets/sponsors/up/[file]/route.ts`, from the admin's
  "sponsors" storage bucket), so the phone keeps it with the other pictures and the 3D code can
  draw it. The first 8 sponsors' badges came with the game: `node scripts/sponsors.mjs` made them
  from the logos in `QR Sponsor/` (not committed) into `public/assets/sponsors/` and
  `lib/sponsors.json`, and they're used until the admin has its sponsor logos update (and for
  those still on their first badge); before the admin's sponsors update, code #n gets the nth.

## The app (PWA)

The game installs to the home screen and opens like an app ("QR Hunt"), full screen.

- **Installing:** `app/manifest.ts` (name, colours, icons) and, for iPhone, `appleWebApp` in
  `app/layout.tsx`. The icons in `public/assets/img/app/` come from the INNEV8 icon:
  `node scripts/app-icons.mjs` (the maskable ones fill the square for Android's icon shapes).
  Installing is the browser's own (its install offer or menu; Share then Add to Home Screen on
  iPhone). On iPhone the installed app keeps its own data, apart from Safari's.
- **Weak or no signal:** `public/sw.js`, a service worker started by `lib/pwa.ts` (production
  builds on a secure page only: not in `next dev`, not over `http://192.168.x.x`). It keeps the
  page, the app's code, pictures, fonts, sprites and all of Qufoo's clips on the phone (~5 MB),
  so the game opens and plays offline, scanner and voice included. The page comes from the
  network when it answers within 3.5 s, else from the phone.
- **Updates:** a push reaches an installed app the next time it's opened online. If the phone
  had to open its kept copy (slow signal) and a newer one then comes in, "A new version is ready"
  offers to reload (`components/AppUpdate.tsx`). Re-recorded clips come through on their own.

## Before the event

- **Venue map:** the building outlines are real (Leyte Convention Complex, Annex A, the east
  driveway and parking, from OpenStreetMap, in `lib/venue.ts`). The rooms drawn inside them, and the
  QR spots and clues (set in the admin), are placeholders until the event floor plan is final.
- **Prizes are checked by the database.** Each code a player collects is sent to it (queued on the
  phone without a signal, and sent when there is one), with where the phone was: it counts only if
  the phone was near the code. The prize card's claim code (a QR, and `XXXX-XXXX`) comes from the
  database, and the admin's Prize desk gives each prize once (see the admin's README, "Prize desk").
  The player's progress screen still comes from the phone. A prize can be for one chosen code
  (`rule: "code"`, with `code` and the organisers' sentence in `text`): finding it wins it.
  A prize photo is shown as the admin set it: filling its box or whole, and zoomed (`photoFit`,
  `photoZoom`; `photoStyle` in `lib/hunt.ts`).
- **QR code values ship in the app's JavaScript**, so a determined player could find them. Server-side
  validation fixes this too.

## Where things live

| File | What it is |
| --- | --- |
| `components/App.tsx` | Countdown gate (production) vs. game |
| `components/Splash.tsx`, `Emblem.tsx` | INNEV8 splash screen |
| `components/Mascot.tsx`, `scripts/mascot.mjs` | The talking mascot after the splash; the script that builds its sprite |
| `lib/voice.ts`, `lib/voice-clips.json`, `scripts/voice.mjs` | Qufoo's voice clips and the script that adds them |
| `lib/sponsors.ts`, `lib/sponsors.json`, `scripts/sponsors.mjs` | The QR codes' sponsors (the organisers', or the 8 the game came with) and the script that made the first badges |
| `app/assets/sponsors/up/[file]/route.ts` | A sponsor badge uploaded in the admin, at the game's own address |
| `app/manifest.ts`, `public/sw.js`, `lib/pwa.ts`, `components/AppUpdate.tsx`, `scripts/app-icons.mjs` | The installable app: manifest, offline service worker, update banner, icons |
| `components/CountdownSection.tsx`, `Countdown.tsx` | "The countdown is on." section and clock |
| `components/game/Game.tsx` | Game shell: HUD, tabs, overlays |
| `components/game/MapView.tsx` | Venue map (home) |
| `components/game/ScanView.tsx`, `components/game/ar/` | AR scanner: hidden 3D QR codes over the camera feed |
| `components/game/DexView.tsx`, `QuestsView.tsx`, `MeView.tsx` | Codes (collection), Quests and Me tabs |
| `components/game/CatchCard.tsx`, `PrizeCard.tsx`, `Onboarding.tsx` | Catch result, prize, first run |
| `components/game/QrTile.tsx`, `QrGlyph.tsx` | Floating QR tiles; each code's decorative pattern |
| `lib/hunt.ts` | The hunt's types, standings and prize rules, and the built-in 8-code sample |
| `app/api/hunt/route.ts`, `lib/hunt-server.ts` | The hunt from the admin's database, kept 30 seconds |
| `lib/huntStore.ts` | The hunt on the phone: checked for changes, kept for offline |
| `lib/venue.ts` | Real building outlines for the map (© OpenStreetMap contributors, ODbL) |
| `components/game/VenueMap.tsx` | 3D holographic map of a location: Leyte Academic Center by hand, any other from OpenStreetMap |
| `lib/store.ts` | Saved progress |
| `lib/site.ts` | The dates and test mode the game starts with (the admin's replace them) |
| `lib/geo.ts` | Each location's plan ↔ latitude/longitude (the admin's `lib/venue.ts` has the same numbers), distance and direction |
| `lib/location.ts` | The player's GPS, smoothed and shared by the scanner and the map |
| `app/globals.css`, `app/game.css` | Styles |
