export default function BrandMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path d="m9 12 5.2 16 5.8-11.4L25.8 28 31 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="10.5" r="2" fill="#fff" />
    </svg>
  );
}
