import { useState } from 'react'
import ChordPlayer from './ChordPlayer'
import { COLORS } from './theme'

function App() {
  const [lyrics, setLyrics] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

  const handleSubmit = async () => {
    if (!lyrics.trim()) return
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics })
      })
      const data = await response.json()
      setResult(data)
    } catch (e) {
      console.error('Failed to reach server:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', background: COLORS.pageBg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '4px', color: COLORS.textPrimary, fontWeight: 700 }}>Bridge</h1>
      <p style={{ color: COLORS.textMuted, marginBottom: '24px', fontSize: '14px' }}>
        Paste your lyrics. Get a key and chords that match.
      </p>
      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Lyrics here..."
        rows={8}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '15px',
          borderRadius: '8px',
          border: `1px solid ${COLORS.border}`,
          resize: 'vertical',
          boxSizing: 'border-box',
          background: COLORS.surface,
          color: COLORS.textPrimary,
          fontFamily: 'sans-serif',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: '12px',
          padding: '10px 24px',
          background: loading ? COLORS.surface : COLORS.primary,
          color: loading ? COLORS.textGhost : 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {result && (
        <ChordPlayer
          suggestedKey={result.suggested_key}
          emotion={result.emotion}
        />
      )}
    </div>
  )
}

export default App