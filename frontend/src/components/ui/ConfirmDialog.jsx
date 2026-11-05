import Dialog from './Dialog';

// A confirmation before something irreversible or surprising. The destructive
// action is never the focused one, so a stray Enter does not carry it out.
export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, description, confirmLabel = 'Confirm', destructive = false
}) {
  return <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description} presentation="confirmation">
    <div className="form-actions">
      <button type="button" className="button button--secondary" onClick={onClose} data-autofocus>Cancel</button>
      <button type="button" className={`button ${destructive ? 'button--danger' : 'button--primary'}`} onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  </Dialog>;
}
