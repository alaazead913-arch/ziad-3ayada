import { useMemo } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
  value2?: number;
}

// ----- Bar chart ------------------------------------------------------------
export function BarChart({
  data, height = 200, color = 'bg-primary-500', color2 = 'bg-secondary-400',
  format = (n) => String(n),
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  color2?: string;
  format?: (n: number) => string;
}) {
  const max = useMemo(() => Math.max(1, ...data.flatMap((d) => [d.value, d.value2 ?? 0])), [data]);
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
          <div className="flex items-end gap-1 w-full justify-center" style={{ height: height - 40 }}>
            <div
              className={`${color} rounded-t-md transition-all duration-300 w-full max-w-[28px]`}
              style={{ height: `${(d.value / max) * 100}%` }}
              title={format(d.value)}
            />
            {d.value2 !== undefined && (
              <div
                className={`${color2} rounded-t-md transition-all duration-300 w-full max-w-[28px]`}
                style={{ height: `${((d.value2 ?? 0) / max) * 100}%` }}
                title={format(d.value2 ?? 0)}
              />
            )}
          </div>
          <span className="text-[10px] text-ink-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ----- Line / area chart ----------------------------------------------------
export function LineChart({
  data, height = 220, stroke = '#f05e06',
}: {
  data: ChartPoint[];
  height?: number;
  stroke?: string;
}) {
  const w = 600;
  const h = height;
  const pad = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => {
    const x = pad + i * step;
    const y = h - pad - ((d.value - min) / range) * (h - pad * 2);
    return { x, y, ...d };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${pts[pts.length-1].x.toFixed(1)} ${h - pad} L ${pts[0].x.toFixed(1)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)}
              stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#lc-grad)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
          <text x={p.x} y={h - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ----- Donut chart ----------------------------------------------------------
export function DonutChart({
  data, size = 180, thickness = 26,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} className="-rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const seg = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              className="rotate-90" transform={`rotate(90 ${cx} ${cy})`}
              fontSize="22" fontWeight="700" fill="#1e293b">
          {total.toLocaleString('ar-EG')}
        </text>
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
            <span className="text-ink-600 font-medium">{d.label}</span>
            <span className="text-ink-400 nums">
              {((d.value / total) * 100).toFixed(0)}٪
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
