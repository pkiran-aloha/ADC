import { CHART_GRID, CHART_MUTED, CHART_INK, FUNCTION_COLORS, heatColor } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/targetAnalytics';

const FONT = 'Geist, sans-serif';

// Accessible heat map: a real table whose cells are buttons (44px targets) that drill
// into the matching log records.
export function HeatMatrix({ caption, rows, columns, cell, rowHeader = row => row, columnHeader = column => column, onSelect, cornerLabel }) {
  const values = rows.flatMap(row => columns.map(column => cell(row, column).intensity ?? 0));
  const max = Math.max(1e-9, ...values);
  return <div className="data-table-scroll heat-scroll" tabIndex={0} role="region" aria-label={caption}>
    <table className="heat-table">
      <caption className="sr-only">{caption}</caption>
      <thead><tr><th scope="col" className="heat-corner">{cornerLabel}</th>{columns.map(column => <th key={column} scope="col">{columnHeader(column)}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row}>
        <th scope="row">{rowHeader(row)}</th>
        {columns.map(column => {
          const info = cell(row, column);
          const style = info.count ? heatColor((info.intensity ?? 0) / max) : undefined;
          return <td key={column}>
            {info.count && onSelect
              ? <button type="button" className="heat-cell" style={style} aria-label={info.title} title={info.title} onClick={() => onSelect(row, column)}>{info.label}</button>
              : <span className="heat-cell heat-cell--empty" title={info.title} aria-label={info.title}>{info.count ? info.label : '·'}</span>}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function FunctionBars({ profiles, documented = {} }) {
  return <ul className="function-bars">{profiles.map(profile => {
    const hypothesis = documented[profile.behavior];
    const agrees = profile.leading && hypothesis && (profile.leading === hypothesis || (hypothesis === 'Automatic' && profile.leading === 'Automatic'));
    return <li key={profile.behavior}>
      <div className="function-bars-head"><strong>{profile.behavior}</strong><small>n={profile.n}</small></div>
      <div className="function-bar" role="img" aria-label={`${profile.behavior}: ${Object.entries(profile.shares).filter(([, share]) => share > 0).map(([name, share]) => `${name} ${Math.round(share * 100)}%`).join(', ')}`}>
        {Object.entries(profile.shares).map(([name, share]) => share > 0 && <i key={name} style={{ width: `${(100 * share) / Math.max(1, Object.values(profile.shares).reduce((a, b) => a + b, 0))}%`, background: FUNCTION_COLORS[name] }} title={`${name}: ${Math.round(share * 100)}% of episodes`} />)}
      </div>
      <p className="function-bars-note">
        {profile.n ? <>Most consequences delivered <strong>{profile.leading?.toLowerCase() === 'automatic' ? 'no social change' : profile.leading?.toLowerCase()}</strong> ({Math.round(profile.leadingShare * 100)}%).</> : 'No records in this range.'}
        {hypothesis && <span className={`stat-chip stat-chip--${agrees ? 'positive' : 'attention'}`}>{agrees ? 'Consistent with' : 'Differs from'} FBA hypothesis: {hypothesis}</span>}
      </p>
    </li>;
  })}</ul>;
}

export function Scatterplot({ plot, maxDates = 42 }) {
  const dates = plot.dates.slice(-maxDates);
  const blocks = plot.blocks;
  if (!dates.length || !blocks.length) return null;
  const cellW = 14;
  const cellH = 13;
  const left = 46;
  const top = 8;
  const width = left + dates.length * cellW + 10;
  const height = top + blocks.length * cellH + 34;
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Scatterplot of episodes by date and time of day. Scroll horizontally to see all dates.">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart scatter-svg" style={{ minWidth: `${Math.min(width, 900)}px` }} role="img"
      aria-label={`Episodes by time block across ${dates.length} dates. Darker cells mean more episodes; hatched cells were not observed.`}>
      <defs><pattern id="unobserved" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#e0e5dc" strokeWidth="1.5" /></pattern></defs>
      {blocks.map((block, row) => <text key={block} x={left - 6} y={top + row * cellH + 10} textAnchor="end" fontSize="9" fill={CHART_MUTED} fontFamily={FONT}>{row % 2 === 0 ? block : ''}</text>)}
      {dates.map((date, column) => <g key={date}>
        {blocks.map((block, row) => {
          const { count, observed } = plot.cell(date, block);
          const fill = !observed ? 'url(#unobserved)' : count === 0 ? '#ffffff' : count === 1 ? '#9dbea8' : count === 2 ? '#4c7b61' : '#234333';
          return <rect key={block} x={left + column * cellW} y={top + row * cellH} width={cellW - 2} height={cellH - 2} rx="2" fill={fill} stroke={observed ? '#d7ddd2' : 'none'}>
            <title>{`${date} ${block}: ${observed ? `${count} episode${count === 1 ? '' : 's'} (${observed} min observed)` : 'not observed'}`}</title>
          </rect>;
        })}
        {(column % 7 === 0) && <text x={left + column * cellW} y={height - 18} fontSize="9" fill={CHART_MUTED} fontFamily={FONT}>{date.slice(5)}</text>}
      </g>)}
      <g fontSize="9" fill={CHART_INK} fontFamily={FONT} transform={`translate(${left}, ${height - 8})`}>
        <rect width="9" height="9" y="-8" fill="url(#unobserved)" stroke="#d7ddd2" /><text x="13">Not observed</text>
        <rect x="80" width="9" height="9" y="-8" fill="#fff" stroke="#d7ddd2" /><text x="93">0</text>
        <rect x="110" width="9" height="9" y="-8" fill="#9dbea8" /><text x="123">1</text>
        <rect x="140" width="9" height="9" y="-8" fill="#4c7b61" /><text x="153">2</text>
        <rect x="170" width="9" height="9" y="-8" fill="#234333" /><text x="183">3+</text>
      </g>
    </svg>
  </div>;
}

// Three-column flow: antecedent category -> behavior -> consequence function.
export function FlowDiagram({ flows, behaviors }) {
  const width = 820;
  const height = 300;
  const columnX = [150, 410, 670];
  const nodeWidth = 14;
  const totals = (links, side) => {
    const map = new Map();
    for (const link of links) map.set(link[side], (map.get(link[side]) || 0) + link.value);
    return map;
  };
  const left = totals(flows.left, 'source');
  const middle = totals(flows.left, 'target');
  const right = totals(flows.right, 'target');
  const grand = Math.max(1e-9, [...middle.values()].reduce((a, b) => a + b, 0));
  const layout = (map, x, order) => {
    const keys = order ? order.filter(key => map.has(key)) : [...map.keys()].sort((a, b) => map.get(b) - map.get(a));
    const gap = 8;
    const usable = height - 30 - gap * Math.max(0, keys.length - 1);
    let y = 14;
    return new Map(keys.map(key => {
      const h = Math.max(4, (map.get(key) / grand) * usable);
      const node = { x, y, h, value: map.get(key) };
      y += h + gap;
      return [key, node];
    }));
  };
  const leftNodes = layout(left, columnX[0]);
  const middleNodes = layout(middle, columnX[1], behaviors);
  const rightNodes = layout(right, columnX[2], ['Escape', 'Attention', 'Tangible', 'Sensory', 'None']);
  const offsets = new Map();
  const path = (from, to, value, fromKey, toKey, key) => {
    const thickness = Math.max(1, (value / grand) * (height - 30 - 8 * 6));
    const fromOffset = offsets.get(`out-${key}-${fromKey}`) ?? 0;
    const toOffset = offsets.get(`in-${key}-${toKey}`) ?? 0;
    offsets.set(`out-${key}-${fromKey}`, fromOffset + thickness);
    offsets.set(`in-${key}-${toKey}`, toOffset + thickness);
    const y1 = from.y + fromOffset + thickness / 2;
    const y2 = to.y + toOffset + thickness / 2;
    const x1 = from.x + nodeWidth;
    const x2 = to.x;
    const mid = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, thickness };
  };
  const linkPaths = [
    ...flows.left.filter(link => leftNodes.get(link.source) && middleNodes.get(link.target)).sort((a, b) => b.value - a.value)
      .map(link => ({ ...link, color: '#9dbea8', ...path(leftNodes.get(link.source), middleNodes.get(link.target), link.value, link.source, link.target, 'l') })),
    ...flows.right.filter(link => middleNodes.get(link.source) && rightNodes.get(link.target)).sort((a, b) => b.value - a.value)
      .map(link => ({ ...link, color: FUNCTION_COLORS[link.target] || '#c9d1c4', ...path(middleNodes.get(link.source), rightNodes.get(link.target), link.value, link.source, link.target, 'r') }))
  ];
  const label = (map, anchor, dx) => [...map.entries()].map(([key, node]) => <g key={key}>
    <rect x={node.x} y={node.y} width={nodeWidth} height={node.h} rx="2" fill="#294f3d" />
    <text x={node.x + dx} y={node.y + node.h / 2 + 4} textAnchor={anchor} fontSize="11" fill={CHART_INK} fontFamily={FONT}>{key} · {formatNumber(node.value, 0)}</text>
  </g>);
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Flow from antecedent category to behavior to consequence function. Scroll horizontally on small screens.">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart flow-svg" role="img" aria-label="Flow of recorded episodes from antecedent category through behavior to the reinforcer type the consequence delivered.">
      {linkPaths.map((link, index) => <path key={index} d={link.d} fill="none" stroke={link.color} strokeOpacity="0.55" strokeWidth={link.thickness}>
        <title>{`${link.source} → ${link.target}: ${formatNumber(link.value, 1)} episodes`}</title>
      </path>)}
      {label(leftNodes, 'end', -6)}
      {label(middleNodes, 'start', nodeWidth + 6)}
      {label(rightNodes, 'start', nodeWidth + 6)}
      <text x={columnX[0]} y={height - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_MUTED} fontFamily={FONT}>Antecedent category</text>
      <text x={columnX[1]} y={height - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_MUTED} fontFamily={FONT}>Behavior</text>
      <text x={columnX[2]} y={height - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_MUTED} fontFamily={FONT}>Consequence delivered</text>
    </svg>
  </div>;
}

// Rate ratios with 95% intervals on a log axis (1 = no difference).
export function ForestPlot({ effects, valueLabel = 'Rate ratio' }) {
  if (!effects.length) return <p className="field-hint">Not enough sessions with setting events in this range.</p>;
  const width = 470;
  const rowH = 30;
  const left = 160;
  const right = 92;
  const height = effects.length * rowH + 40;
  const min = 0.25;
  const max = 4;
  const x = value => left + ((Math.log(Math.max(min, Math.min(max, value))) - Math.log(min)) / (Math.log(max) - Math.log(min))) * (width - left - right);
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label={`${valueLabel} chart`}>
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart forest-svg" role="img" aria-label={effects.map(effect => `${effect.label}: ${formatNumber(effect.ratio, 2)} (95% interval ${formatNumber(effect.low, 2)} to ${formatNumber(effect.high, 2)})`).join('; ')}>
      {[0.25, 0.5, 1, 2, 4].map(tick => <g key={tick}>
        <line x1={x(tick)} x2={x(tick)} y1="8" y2={height - 26} stroke={tick === 1 ? '#5d6a58' : CHART_GRID} strokeDasharray={tick === 1 ? undefined : '2 3'} />
        <text x={x(tick)} y={height - 10} textAnchor="middle" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>×{tick}</text>
      </g>)}
      {effects.map((effect, index) => {
        const y = 22 + index * rowH;
        const strong = effect.low > 1 || effect.high < 1;
        return <g key={effect.label}>
          <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill={CHART_INK} fontFamily={FONT}>{effect.label}</text>
          {effect.low != null && <line x1={x(effect.low)} x2={x(effect.high)} y1={y} y2={y} stroke={strong ? '#a34436' : '#9aa596'} strokeWidth="2" />}
          <rect x={x(effect.ratio) - 5} y={y - 5} width="10" height="10" fill={strong ? '#a34436' : '#ffffff'} stroke={strong ? '#a34436' : '#5d6a58'} strokeWidth="1.5" />
          <text x={width - right + 10} y={y + 4} fontSize="11" fill={CHART_INK} fontFamily={FONT}>{`×${formatNumber(effect.ratio, 2)}`}<tspan fill={CHART_MUTED}>{effect.n != null ? `  n=${effect.n}` : ''}</tspan></text>
        </g>;
      })}
    </svg>
  </div>;
}

export function MiniTrend({ series, weeks, maxValue = 5, label }) {
  const width = 440;
  const height = 170;
  const pad = { left: 30, right: 10, top: 10, bottom: 24 };
  const x = index => pad.left + (weeks.length > 1 ? (index / (weeks.length - 1)) * (width - pad.left - pad.right) : 0);
  const y = value => pad.top + (1 - value / maxValue) * (height - pad.top - pad.bottom);
  const colors = ['#346b52', '#9b7a3d', '#697b96', '#a36959'];
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label={label}>
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].filter(value => value <= maxValue).map(value => <g key={value}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} stroke={CHART_GRID} strokeDasharray="2 3" />
        <text x={pad.left - 6} y={y(value) + 3} textAnchor="end" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{value}</text></g>)}
      {series.map((item, index) => {
        const points = item.points.map((point, position) => ({ ...point, position })).filter(point => point.intensity != null);
        return <g key={item.behavior}>
          <path d={points.map((point, position) => `${position ? 'L' : 'M'} ${x(point.position)} ${y(point.intensity)}`).join(' ')} fill="none" stroke={colors[index % colors.length]} strokeWidth="2" />
          {points.map(point => <circle key={point.week} cx={x(point.position)} cy={y(point.intensity)} r="2.6" fill={colors[index % colors.length]}><title>{`${item.behavior}, week of ${point.week}: mean intensity ${formatNumber(point.intensity)} (n=${point.n})`}</title></circle>)}
        </g>;
      })}
      {weeks.map((week, index) => index % Math.max(1, Math.ceil(weeks.length / 8)) === 0 && <text key={week} x={x(index)} y={height - 6} textAnchor="middle" fontSize="10" fill={CHART_MUTED} fontFamily={FONT}>{week.slice(5)}</text>)}
    </svg>
    <ul className="prompt-legend">{series.map((item, index) => <li key={item.behavior}><i style={{ background: colors[index % colors.length] }} />{item.behavior}</li>)}</ul>
  </div>;
}

// Event timestamps read as clock time: one dot per recorded event, positioned by date and
// time of day and sized by intensity. Requested for toileting and behavior-reduction
// analysis, where the time of day matters more than the running total.
export function TimeOfDayScatter({ pattern, maxDates = 60 }) {
  if (!pattern?.points?.length) return null;
  const dates = [...new Set(pattern.points.map(point => point.date))].slice(-maxDates);
  const plotted = pattern.points.filter(point => dates.includes(point.date));
  const left = 66;
  const top = 12;
  const plotHeight = 320;
  const columnWidth = Math.max(12, Math.min(30, 620 / Math.max(1, dates.length)));
  const width = left + dates.length * columnWidth + 28;
  const height = top + plotHeight + 46;
  const toY = minutes => top + (minutes / 1440) * plotHeight;
  const hours = [0, 6, 12, 18, 24];
  return <div className="chart-scroll" tabIndex={0} role="region" aria-label="Scatterplot of event timestamps by date and time of day. Scroll horizontally for all dates.">
    <svg viewBox={`0 0 ${width} ${height}`} className="aux-chart scatter-svg" style={{ minWidth: `${Math.min(width, 940)}px` }} role="img"
      aria-label={`${plotted.length} events plotted by date and clock time across ${dates.length} dates. Larger dots are higher intensity.`}>
      {hours.map(hour => <g key={hour}>
        <line x1={left} x2={width - 20} y1={toY(hour * 60)} y2={toY(hour * 60)} stroke={CHART_GRID} strokeDasharray="3 3" />
        <text x={left - 6} y={toY(hour * 60) + 4} textAnchor="end" fontSize="9.5" fill={CHART_MUTED} fontFamily={FONT}>{String(hour % 24).padStart(2, '0')}:00</text>
      </g>)}
      {dates.map((date, index) => <g key={date}>
        {(index % Math.ceil(dates.length / 12) === 0 || index === dates.length - 1) && <text x={left + index * columnWidth + columnWidth / 2} y={height - 24} fontSize="9" fill={CHART_MUTED} fontFamily={FONT} textAnchor="middle">{date.slice(5)}</text>}
        <line x1={left + index * columnWidth + columnWidth / 2} x2={left + index * columnWidth + columnWidth / 2} y1={top} y2={top + plotHeight} stroke="#eef2ee" />
      </g>)}
      {plotted.map(point => {
        const index = dates.indexOf(point.date);
        const cx = left + index * columnWidth + columnWidth / 2 + ((point.minutes % 60) / 60 - 0.5) * (columnWidth - 6);
        const radius = 2.4 + (point.intensity ? (point.intensity - 1) * 0.7 : 0);
        return <circle key={point.id} cx={cx} cy={toY(point.minutes)} r={radius} fill={point.intensity >= 4 ? '#8e4a3a' : point.intensity >= 3 ? '#b97a5c' : '#527d82'} opacity="0.85">
          <title>{`${point.timestamp.slice(11, 16)} on ${point.date} · ${point.behaviors.join(', ')}${point.intensity ? ` · intensity ${point.intensity}/5` : ''}`}</title>
        </circle>;
      })}
      <text x={left} y={height - 8} fontSize="9.5" fill={CHART_INK} fontFamily={FONT}>Each dot is one recorded event · size and colour show intensity</text>
    </svg>
  </div>;
}
