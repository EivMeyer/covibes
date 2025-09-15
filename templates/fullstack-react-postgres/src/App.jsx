import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [entries, setEntries] = useState([])
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Detect if we're in an iframe and construct the proper API base URL
  const getApiBase = () => {
    // If we're being proxied, use the current path as base
    if (window.location.pathname.includes('/api/preview/proxy/')) {
      // We're at something like /api/preview/proxy/demo-team-001/main/
      // So API calls should go to the same base path + /api/entries
      const basePath = window.location.pathname.replace(/\/$/, '');
      return basePath + '/api';
    }
    // Otherwise use normal /api
    return '/api';
  }

  const apiBase = getApiBase();

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    try {
      const response = await fetch(apiBase + '/entries')
      if (!response.ok) throw new Error('Failed to fetch entries')
      const data = await response.json()
      setEntries(data)
    } catch (err) {
      console.error('Error fetching entries:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiBase + '/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to submit')
      
      setFormData({ name: '', email: '', message: '' })
      await fetchEntries()
    } catch (err) {
      setError('Failed to submit entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const response = await fetch(apiBase + '/entries/' + id, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete entry')
      
      await fetchEntries()
    } catch (err) {
      console.error('Error deleting entry:', err)
    }
  }

  return (
    <div className="gradient-bg">
      <div className="container">
        <header>
          <h1>✨ Full Stack Demo</h1>
          <p className="subtitle">
            <span className="live-indicator"></span>
            React + Express + PostgreSQL
          </p>
        </header>

        <div className="card form-container">
          <h2>💬 Add Your Entry</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <textarea
                placeholder="Share your thoughts..."
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
              />
            </div>
            <div className="button-group">
              <button type="submit" disabled={loading}>
                {loading ? '⏳ Submitting...' : '🚀 Submit Entry'}
              </button>
            </div>
            {error && <div className="error">❌ {error}</div>}
          </form>
        </div>

        <div className="entries-container">
          <h2>📋 Recent Entries ({entries.length})</h2>
          {entries.length === 0 ? (
            <div className="card">
              <p className="instruction">🎯 No entries yet. Be the first to add one above!</p>
            </div>
          ) : (
            <div className="entries-list">
              {entries.map(entry => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-header">
                    <h3>👤 {entry.name}</h3>
                    <button onClick={() => handleDelete(entry.id)} className="delete-btn">
                      🗑️
                    </button>
                  </div>
                  {entry.email && <p className="entry-email">📧 {entry.email}</p>}
                  {entry.message && <p className="entry-message">💭 {entry.message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer>
          <div className="team-badge">TEAM_ID_PLACEHOLDER</div>
          <div className="version">ColabVibe Preview ✨</div>
        </footer>
      </div>
    </div>
  )
}

export default App
