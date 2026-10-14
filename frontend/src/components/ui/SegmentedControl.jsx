export default function SegmentedControl({ label, options, value, onChange, className = '' }) {
  return <div className={`segmented-control ${className}`} role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}>
      {option.icon && <option.icon size={17} />}{option.label}
    </button>)}
  </div>;
}
