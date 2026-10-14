import { useEffect, useId, useRef, useState } from 'react';

export default function Popover({ label, icon: Icon, children, disabled = false, compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const id = useId();

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) document.getElementById(`${id}-trigger`)?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        document.getElementById(`${id}-trigger`)?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointer);
    rootRef.current?.addEventListener('keydown', handleKey);
    const root = rootRef.current;
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      root?.removeEventListener('keydown', handleKey);
    };
  }, [open, id]);

  return (
    <div className={`popover ${className}`} ref={rootRef} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button type="button" id={`${id}-trigger`} className={compact ? 'icon-button' : 'button button--secondary'}
        aria-label={compact ? label : undefined} aria-expanded={open} aria-controls={id}
        disabled={disabled} onClick={() => setOpen(value => !value)}>
        {Icon && <Icon size={18} />}
        {!compact && <span>{label}</span>}
      </button>
      {open && <div id={id} className="popover-content" role="group" aria-label={label}>
        {typeof children === 'function' ? children({ close }) : children}
      </div>}
    </div>
  );
}
