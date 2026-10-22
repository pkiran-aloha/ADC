import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ArrowCounterClockwise } from '../ui/Icons';
import { moduleById } from '../../utils/overviewOrder';

// User-controlled module order for the progress overview. The current order stays in normal
// page flow (a reorder panel, not a replacement list) and the section navigation below it
// follows the same order, so keyboard and screen-reader reading order matches what is drawn.
export default function OverviewModuleOrder({ order = [], onMove, onReset }) {
  const [message, setMessage] = useState('');

  return <details className="module-order">
    <summary>
      <span className="module-order__title">Reorder modules</span>
      <span className="module-order__summary">{order.map(id => moduleById(id)?.label).filter(Boolean).join(' › ')}</span>
    </summary>
    <div className="module-order__body">
      <p className="field-hint">Choose the module you read first. The section links below follow the same order, and every module stays on the page with its data, caveats and controls.</p>
      <ol className="module-order__list">
        {order.map((id, index) => {
          const module = moduleById(id);
          if (!module) return null;
          return <li key={id} className="module-order__item">
            <span className="module-order__index" aria-hidden="true">{index + 1}</span>
            <span className="module-order__label">{module.label}</span>
            <span className="module-order__actions">
              <button type="button" className="icon-button icon-button--bordered" disabled={index === 0}
                aria-label={`Move ${module.label} up`}
                onClick={() => { onMove?.(id, -1); setMessage(`${module.label} moved up to position ${index} of ${order.length}.`); }}>
                <ArrowUpIcon size={16} aria-hidden="true" />
              </button>
              <button type="button" className="icon-button icon-button--bordered" disabled={index === order.length - 1}
                aria-label={`Move ${module.label} down`}
                onClick={() => { onMove?.(id, 1); setMessage(`${module.label} moved down to position ${index + 2} of ${order.length}.`); }}>
                <ArrowDownIcon size={16} aria-hidden="true" />
              </button>
            </span>
          </li>;
        })}
      </ol>
      <div className="module-order__footer">
        <button type="button" className="button button--tertiary" onClick={() => { onReset?.(); setMessage('Module order restored to the default.'); }}>
          <ArrowCounterClockwise size={16} aria-hidden="true" />Reset order
        </button>
        <p className="field-hint" role="status">{message}</p>
      </div>
    </div>
  </details>;
}
