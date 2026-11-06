/**
 * The game's requests give up after a while, so a stalled one on weak venue Wi-Fi fails (and the
 * game says "no signal" and offers to try again) instead of keeping everything after it waiting.
 * AbortController with a timer, not AbortSignal.timeout(), which older iPhones (before iOS 16) lack.
 */
export const REQUEST_MS = 8000;

/**
 * Runs `work` (a fetch and the reading of its answer, both given `signal`) and stops it after `ms`:
 * a stalled request, or an answer that stops coming halfway, then throws like a lost signal.
 */
export async function within<T>(work: (signal: AbortSignal) => Promise<T>, ms = REQUEST_MS): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await work(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}
