import { useState } from 'react';
import Dialog from '../ui/Dialog';

// One prompt for every phase or status change. Yes plots a labelled line on the change
// date, No changes the phase without one, and Cancel changes nothing at all.
export default function PhaseChangePrompt({ prompt, onChoose, onCancel }) {
  const [reason, setReason] = useState('');
  return <Dialog isOpen={Boolean(prompt)} onClose={onCancel} title="Plot a phase change line?" presentation="confirmation"
    description={prompt ? `Do you wish to plot a phase change line on analytics (${prompt.subject}) to highlight the change in phase?` : ''}>
    {prompt?.withReason && <div className="field">
      <label htmlFor="phase-prompt-reason">Reason</label>
      <input id="phase-prompt-reason" type="text" maxLength={120} value={reason} onChange={event => setReason(event.target.value)}
        placeholder="For example: criterion met, moving to maintenance" />
    </div>}
    <div className="form-actions">
      <button type="button" className="button button--secondary" onClick={onCancel} data-autofocus>Cancel</button>
      <button type="button" className="button button--secondary" onClick={() => { onChoose(false, reason); setReason(''); }}>No</button>
      <button type="button" className="button button--primary" onClick={() => { onChoose(true, reason); setReason(''); }}>Yes</button>
    </div>
  </Dialog>;
}
