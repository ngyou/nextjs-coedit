"use client";

import { useMemo } from "react";

type EditPoint = {
  ts: number;
  charCount: number;
};

type Props = {
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

export function EditHistoryCharts({ localEdits }: Props) {
  const localSeries = useMemo(
    () => localEdits.slice(-40).map((item) => ({ ts: item.ts, value: item.charCount })),
    [localEdits],
  );
  const width = 280;
  const height = 88;
  const localPlot = useMemo(() => buildPoints(localSeries, width, height), [localSeries]);
  const latest = localEdits[localEdits.length - 1] ?? null;

  return (
    <section className="mt-3 ml-auto w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-3">
      <article>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Frontend Edit Timeline</h2>
          <span className="text-[11px] text-slate-500">{localEdits.length} edits</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full rounded-md border border-slate-200 bg-slate-50">
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
              Start typing to populate timeline
            </text>
          )}
        </svg>
        <p className="mt-2 text-[11px] text-slate-600">
          {latest
            ? `Latest: ${new Date(latest.ts).toLocaleTimeString()} (${latest.charCount} chars)`
            : "No local edits in this session yet"}
        </p>
      </article>
    </section>
  );
}
