import type { DatedPoint } from '../../lib/series';

export type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const DEFAULT_PADDING: ChartPadding = {
  top: 16,
  right: 16,
  bottom: 28,
  left: 44,
};

export type ChartScales = {
  width: number;
  height: number;
  padding: ChartPadding;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  plotWidth: number;
  plotHeight: number;
  x: (value: number) => number;
  y: (value: number) => number;
};

/** Builds linear scales with a little headroom so points never sit on the frame. */
export function buildScales(
  points: readonly { t: number; value: number }[],
  width: number,
  height: number,
  padding: ChartPadding = DEFAULT_PADDING,
  options?: { includeZero?: boolean; yPadRatio?: number },
): ChartScales {
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const xs = points.map((point) => point.t);
  const ys = points.map((point) => point.value);
  let minX = xs.length ? Math.min(...xs) : 0;
  let maxX = xs.length ? Math.max(...xs) : 1;
  if (minX === maxX) {
    minX -= 86_400_000;
    maxX += 86_400_000;
  }
  let minY = ys.length ? Math.min(...ys) : 0;
  let maxY = ys.length ? Math.max(...ys) : 1;
  if (options?.includeZero) {
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 0);
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const pad = (maxY - minY) * (options?.yPadRatio ?? 0.08);
  minY -= pad;
  maxY += pad;

  return {
    width,
    height,
    padding,
    minX,
    maxX,
    minY,
    maxY,
    plotWidth,
    plotHeight,
    x: (value) => padding.left + ((value - minX) / (maxX - minX)) * plotWidth,
    y: (value) => padding.top + ((maxY - value) / (maxY - minY)) * plotHeight,
  };
}

export function polylinePath(points: readonly DatedPoint[], scales: ChartScales): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command}${scales.x(point.t).toFixed(2)} ${scales.y(point.value).toFixed(2)}`;
    })
    .join(' ');
}

/** Nice-ish tick values between min and max (up to ~5). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const step = niceStep(span / Math.max(1, count - 1));
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks.length > 0 ? ticks : [min, max];
}

function niceStep(rough: number): number {
  const exponent = Math.floor(Math.log10(Math.abs(rough) || 1));
  const fraction = rough / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

export function formatAxisNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value).toLocaleString()}`;
  if (abs >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}
