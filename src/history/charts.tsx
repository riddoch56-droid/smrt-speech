import { Icon } from '../ui/Icon';

export interface LineSeries {
  label: string;
  points: { x: string; y: number }[];
}

// Series colours are the asset pack's tokens, so charts follow the light and dark themes.
// Every series also has its own marker shape and line style: colour is never the only cue.
const COLOURS = [
  'var(--smrt-primary)',
  'var(--smrt-naming)',
  'var(--smrt-reading)',
  'var(--smrt-writing)',
  'var(--smrt-comprehension)',
  'var(--smrt-warning)',
];
const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'] as const;
type Marker = (typeof MARKERS)[number];

function Mark({ shape, x, y, colour }: { shape: Marker; x: number; y: number; colour: string }) {
  const r = 7;
  const common = { fill: colour, stroke: 'var(--smrt-surface)', strokeWidth: 1.5 };
  switch (shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={r} {...common} />;
    case 'square':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />;
    case 'triangle':
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} {...common} />;
    case 'diamond':
      return <polygon points={`${x},${y - r - 2} ${x + r + 2},${y} ${x},${y + r + 2} ${x - r - 2},${y}`} {...common} />;
    case 'cross':
      return (
        <path
          d={`M${x - r},${y - r} L${x + r},${y + r} M${x + r},${y - r} L${x - r},${y + r}`}
          stroke={colour}
          strokeWidth={4}
          fill="none"
        />
      );
    case 'star':
      return (
        <polygon
          points={`${x},${y - r - 2} ${x + 2.5},${y - 2.5} ${x + r + 2},${y - 2} ${x + 4},${y + 2.5} ${x + 5},${y + r + 2} ${x},${y + 4.5} ${x - 5},${y + r + 2} ${x - 4},${y + 2.5} ${x - r - 2},${y - 2} ${x - 2.5},${y - 2.5}`}
          {...common}
        />
      );
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function LineChart({ series, height = 320 }: { series: LineSeries[]; height?: number }) {
  const width = 900;
  const left = 64;
  const right = 24;
  const top = 20;
  const bottom = 56;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const xPos = (x: string) => (xs.length <= 1 ? left + plotW / 2 : left + (xs.indexOf(x) / (xs.length - 1)) * plotW);
  const yPos = (v: number) => top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(xs.length / maxLabels));

  const summary = series
    .map((s) => `${s.label}: ${s.points.map((p) => `${shortDate(p.x)} ${Math.round(p.y)}%`).join(', ')}`)
    .join('. ');

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Accuracy over time. ${summary}`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={yPos(t)} y2={yPos(t)} stroke="var(--smrt-border)" strokeWidth={1} />
            <text x={left - 10} y={yPos(t) + 6} textAnchor="end" fontSize={18}>
              {t}%
            </text>
          </g>
        ))}
        {xs.map((x, i) =>
          i % step === 0 || i === xs.length - 1 ? (
            <text key={x} x={xPos(x)} y={height - bottom + 28} textAnchor="middle" fontSize={17}>
              {shortDate(x)}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const colour = COLOURS[si % COLOURS.length];
          const shape = MARKERS[si % MARKERS.length];
          const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x));
          return (
            <g key={s.label}>
              {pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(' ')}
                  fill="none"
                  stroke={colour}
                  strokeWidth={3}
                  strokeDasharray={si % 2 === 1 ? '10 5' : undefined}
                />
              )}
              {pts.map((p, i) => (
                <Mark key={i} shape={shape} x={xPos(p.x)} y={yPos(p.y)} colour={colour} />
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="row" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', gap: 20 }} aria-label="Chart key">
        {series.map((s, si) => (
          <li key={s.label} className="row" style={{ gap: 8, fontSize: 18 }}>
            <svg width={28} height={22} viewBox="0 0 28 22" aria-hidden="true">
              <line
                x1={0}
                x2={28}
                y1={11}
                y2={11}
                stroke={COLOURS[si % COLOURS.length]}
                strokeWidth={3}
                strokeDasharray={si % 2 === 1 ? '6 3' : undefined}
              />
              <Mark shape={MARKERS[si % MARKERS.length]} x={14} y={11} colour={COLOURS[si % COLOURS.length]} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface GroupBarRow {
  label: string;
  correct: number;
  total: number;
  percent: number;
}

export function GroupBars({ rows, weak = [] }: { rows: GroupBarRow[]; weak?: string[] }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {rows.map((r) => {
        const isWeak = weak.includes(r.label);
        return (
          <div key={r.label} className="bar-row">
            <span>
              {r.label}{' '}
              {isWeak && (
                <span className="tag warn">
                  <Icon name="info" />
                  Weaker
                </span>
              )}
            </span>
            <div
              className="bar-track"
              role="img"
              aria-label={`${r.label}: ${r.correct} of ${r.total}, ${r.percent} percent`}
            >
              <div className={'bar-fill' + (isWeak ? ' weak' : '')} style={{ width: `${Math.max(0, Math.min(100, r.percent))}%` }} />
            </div>
            <span>
              {r.correct}/{r.total} ({r.percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
