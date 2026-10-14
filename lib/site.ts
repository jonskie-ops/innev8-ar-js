/** Summit opens 8:00 AM and wraps 6:00 PM, Philippine time. */
export const EVENT_START = new Date("2026-11-20T08:00:00+08:00");
export const EVENT_END = new Date("2026-11-21T18:00:00+08:00");

export const THEME_COLOR = "#030817";

/**
 * Test mode: the hunt is playable before the event, the countdown moves to the side (HUD chip and
 * the Me tab), and the scanner shows a radar and arrows toward the hidden codes.
 * On in `next dev`; for a production build, set NEXT_PUBLIC_TEST_MODE=true to turn it on.
 * Off in production: the full countdown screen shows until EVENT_START, then the hunt unlocks.
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
export const DESCRIPTION =
  "Hunt the 10 INNEV8 QR codes hidden around the Regional ICT Summit 2026 and collect them all. Nov 20–21, Leyte Academic Center, Palo, Leyte.";

export const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Regional%20ICT%20Summit%202026&dates=20261120/20261122&location=Leyte%20Academic%20Center%2C%20Barangay%20Pawing%2C%20Palo%2C%20Leyte&details=INNEV8%20ICT%20Federation%20presents%20the%20Regional%20ICT%20Summit%202026.%20Bridging%20Industries.%20Building%20Partnerships.%20Creating%20a%20Digital%20Future.";
export const ICS_URL = "/assets/regional-ict-summit-2026.ics";
