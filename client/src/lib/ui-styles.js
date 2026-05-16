/**
 * Shared Tailwind class fragments for UI primitives.
 * Uses only MASAS semantic tokens (no arbitrary hex).
 */

export const transitionControl =
  'transition-[color,background-color,border-color,box-shadow] duration-150 ease-out';

/** Inset focus ring for text fields (matches doc: visible, calm). */
export const focusRingControl =
  'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary';

export const focusRingControlError = 'focus:ring-danger';

/** Button / icon-button style focus (offset sits on app background). */
export const focusRingAction =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export const focusRingDanger =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export const focusRingIntelligence =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export const surfaceCard = 'rounded-2xl border border-border bg-surface shadow-sm';

export const controlShell = [
  'block w-full min-w-0 rounded-lg border-0 bg-surface py-2 text-sm text-text leading-6',
  'shadow-sm ring-1 ring-inset ring-border',
  'placeholder:text-text-muted',
  transitionControl,
  focusRingControl,
  'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-text-muted disabled:ring-border/60',
].join(' ');

export const controlError = 'ring-danger focus:ring-danger';
