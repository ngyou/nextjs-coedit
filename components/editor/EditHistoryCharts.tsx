"use client";

import { useMemo } from "react";

import type { SnapshotHistoryItem } from "@/lib/types";

type EditPoint = {
  ts: number;
  charCount: number;
};

type Props = {
  snapshots: SnapshotHistoryItem[];
  localEdits: EditPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
  label: string;
};

function buildPoints(
  source: Array<{ ts: number; value: number }>,
  width: number,
  height: number,
): { points: string; dots: ChartPoint[] } {
  if (!source.length) return { points: "", dots: [] };
  const minTs = source[0].ts;
  const maxTs = source[source.length - 1].ts;
  const minValue = Math.min(...source.map((item) => item.value));
  const maxValue = Math.max(...source.map((item) => item.value));
  const tsSpan = Math.max(1, maxTs - minTs);
  const valueSpan = Math.max(1, maxValue - minValue);
  const dots = source.map((item) => ({
    x: ((item.ts - minTs) / tsSpan) * width,
    y: height - ((item.value - minValue) / valueSpan) * height,
    label: `${new Date(item.ts).toLocaleTimeString()} | ${item.value}`,
  }));
  return {
    points: dots.map((dot) => `${dot.x},${dot.y}`).join(" "),
    dots,
  };
}

export function EditHistoryCharts({ snapshots, localEdits }: Props) {
  const snapshotSeries = useMemo(
    () =>
      snapshots.map((item) => ({
        ts: new Date(item.created_at).getTime(),
        value: item.char_count,
      })),
    [snapshots],
  );

  const localSeries = useMemo(() => localEdits.map((item) => ({ ts: item.ts, value: item.charCount })), [localEdits]);
  const width = 680;
  const height = 180;

  const snapshotPlot = useMemo(() => buildPoints(snapshotSeries, width, height), [snapshotSeries]);
  const localPlot = useMemo(() => buildPoints(localSeries, width, height), [localSeries]);

  return (
    <section className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
      <article>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Saved Snapshot History</h2>
        <p className="mb-2 text-xs text-slate-500">Backend snapshots from autosave every 30s (deduplicated).</p>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full rounded-lg border border-slate-200 bg-white">
          {snapshotPlot.points ? (
            <>
              <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={snapshotPlot.points} />
              {snapshotPlot.dots.map((dot, index) => (
                <circle key={`snapshot-${index}`} cx={dot.x} cy={dot.y} r="2.5" fill="#2563eb">
                  <title>{dot.label}</title>
                </circle>
              ))}
            </>
          ) : (
            <text x="12" y="24" fill="#64748b" fontSize="12">
              No snapshot history yet
            </text>
          )}
        </svg>
      </article>

      <article>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Frontend Edit Timeline</h2>
        <p className="mb-2 text-xs text-slate-500">Local edit events captured in this browser session.</p>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full rounded-lg border border-slate-200 bg-white">
          {localPlot.points ? (
            <>
              <polyline fill="none" stroke="#059669" strokeWidth="2" points={localPlot.points} />
              {localPlot.dots.map((dot, index) => (
                <circle key={`local-${index}`} cx={dot.x} cy={dot.y} r="2.5" fill="#059669">
                  <title>{dot.label}</title>
                </circle>
              ))}
            </>
          ) : (
            <text x="12" y="24" fill="#64748b" fontSize="12">
              Start typing to see edit history
            </text>
          )}
        </svg>
      </article>
    </section>
  );
}
