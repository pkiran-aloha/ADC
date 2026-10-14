import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';

// Native showModal() supplies background inertness, focus containment, and Escape.
export default function Dialog({ isOpen, onClose, title, description, children, presentation = 'sheet', icon: Icon }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    document.body.classList.add('has-dialog');
    (dialog.querySelector('[data-autofocus]') || dialog.querySelector('.dialog-title')).focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.classList.remove('has-dialog');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${presentation}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); closeRef.current(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        const controls = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
          closeRef.current();
        }
      }}
    >
      <header className="dialog-header">
        <div>
          <div className="dialog-title-row">
            {Icon && <Icon className="dialog-icon" />}
            <h2 id={titleId} className="dialog-title" tabIndex={-1}>{title}</h2>
          </div>
          {description && <p id={descriptionId} className="dialog-description">{description}</p>}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>
          <X size={20} />
        </button>
      </header>
      <div className="dialog-content">{children}</div>
    </dialog>,
    document.body
  );
}
