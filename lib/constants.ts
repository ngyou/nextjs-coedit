export const CHAR_SOFT_LIMIT = 90_000;
export const CHAR_HARD_LIMIT = 100_000;
export const ID_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ID_MIN_LEN = 5;
export const ID_MAX_LEN = 8;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

// Store a periodic full-text checkpoint every N saved snapshots, while always updating latest text.
export const SNAPSHOT_CHECKPOINT_EVERY_N = parsePositiveInt(
  process.env.NEXT_PUBLIC_SNAPSHOT_CHECKPOINT_EVERY_N,
  20,
);
