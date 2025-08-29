import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Temporarily disabled StrictMode to prevent double rendering issues with terminals
// TODO: Re-enable after implementing proper singleton terminal management
createRoot(document.getElementById('root')!).render(
  <App />
)
