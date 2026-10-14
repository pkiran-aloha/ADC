import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from './Icons';

import { FeedbackContext } from '../../utils/useFeedback';

export function FeedbackProvider({ children }) {
  const [message, setMessage] = useState(null);
  const notify = useCallback((text, type = 'success') => setMessage({ text, type, id: Date.now() }), []);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), message.type === 'error' ? 10000 : 5500);
    return () => clearTimeout(timeout);
  }, [message]);
  return <FeedbackContext.Provider value={notify}>
    {children}
    <div className="notification-region" aria-live="polite" aria-atomic="true">
      {message && <div className={`notification notification--${message.type}`}>
        {message.type === 'error' ? <AlertCircle size={21} /> : <CheckCircle2 size={21} />}
        <p>{message.text}</p>
        <button className="icon-button" type="button" aria-label="Dismiss notification" onClick={() => setMessage(null)}><X size={18} /></button>
      </div>}
    </div>
  </FeedbackContext.Provider>;
}
