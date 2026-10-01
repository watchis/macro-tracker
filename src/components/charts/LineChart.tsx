import { useId, useState } from 'react';
import { formatShortDate } from '../../lib/dates';
import { linearTrend, type DatedPoint } from '../../lib/series';
import {
  DEFAULT_PADDING,
  buildScales,
  formatAxisNumber,
  niceTicks,
  polylinePath,
} from './chartMath';

export type LineChartProps = {
  points: readonly DatedPoint[];
  /** Optional second series drawn as a dashed line (e.g. trend or mean). */
  trendPoints?: readonly DatedPoint[];
  /** When true, fit and draw a least-squares trendline through `points`. */
  showTrendline?: boolean;
  /** When true with a trendline, also draw a horizontal mean line. */
  showAverage?: boolean;
  width?: number;
  height?: number;
  valueLabel: (value: number) => string;
  /**
   * Optional richer tooltip body for a point. Defaults to date + `valueLabel`.
   * Return newlines for multi-line tips.
   */
  pointTooltip?: (point: DatedPoint) => string;
  emptyMessage?: string;
  testId?: string;
  /** Accent stroke for the primary series; defaults to currentColor via CSS. */
  className?: string;
};

/**
 * Responsive SVG line chart. Uses `currentColor` for the series so the parent
 * can tint it with text-accent / text-ink utilities. Hovering a node shows a
 * floating tooltip with the date and value.
 */
export function LineChart({
  points,
  trendPoints,
  showTrendline = false,
  showAverage = false,
  width = 640,
  height = 220,
  valueLabel,
  pointTooltip,
  emptyMessage = 'Nothing to chart yet.',
  testId,
  className,
}: LineChartProps) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState<DatedPoint | null>(null);

  if (points.length === 0) {
    return (
      <div
        data-testid={testId}
        className="flex h-52 items-center justify-center rounded-md border border-dashed border-line text-sm text-muted"
      >
        {emptyMessage}
      </div>
    );
  }

  const trend = showTrendline ? linearTrend(points) : null;
  const fittedTrend: DatedPoint[] =
    trendPoints != null
      ? [...trendPoints]
      : trend
        ? [
            { date: points[0]!.date, t: points[0]!.t, value: trend.at(points[0]!.t) },
            {
              date: points[points.length - 1]!.date,
              t: points[points.length - 1]!.t,
              value: trend.at(points[points.length - 1]!.t),
            },
          ]
        : [];

  const averagePoints: DatedPoint[] =
    showAverage && trend
      ? [
          { date: points[0]!.date, t: points[0]!.t, value: trend.mean },
          {
            date: points[points.length - 1]!.date,
            t: points[points.length - 1]!.t,
            value: trend.mean,
          },
        ]
      : [];

  const allForScale = [...points, ...fittedTrend, ...averagePoints];
  const scales = buildScales(allForScale, width, height, DEFAULT_PADDING);
  const yTicks = niceTicks(scales.minY, scales.maxY, 4);
  const xLabels = [points[0]!, points[points.length - 1]!].filter(
    (point, index, list) => list.findIndex((item) => item.date === point.date) === index,
  );

  const tooltipText = hovered
    ? (pointTooltip?.(hovered) ?? `${formatShortDate(hovered.date)}: ${valueLabel(hovered.value)}`)
    : null;
  const tooltipLines = tooltipText?.split('\n') ?? [];

  // Keep the floating tip inside the plot, slightly above the hovered node.
  const tipX = hovered ? scales.x(hovered.t) : 0;
  const tipY = hovered ? scales.y(hovered.value) : 0;
  const tipLeftPct = (tipX / width) * 100;
  const tipTopPct = (tipY / height) * 100;

  return (
    <div
      data-testid={testId}
      className={['relative h-auto w-full', className].filter(Boolean).join(' ')}
      onMouseLeave={() => setHovered(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart"
        className="h-auto w-full"
      >
        {yTicks.map((tick) => {
          const y = scales.y(tick);
          return (
            <g key={tick}>
              <line
                x1={scales.padding.left}
                x2={width - scales.padding.right}
                y1={y}
                y2={y}
                className="stroke-line"
                strokeWidth={1}
              />
              <text
                x={scales.padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-subtle text-[10px]"
              >
                {formatAxisNumber(tick)}
              </text>
            </g>
          );
        })}

        {xLabels.map((point) => (
          <text
            key={point.date}
            x={scales.x(point.t)}
            y={height - 8}
            textAnchor="middle"
            className="fill-subtle text-[10px]"
          >
            {formatShortDate(point.date)}
          </text>
        ))}

        {averagePoints.length === 2 ? (
          <path
            d={polylinePath(averagePoints, scales)}
            fill="none"
            className="stroke-muted"
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />
        ) : null}

        {fittedTrend.length >= 2 ? (
          <path
            d={polylinePath(fittedTrend, scales)}
            fill="none"
            className="stroke-accent-muted"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        ) : null}

        {points.length === 1 ? null : (
          <path
            d={polylinePath(points, scales)}
            fill="none"
            className="stroke-accent"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((point) => {
          const cx = scales.x(point.t);
          const cy = scales.y(point.value);
          const active = hovered?.date === point.date && hovered.t === point.t;
          return (
            <g key={`${point.date}-${point.t}`}>
              <circle
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                className="fill-accent stroke-bg pointer-events-none"
                strokeWidth={1.5}
              />
              {/* Larger invisible hit target so dense weekly points stay hoverable. */}
              <circle
                cx={cx}
                cy={cy}
                r={10}
                fill="transparent"
                className="cursor-pointer"
                role="img"
                aria-describedby={active ? tooltipId : undefined}
                onMouseEnter={() => setHovered(point)}
                onFocus={() => setHovered(point)}
                onBlur={() => setHovered((current) => (current === point ? null : current))}
                tabIndex={0}
              >
                <title>
                  {pointTooltip?.(point) ??
                    `${formatShortDate(point.date)}: ${valueLabel(point.value)}`}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      {hovered && tooltipLines.length > 0 ? (
        <div
          id={tooltipId}
          role="tooltip"
          data-testid={testId ? `${testId}-tooltip` : 'line-chart-tooltip'}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-line bg-raised px-2 py-1 text-xs whitespace-pre text-ink shadow-sm"
          style={{
            left: `${tipLeftPct}%`,
            top: `${tipTopPct}%`,
            maxWidth: '14rem',
          }}
        >
          {tooltipLines.map((line, index) => (
            <div key={`${line}-${index}`} className={index === 0 ? 'font-medium' : 'text-muted'}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
