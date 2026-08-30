/**
 * The parent PIN.
 *
 * Threat model, stated plainly: this keeps a 10-year-old out of the screens
 * where money and destructive actions live. It is NOT security. The hash is a
 * djb2 string hash carried over from v1 — reversible by anyone who wants to,
 * and stored in localStorage next to everything it protects. Do not describe
 * it as protecting anything from an adult with the device.
 *
 * The algorithm is byte-for-byte v1's `hashPin`, deliberately: a migrated
 * family's existing PIN has to keep working, and a silent mismatch would lock
 * a parent out of their own settings with no error state to explain it.
 */

/** v1's hash, unchanged. `h_<base36>_<length>`. */
export function hashPin(pin: string): string {
  if (!pin) return '';
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h) + pin.charCodeAt(i);
  return `h_${Math.abs(h).toString(36)}_${pin.length}`;
}

/** v1 required 4+ digits. Same rule, so a v1 PIN stays valid. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,}$/.test(pin);
}

/**
 * True only when `pin` matches `stored`. An empty stored hash means no PIN was
 * ever set, which must never verify — otherwise a family with no PIN would let
 * any input through the gate.
 */
export function verifyPin(pin: string, stored: string): boolean {
  if (!stored || !pin) return false;
  return hashPin(pin) === stored;
}
