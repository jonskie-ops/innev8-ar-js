/**
 * iPhone only lets a page read the motion sensors after asking, and only from inside a tap.
 * Call this in the tap that opens the scanner; elsewhere it does nothing.
 */
export function askMotion() {
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
  DOE?.requestPermission?.().catch(() => {});
}
