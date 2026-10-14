import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import './index.css'
import App from './App.jsx'
import { FeedbackProvider } from './components/ui/Feedback'
import ErrorBoundary from './components/ui/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'regular', 'aria-hidden': true, focusable: false }}>
      <ErrorBoundary>
        <FeedbackProvider><App /></FeedbackProvider>
      </ErrorBoundary>
    </IconContext.Provider>
  </StrictMode>,
)
