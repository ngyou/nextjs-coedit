import { CHAR_HARD_LIMIT } from "@/lib/constants";
import type { SaveStatus } from "@/lib/types";

const NOW_AT_LOAD = Date.now();

function saveLabel(status: SaveStatus): string {
  if (status === "saving") return "Saving...";
  if (status === "unsaved") return "Unsaved";
  return "Saved";
}

export function StatusBar({
  charCount,
  saveStatus,
  peerCount,
  updatedAt,
}: {
  charCount: number;
  saveStatus: SaveStatus;
  peerCount: number;
  updatedAt?: string;
}) {
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const daysSinceUpdate = updatedDate
    ? Math.floor((NOW_AT_LOAD - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const expiringSoon = daysSinceUpdate >= 27;

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
      <span>
        {charCount.toLocaleString()} / {CHAR_HARD_LIMIT.toLocaleString()}
      </span>
      <span>{saveLabel(saveStatus)}</span>
      <span>{peerCount} online</span>
      {updatedAt ? (
        <span className={expiringSoon ? "font-semibold text-amber-700" : ""}>
          Last saved {daysSinceUpdate}d ago, expires after 30d inactivity
        </span>
      ) : null}
    </div>
  );
}
