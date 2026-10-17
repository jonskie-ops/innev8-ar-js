/** Summit opens 8:00 AM and wraps 6:00 PM, Philippine time (until the admin's dates come in). */
export const EVENT_START = new Date("2026-11-20T08:00:00+08:00");
export const EVENT_END = new Date("2026-11-21T18:00:00+08:00");

export const THEME_COLOR = "#030817";

/**
 * Test mode: the hunt is playable before the event, the countdown moves to the side (HUD chip and
 * the Me tab), and the scanner shows a radar and arrows toward the hidden codes, and which movement
 * tracking it's using.
 * The organisers switch it on the admin's Event page; this (and the dates above) is only what the
 * game starts with before it has heard from the admin: on in `next dev`, and in a production build
 * with NEXT_PUBLIC_TEST_MODE=true.
 */
export const TEST_MODE = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_MODE === "true";

/** Eastern Visayas (Region VIII) provinces, plus an option for visitors from other regions. */
export const PROVINCES = [
  "Biliran",
  "Eastern Samar",
  "Leyte",
  "Northern Samar",
  "Samar",
  "Southern Leyte",
  "Outside Eastern Visayas",
] as const;

export const TITLE = "INNEV8 QR Code Hunt · Regional ICT Summit 2026";
/** The installed app's name, and the short one under its home-screen icon. */
export const APP_NAME = "INNEV8 QR Code Hunt";
export const APP_SHORT_NAME = "QR Hunt";
export const DESCRIPTION =
  "Hunt the INNEV8 QR codes hidden around the Regional ICT Summit 2026 and collect them all. Nov 20–21, Leyte Academic Center, Palo, Leyte.";

export const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Regional%20ICT%20Summit%202026&dates=20261120/20261122&location=Leyte%20Academic%20Center%2C%20Barangay%20Pawing%2C%20Palo%2C%20Leyte&details=INNEV8%20ICT%20Federation%20presents%20the%20Regional%20ICT%20Summit%202026.%20Bridging%20Industries.%20Building%20Partnerships.%20Creating%20a%20Digital%20Future.";
export const ICS_URL = "/assets/regional-ict-summit-2026.ics";
