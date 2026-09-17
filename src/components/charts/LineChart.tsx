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
  emptyMessage?: string;
  testId?: string;
  /** Accent stroke for the primary series; defaults to currentColor via CSS. */
  className?: string;
};

/**
 * Responsive SVG line chart. Uses `currentColor` for the series so the parent
 * can tint it with text-accent / text-ink utilities.
 */
export function LineChart({
  points,
  trendPoints,
  showTrendline = false,
  showAverage = false,
  width = 640,
  height = 220,
  valueLabel,
  emptyMessage = 'Nothing to chart yet.',
  testId,
  className,
}: LineChartProps) {
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

  return (
    <svg
      data-testid={testId}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Line chart"
      className={['h-auto w-full', className].filter(Boolean).join(' ')}
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

      {points.map((point) => (
        <circle
          key={point.date}
          cx={scales.x(point.t)}
          cy={scales.y(point.value)}
          r={3.5}
          className="fill-accent stroke-bg"
          strokeWidth={1.5}
        >
          <title>
            {formatShortDate(point.date)}: {valueLabel(point.value)}
          </title>
        </circle>
      ))}
    </svg>
  );
}
