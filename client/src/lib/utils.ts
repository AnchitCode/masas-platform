import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';

/**
 * Merge Tailwind classes with clsx — prevents conflicts.
 * Usage: cn('px-4 py-2', condition && 'bg-blue-500', 'text-white')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extract the user-facing message from any caught error.
 * Prefers Axios response message, falls back to Error.message, then a default.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

/**
 * Type-guard: returns true if err is an Axios error and has a specific HTTP status.
 */
export function isHttpError(err: unknown, status: number): boolean {
  return axios.isAxiosError(err) && err.response?.status === status;
}

/**
 * Type-guard: returns true if err is an Axios cancellation.
 */
export function isCancelledRequest(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (axios.isAxiosError(err) && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError')) return true;
  return false;
}
