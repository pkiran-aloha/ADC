// A status or phase that can be changed in place. It is a native select dressed as a pill, so
// it works with a keyboard, a screen reader and a phone without any extra code. Read-only, it
// is the same pill without the control, and the words always carry the meaning, never the colour.
export default function StatusControl({ value, label, options, display, onChange, disabled }) {
  const tone = String(value || '').toLowerCase();
  if (disabled) return <span className={`pm-status pm-status--${tone}`}>{display(value)}</span>;
  return <select className={`pm-status pm-status--${tone} pm-status--control`} aria-label={label} value={value}
    onChange={event => onChange(event.target.value)}>
    {options.map(option => <option key={option} value={option}>{display(option)}</option>)}
  </select>;
}
