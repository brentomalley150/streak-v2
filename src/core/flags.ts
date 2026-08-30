/**
 * Build-time feature flags.
 *
 * BILLING_ENABLED is off while the app is being built and tested: nothing
 * should ask anyone for money, or imply a limit we are not enforcing, before
 * there is anything to sell.
 *
 * Off means every track is enrollable and no paid copy renders anywhere. The
 * entitlement field, canEnroll(), and FR7's one-track rule are all still here
 * and still tested — this gates the *enforcement and the copy*, not the model,
 * so turning it back on is a one-line change rather than a rebuild.
 *
 * To re-enable: set VITE_BILLING=1 at build time, or flip the default below.
 */
export const BILLING_ENABLED =
  (import.meta.env['VITE_BILLING'] ?? '') === '1';
