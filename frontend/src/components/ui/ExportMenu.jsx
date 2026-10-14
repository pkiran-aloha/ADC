import { useState } from 'react';
import { Download, FileCode, Image, FileSpreadsheet, Archive } from './Icons';
import Popover from './Popover';
import { useFeedback } from '../../utils/useFeedback';

const icons = { svg: FileCode, png: Image, csv: FileSpreadsheet, 'raw-csv': FileSpreadsheet, zip: Archive };

export default function ExportMenu({ label, formats, onExport, disabled = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const notify = useFeedback();

  return <Popover label={label} icon={Download} disabled={disabled} className="export-popover">
    {({ close }) => <>
      <p className="popover-label">Download a copy</p>
      {formats.map(format => {
        const Icon = icons[format.id];
        return <button key={format.id} type="button" className="popover-option" disabled={pending || format.disabled}
          onClick={async () => {
            setPending(true);
            setError('');
            try {
              await onExport(format.id);
              notify('Your export is ready. Check your downloads.');
              close(true);
            } catch {
              setError('We couldn’t prepare this export. Please try again.');
            } finally {
              setPending(false);
            }
          }}>
          <Icon size={19} /><span>{format.label}</span>
        </button>;
      })}
      {pending && <p className="field-hint" role="status">Preparing your download…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </>}
  </Popover>;
}
