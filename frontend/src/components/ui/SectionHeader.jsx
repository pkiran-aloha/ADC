import Popover from './Popover';
import { HelpCircle, Ellipsis } from './Icons';

// Shared page header. The pattern is deliberately narrow: title, one-line purpose, one
// primary action, and an overflow for secondary actions. Anything else competes with the
// work below it. `actions` stays available for the sections that already pass a custom row
// (exports with their own progress/error states); `overflowActions` collects the rest.
export default function SectionHeader({
  id, title, description, help, actions, primaryAction, overflowActions = [], overflowLabel = 'More actions'
}) {
  return <header className="panel-header">
    <div className="panel-heading">
      <div className="panel-title-row">
        <h2 id={id}>{title}</h2>
        {help && <Popover label={`About ${title.toLowerCase()}`} icon={HelpCircle} compact className="help-popover">
          <p className="help-copy">{help}</p>
        </Popover>}
      </div>
      <p>{description}</p>
    </div>
    {(primaryAction || actions || overflowActions.length > 0) && <div className="panel-actions">
      {primaryAction}
      {actions}
      {overflowActions.length > 0 && <Popover label={overflowLabel} icon={Ellipsis} compact className="overflow-popover">
        {({ close }) => overflowActions.map(action => {
          const Icon = action.icon;
          return <button key={action.label} type="button" className="popover-option"
            disabled={action.disabled} onClick={() => {
              close(true);
              action.onClick?.();
            }}>
            {Icon && <Icon size={18} aria-hidden="true" />}<span>{action.label}</span>
          </button>;
        })}
      </Popover>}
    </div>}
  </header>;
}
