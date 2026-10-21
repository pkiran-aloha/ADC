// Compact two-to-five option switch. `accessibleLabel` is optional and lets a short visible
// label ("6M", "ALL") carry a full spoken name ("Last 6 months", "All time") without changing
// the control's density; every existing caller is unaffected.
export default function SegmentedControl({ label, options, value, onChange, className = '' }) {
  return <div className={`segmented-control ${className}`} role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
      aria-label={option.accessibleLabel || undefined}
      onClick={() => onChange(option.value)}>
      {option.icon && <option.icon size={17} />}{option.label}
    </button>)}
  </div>;
}
