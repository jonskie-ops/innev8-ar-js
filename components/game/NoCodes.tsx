import { ClockIcon } from "./icons";

/**
 * No QR codes in the game right now: every location (or every code) is off in the admin. On the map
 * and in the scanner instead of an empty hunt; the codes come back by themselves once one is on.
 */
export function NoCodes() {
  return (
    <div className="nocodes" role="status">
      <ClockIcon />
      <b>No QR codes right now</b>
      <p>The hunt is paused for a moment. Check back soon: the QR codes show up here as soon as it&apos;s on again. What you&apos;ve found is still yours.</p>
    </div>
  );
}
