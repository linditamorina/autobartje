/**
 * Small server-rendered charts for the reports page: plain HTML and CSS, one
 * colour (the brand colour), a tooltip on hover or focus, and the same numbers
 * in a table for screen readers and printing.
 */

export type Bar = { label: string; value: number; display: string };

export function BarChart({ bars, caption, tableLabel }: { bars: Bar[]; caption: string; tableLabel: string }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const top = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0]);
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
      <div aria-hidden className="flex h-48 items-end gap-1 border-b border-border">
        {bars.map((b) => (
          <div key={b.label} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80" style={{ height: max > 0 ? `${Math.max(b.value > 0 ? 2 : 0, (Math.max(0, b.value) / max) * 100)}%` : 0 }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background shadow group-hover:block">
              {b.label}: {b.display}
            </span>
            {b === top && b.value > 0 && <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums group-hover:hidden">{b.display}</span>}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1 text-[11px] text-muted-foreground">
        {bars.map((b, i) => (
          <span key={b.label} className="flex flex-1 justify-center whitespace-nowrap">{bars.length <= 8 || i % 3 === 0 ? b.label : ""}</span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">{tableLabel}</summary>
        <table className="mt-2 w-full">
          <tbody>
            {bars.map((b) => (
              <tr key={b.label} className="border-b border-border last:border-0">
                <th scope="row" className="py-1 text-left font-normal">{b.label}</th>
                <td className="py-1 text-right tabular-nums">{b.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Orders per weekday and hour: darker = more orders. */
export function Heatmap({ grid, days, cellLabel, busiest }: { grid: number[][]; days: string[]; cellLabel: (day: string, hour: number, count: number) => string; busiest: string }) {
  const max = Math.max(...grid.flat(), 0);
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm text-muted-foreground">{busiest}</figcaption>
      <div className="overflow-x-auto">
        <div aria-hidden className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[11px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-muted-foreground">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-muted-foreground">{days[d]}</span>
              {row.map((n, h) => (
                <span
                  key={h}
                  title={cellLabel(days[d], h, n)}
                  className="aspect-square rounded-[3px] border border-border/60"
                  style={{ background: n > 0 && max > 0 ? `color-mix(in oklab, var(--primary) ${Math.round(15 + (n / max) * 85)}%, transparent)` : undefined }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
