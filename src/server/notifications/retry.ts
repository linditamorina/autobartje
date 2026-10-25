export const MAX_ATTEMPTS = 5;

/** Minutes to wait before retry n (1-based): 1, 5, 15, 60. */
export function retryDelayMin(attempt: number): number {
  return [1, 5, 15, 60][Math.min(attempt, 4) - 1] ?? 60;
}
