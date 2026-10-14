import Popover from './Popover';
import { HelpCircle } from './Icons';

export default function SectionHeader({ id, title, description, help, actions }) {
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
    {actions && <div className="panel-actions">{actions}</div>}
  </header>;
}
