import { useState } from 'react'

function App() {
  const [lyrics, setLyrics] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async () => {
    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lyrics })
    })
    const data = await response.json()
    setResult(data)
  }

  return (
    <div>
      <h1>Bridge</h1>
      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Paste your lyrics here..."
        rows={10}
        cols={50}
      />
      <br />
      <button onClick={handleSubmit}>Analyze</button>
      {result && (
        <div>
          <p>Sentiment: {result.sentiment}</p>
          <p>Chords: {result.chords.join(' - ')}</p>
        </div>
      )}
    </div>
  )
}

export default App