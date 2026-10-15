// A single interaction accent; muted data colors distinguish labeled series.
export const DATA_COLORS = ['#346b52', '#9b7a3d', '#697b96', '#a36959', '#527d82', '#65735a'];
export const CHART_INK = '#4f5e4c';
export const CHART_MUTED = '#5d6a58';
export const CHART_GRID = '#e0e5dc';

export function seriesColor(index, monochrome = false) {
  return monochrome ? '#29372a' : DATA_COLORS[index % DATA_COLORS.length];
}

export function formatChartDate(value, aggregation = 'Per Day') {
  if (aggregation === 'Per Session') return `S${value}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    if (aggregation === 'Weekly') {
      const end = new Date(date);
      end.setUTCDate(end.getUTCDate() + 6);
      return `${date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${end.toLocaleDateString('en', { ...(date.getUTCMonth() !== end.getUTCMonth() ? { month: 'short' } : {}), day: 'numeric', timeZone: 'UTC' })}`;
    }
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T12:00:00Z`).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return value;
}

// Pick legible marker text, including alpha colors composited on the white chart.
export function chartMarkerInk(color) {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color || '')) return '#ffffff';
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1;
  const channels = [1, 3, 5].map(index => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255 * alpha + 1 - alpha;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

// Reinforcer types delivered by ABC consequences (descriptive function analysis).
export const FUNCTION_COLORS = { Escape: '#a36959', Attention: '#697b96', Tangible: '#9b7a3d', Sensory: '#527d82', None: '#c9d1c4' };

// Sequential heat-map color from the canvas tone to the accent, with legible ink.
export function heatColor(t) {
  const low = [246, 247, 243];
  const high = [52, 99, 76];
  const clamped = Math.max(0, Math.min(1, t));
  const mix = low.map((value, index) => Math.round(value + (high[index] - value) * clamped));
  const hex = `#${mix.map(value => value.toString(16).padStart(2, '0')).join('')}`;
  // Pure black or white ink always clears 4.5:1 against this scale (WCAG AA).
  return { background: hex, color: chartMarkerInk(hex) };
}
