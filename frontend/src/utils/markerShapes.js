// Data-point markers: shape and fill are the clinician's choice, including the ABA
// convention of a solid circle when a single target is plotted. Pure geometry helpers so
// the chart, the legend swatch and the reports share one definition.

export const MARKER_LIBRARY = [
  { id: 'auto', label: 'Automatic', hint: 'Solid circles for one target; distinct shapes when several are plotted' },
  { id: 'circleSolid', label: 'Solid circle', hint: 'Filled circle, the usual single-case convention' },
  { id: 'circleOpen', label: 'Open circle', hint: 'Hollow circle over the connecting line' },
  { id: 'squareSolid', label: 'Solid square', hint: 'Filled square' },
  { id: 'squareOpen', label: 'Open square', hint: 'Hollow square over the connecting line' },
  { id: 'triangle', label: 'Triangle', hint: 'Triangles keep series apart at close values' },
  { id: 'diamond', label: 'Diamond', hint: 'Diamonds stay readable on dense timelines' }
];

// Marks used when several series share a graph, in order, so they stay distinguishable.
const AUTO_SEQUENCE = ['circleSolid', 'squareOpen', 'triangle', 'diamond', 'circleOpen', 'squareSolid'];

export function resolveMarkerShape(preference, { seriesCount = 1, seriesIndex = 0 } = {}) {
  if (preference && preference !== 'auto') return preference;
  if (seriesCount <= 1) return 'circleSolid';
  return AUTO_SEQUENCE[seriesIndex % AUTO_SEQUENCE.length];
}

// One shape per series, honouring an explicit choice for every series.
export function shapesForSeries(preference, seriesCount) {
  return Array.from({ length: Math.max(1, seriesCount) }, (_, index) => resolveMarkerShape(preference, { seriesCount, seriesIndex: index }));
}

export function isSolidShape(shape) {
  return shape === 'circleSolid' || shape === 'squareSolid' || shape === 'triangle' || shape === 'diamond';
}

// SVG element description, so React and the report renderer describe a marker once.
// `filled` distinguishes a solid marker from an open one (white fill, colored outline).
export function markerElement(shape, { x, y, size, color, fill = null }) {
  const radius = size;
  switch (shape) {
    case 'circleOpen':
      return { tag: 'circle', props: { cx: x, cy: y, r: radius, fill: '#FFFFFF', stroke: color, strokeWidth: 1.8 } };
    case 'squareSolid':
      return { tag: 'rect', props: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, rx: 1.5, fill: fill || color, stroke: '#FFFFFF', strokeWidth: 1.2 } };
    case 'squareOpen':
      return { tag: 'rect', props: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, rx: 1.5, fill: '#FFFFFF', stroke: color, strokeWidth: 2 } };
    case 'triangle':
      return { tag: 'path', props: { d: `M ${x} ${y - radius * 1.15} L ${x + radius} ${y + radius * 0.85} L ${x - radius} ${y + radius * 0.85} Z`, fill: fill || color, stroke: '#FFFFFF', strokeWidth: 1.2 } };
    case 'diamond':
      return { tag: 'path', props: { d: `M ${x} ${y - radius * 1.25} L ${x + radius * 1.1} ${y} L ${x} ${y + radius * 1.25} L ${x - radius * 1.1} ${y} Z`, fill: fill || color, stroke: '#FFFFFF', strokeWidth: 1.2 } };
    case 'circleSolid':
    default:
      return { tag: 'circle', props: { cx: x, cy: y, r: radius, fill: fill || color, stroke: '#FFFFFF', strokeWidth: 1.4 } };
  }
}

// Small swatch geometry for the legend, independent of the chart's coordinate space.
export function swatchElement(shape, { size = 6, color, x = 6, y = 6 }) {
  return markerElement(shape === 'auto' ? 'circleSolid' : shape, { x, y, size, color, fill: color });
}

export function describeMarker(preference, seriesCount = 1) {
  const shape = resolveMarkerShape(preference, { seriesCount });
  return MARKER_LIBRARY.find(option => option.id === shape)?.label || 'Data points';
}
