import { formatShortDate } from '../../lib/dates';
import type { CalorieDeltaPoint } from '../../lib/series';
import { DEFAULT_PADDING, buildScales, formatAxisNumber, niceTicks } from './chartMath';

export type BarChartProps = {
  points: readonly CalorieDeltaPoint[];
  width?: number;
  height?: number;
  valueLabel: (value: number) => string;
  emptyMessage?: string;
  testId?: string;
};

/** Diverging bar chart for overages (up/positive) and underages (down/negative). */
export function BarChart({
  points,
  width = 640,
  height = 220,
  valueLabel,
  emptyMessage = 'Nothing to chart yet.',
  testId,
}: BarChartProps) {
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

  const scales = buildScales(points, width, height, DEFAULT_PADDING, {
    includeZero: true,
    yPadRatio: 0.05,
  });
  const yTicks = niceTicks(scales.minY, scales.maxY, 4);
  const zeroY = scales.y(0);
  const slot = scales.plotWidth / points.length;
  const barWidth = Math.max(2, Math.min(28, slot * 0.62));
  const xLabels = [points[0]!, points[points.length - 1]!].filter(
    (point, index, list) => list.findIndex((item) => item.date === point.date) === index,
  );

  return (
    <svg
      data-testid={testId}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart"
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

      <line
        x1={scales.padding.left}
        x2={width - scales.padding.right}
        y1={zeroY}
        y2={zeroY}
        className="stroke-line-strong"
        strokeWidth={1.5}
      />

      {points.map((point, index) => {
        const center = scales.padding.left + slot * index + slot / 2;
        const y = scales.y(point.value);
        const top = Math.min(y, zeroY);
        const barHeight = Math.max(1, Math.abs(y - zeroY));
        const over = point.value > 0;
        return (
          <rect
            key={point.date}
            x={center - barWidth / 2}
            y={top}
            width={barWidth}
            height={barHeight}
            rx={2}
            className={over ? 'fill-danger' : 'fill-accent'}
          >
            <title>
              {formatShortDate(point.date)}: {valueLabel(point.value)}
            </title>
          </rect>
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
    </svg>
  );
}
