import { ClockIcon } from "./icons";

/**
 * No QR codes in the game right now: every location (or every code) is off in the admin. On the map
 * and in the scanner (over them), and on the Codes and Quests tabs (`inline`, in place of their
 * lists); it all comes back by itself once one is on.
 */
export function NoCodes({
  title = "No QR codes right now",
  inline = false,
  children = "The hunt is paused for a moment. Check back soon: the QR codes show up here as soon as it's on again. What you've found is still yours.",
}: {
  title?: string;
  inline?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={inline ? "nocodes nocodes--inline" : "nocodes"} role="status">
      <ClockIcon />
      <b>{title}</b>
      <p>{children}</p>
    </div>
  );
}
