import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx — prevents conflicts.
 * Usage: cn('px-4 py-2', condition && 'bg-blue-500', 'text-white')
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
