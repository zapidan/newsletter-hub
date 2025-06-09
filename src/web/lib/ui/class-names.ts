import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class names and merges Tailwind CSS classes
 * @param inputs - Class names or class name objects
 * @returns A single string of merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Type for style objects that can be used with the `cn` utility
 */
export type StyleObject = Record<string, boolean | undefined>;

/**
 * Creates a style object for conditional class names
 * @param styles - Object mapping class names to conditions
 * @returns Style object with only truthy conditions
 */
export function createStyles<T extends Record<string, boolean | undefined>>(
  styles: T
): StyleObject {
  return Object.fromEntries(
    Object.entries(styles).filter(([_, value]) => value)
  ) as StyleObject;
}
