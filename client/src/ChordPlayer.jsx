import { useState, useEffect, useRef } from 'react'
import Soundfont from 'soundfont-player'
import { getDiatonicChords, getChromaticChords, CHORD_NOTES, ALL_KEYS } from './utils/musicTheory'
import { COLORS } from './theme'
import SavedProgressions from './SavedProgressions'

const STRUM_DELAY = 0.04

const RHYTHM_PATTERNS = {
  whole:   { label: '1/1',  beats: [0],                               title: 'Whole note — one strum per bar' },
  half:    { label: '1/2',  beats: [0, 2],                            title: 'Half notes — strum on beats 1 and 3' },
  quarter: { label: '1/4',  beats: [0, 1, 2, 3],                      title: 'Quarter notes — strum on every beat' },
  eighth:  { label: '1/8',  beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], title: 'Eighth notes — strum every half beat' },
  dotted:  { label: '1/4.', beats: [0, 1.5, 3],                       title: 'Dotted quarter — strum every 1.5 beats' },
  sync:    { label: 'sync', beats: [0, 0.75, 1.5, 2.5, 3],            title: 'Syncopated' },
}

export default function ChordPlayer({ suggestedKey, emotion }) {
  const [selectedKey, setSelectedKey] = useState(suggestedKey)
  const [progression, setProgression] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [loop, setLoop] = useState(false)
  const [activeIndex, setActiveIndex] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [bpm, setBpm] = useState(90)
  const [rhythm, setRhythm] = useState('quarter')
  const [tapTimes, setTapTimes] = useState([])
  const [tapping, setTapping] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)

  const instrumentRef = useRef(null)
  const acRef = useRef(null)
  const stopRef = useRef(false)
  const sessionRef = useRef(0)
  const tapFlashRef = useRef(null)

  const [saveTitle, setSaveTitle] = useState('')
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bridge-progressions')) || []
    } catch { return [] }
  })

  const saveProgression = () => {
    if (!saveTitle.trim() || progression.length === 0) return
    const entry = {
      title: saveTitle.trim(),
      key: selectedKey,
      emotion,
      chords: progression,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...saved]
    setSaved(updated)
    localStorage.setItem('bridge-progressions', JSON.stringify(updated))
    setSaveTitle('')
  }

  const deleteProgression = (index) => {
    const updated = saved.filter((_, i) => i !== index)
    setSaved(updated)
    localStorage.setItem('bridge-progressions', JSON.stringify(updated))
  }

  const loadProgression = (item) => {
    setSelectedKey(item.key)
    setProgression(item.chords)
  }

  useEffect(() => {
    setSelectedKey(suggestedKey)
    setProgression([])
    setIsPlaying(false)
    setActiveIndex(null)
  }, [suggestedKey])

  useEffect(() => {
    return () => {
      if (acRef.current && acRef.current.state !== 'closed') acRef.current.close()
    }
  }, [])

  const diatonicChords = getDiatonicChords(selectedKey)

  const addChord = (chord) => {
    setProgression(prev => [...prev, { ...chord, id: Date.now() + Math.random() }])
  }

  const removeChord = (id) => {
    setProgression(prev => prev.filter(c => c.id !== id))
  }

  const handleDragStart = (index) => setDragIndex(index)
  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const reordered = [...progression]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(index, 0, moved)
    setProgression(reordered)
    setDragIndex(index)
  }
  const handleDragEnd = () => setDragIndex(null)

  const handleTap = () => {
    const now = Date.now()
    setTapping(true)
    if (tapFlashRef.current) clearTimeout(tapFlashRef.current)
    tapFlashRef.current = setTimeout(() => setTapping(false), 100)

    setTapTimes(prev => {
      const recent = [...prev, now].filter(t => now - t < 3000)
      if (recent.length >= 2) {
        const intervals = []
        for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1])
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const tappedBpm = Math.round(60000 / avg)
        setBpm(Math.min(200, Math.max(40, tappedBpm)))
      }
      return recent
    })
  }

  const strumChord = (chordName, absoluteTime) => {
    const guitar = instrumentRef.current
    const ac = acRef.current
    if (!guitar || !ac) return
    const notes = CHORD_NOTES[chordName] || CHORD_NOTES['C']
    notes.forEach((note, i) => {
      guitar.play(note, absoluteTime + i * STRUM_DELAY, { duration: 4 })
    })
  }

  const initAudio = async () => {
    if (acRef.current && acRef.current.state !== 'closed') await acRef.current.close()
    const ac = new AudioContext()
    acRef.current = ac
    const guitar = await Soundfont.instrument(ac, 'acoustic_guitar_nylon')
    instrumentRef.current = guitar
  }

  const playSequence = async () => {
    if (progression.length === 0) return
    const session = ++sessionRef.current
    await initAudio()
    if (session !== sessionRef.current) return
    stopRef.current = false
    setIsPlaying(true)

    const beatDuration = 60 / bpm
    const chordDuration = beatDuration * 4
    const pattern = RHYTHM_PATTERNS[rhythm].beats
    const ac = acRef.current
    const startTime = ac.currentTime + 0.1

    const runLoop = async () => {
      let loopIteration = 0

      while (!stopRef.current && session === sessionRef.current) {
        const loopOffset = loopIteration * progression.length * chordDuration

        progression.forEach((chord, chordIndex) => {
          const chordStart = startTime + loopOffset + chordIndex * chordDuration
          pattern.forEach(beatOffset => {
            strumChord(chord.name, chordStart + beatOffset * beatDuration)
          })
        })

        for (let i = 0; i < progression.length; i++) {
          if (stopRef.current || session !== sessionRef.current) break
          const chordAudioTime = startTime + loopOffset + i * chordDuration
          const msUntilChord = (chordAudioTime - ac.currentTime) * 1000
          await new Promise(r => setTimeout(r, Math.max(0, msUntilChord)))
          if (stopRef.current || session !== sessionRef.current) break
          setActiveIndex(i)
        }

        const loopEndTime = startTime + loopOffset + progression.length * chordDuration
        const msUntilEnd = (loopEndTime - ac.currentTime) * 1000
        await new Promise(r => setTimeout(r, Math.max(0, msUntilEnd)))

        if (!loop || stopRef.current || session !== sessionRef.current) break
        loopIteration++
      }

      if (session === sessionRef.current) {
        setIsPlaying(false)
        setActiveIndex(null)
      }
    }

    runLoop()
  }

  const stop = () => {
    sessionRef.current++
    stopRef.current = true
    if (acRef.current && acRef.current.state !== 'closed') acRef.current.close()
    setIsPlaying(false)
    setActiveIndex(null)
  }

  return (
    <div style={s.container}>
      <div style={s.columns}>

        {/* LEFT: key + chords */}
        <div style={s.leftCol}>

          <div style={s.block}>
            <span style={s.label}>Key</span>
            <div style={s.keyRow}>
              <select
                value={selectedKey}
                onChange={e => { setSelectedKey(e.target.value); setProgression([]) }}
                disabled={isPlaying}
                style={{ ...s.select, opacity: isPlaying ? 0.4 : 1 }}
              >
                {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <span style={s.emotionTag}>{emotion}</span>
            </div>
          </div>

          <div style={s.block}>
            <span style={s.label}>Diatonic chords</span>
            <div style={s.palette}>
              {diatonicChords.map(chord => (
                <button
                  key={chord.degree}
                  onClick={() => addChord(chord)}
                  disabled={isPlaying}
                  style={{
                    ...s.paletteBtn,
                    opacity: isPlaying ? 0.4 : 1,
                    cursor: isPlaying ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={s.numeral}>{chord.numeral}</span>
                  <span style={s.chordName}>{chord.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chromatic chords */}
          <div style={s.block}>
            <span style={s.label}>Chromatic chords</span>
            {(() => {
              const { borrowed, secondaryDominants, neapolitan, chromaticMediants, passingChords } = getChromaticChords(selectedKey)
              const categories = [
                { key: 'borrowed',           label: 'Borrowed',             chords: borrowed },
                { key: 'secondaryDominants', label: 'Secondary Dominants',  chords: secondaryDominants },
                { key: 'neapolitan',         label: 'Neapolitan',           chords: neapolitan },
                { key: 'chromaticMediants',  label: 'Chromatic Mediants',   chords: chromaticMediants },
                { key: 'passingChords',      label: 'Passing Chords',       chords: passingChords },
              ]

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {categories.map(cat => (
                    <div key={cat.key}>

                      {/* Category header — click to expand/collapse */}
                      <button
                        onClick={() => setOpenCategory(openCategory === cat.key ? null : cat.key)}
                        disabled={isPlaying}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '6px 10px',
                          background: openCategory === cat.key ? COLORS.sunken : 'transparent',
                          border: `1px solid ${openCategory === cat.key ? COLORS.border : 'transparent'}`,
                          borderRadius: '6px',
                          cursor: isPlaying ? 'not-allowed' : 'pointer',
                          color: COLORS.textMuted,
                          fontSize: '11px',
                          letterSpacing: '0.05em',
                          fontFamily: 'inherit',
                          opacity: isPlaying ? 0.4 : 1,
                          transition: 'all 0.1s',
                        }}
                      >
                        <span>{cat.label}</span>
                        <span style={{ fontSize: '10px', color: COLORS.textGhost }}>
                          {openCategory === cat.key ? '▲' : '▼'} {cat.chords.length}
                        </span>
                      </button>

                      {/* Chord chips — shown when category is open */}
                      {openCategory === cat.key && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '5px',
                          padding: '8px 4px 4px 4px',
                        }}>
                          {cat.chords.map((chord, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <button
                                onClick={() => addChord(chord)}
                                disabled={isPlaying}
                                title={chord.why}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '8px 10px',
                                  background: COLORS.surface,
                                  border: `1px dashed ${COLORS.border}`,
                                  borderRadius: '7px',
                                  cursor: isPlaying ? 'not-allowed' : 'pointer',
                                  minWidth: '48px',
                                  opacity: isPlaying ? 0.4 : 1,
                                  transition: 'all 0.1s',
                                  fontFamily: 'inherit',
                                }}
                              >
                                <span style={{
                                  fontSize: '9px',
                                  color: COLORS.textGhost,
                                  fontFamily: 'Georgia, serif',
                                }}>
                                  {chord.numeral}
                                </span>
                                <span style={{
                                  fontSize: '14px',
                                  color: COLORS.textMuted,
                                  fontWeight: 700,
                                }}>
                                  {chord.name}
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tooltip row — shown when category is open */}
                      {openCategory === cat.key && cat.chords.length > 0 && (
                        <p style={{
                          fontSize: '10px',
                          color: COLORS.textGhost,
                          padding: '2px 4px 6px',
                          margin: 0,
                          fontStyle: 'italic',
                        }}>
                          {cat.chords[0].why}
                        </p>
                      )}

                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div style={s.block}>
            <span style={s.label}>
              {progression.length > 0
                ? `Progression (${progression.length}) — drag to reorder`
                : 'Progression'}
            </span>
            <div style={s.sequence}>
              {progression.length === 0 && (
                <span style={s.emptyHint}>add chords above</span>
              )}
              {progression.map((chord, i) => (
                <div
                  key={chord.id}
                  draggable={!isPlaying}
                  onDragStart={() => !isPlaying && handleDragStart(i)}
                  onDragOver={e => !isPlaying && handleDragOver(e, i)}
                  onDragEnd={() => !isPlaying && handleDragEnd()}
                  style={{
                    ...s.seqChord,
                    background: activeIndex === i ? COLORS.primary : COLORS.surface,
                    borderColor: activeIndex === i ? COLORS.primary : COLORS.border,
                    opacity: dragIndex === i ? 0.4 : 1,
                    cursor: isPlaying ? 'default' : 'grab',
                  }}
                >
                  <span style={{
                    fontSize: '9px',
                    color: activeIndex === i ? 'rgba(255,255,255,0.5)' : COLORS.textGhost,
                    fontFamily: 'Georgia, serif'
                  }}>
                    {chord.numeral}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: activeIndex === i ? 'white' : COLORS.primary,
                  }}>
                    {chord.name}
                  </span>
                  <button
                    onClick={() => removeChord(chord.id)}
                    disabled={isPlaying}
                    style={{
                      ...s.removeBtn,
                      opacity: isPlaying ? 0 : 1,
                      pointerEvents: isPlaying ? 'none' : 'auto',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {progression.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <input
            type="text"
            value={saveTitle}
            onChange={e => setSaveTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveProgression()}
            placeholder="Name this progression..."
            style={{
              flex: 1,
              padding: '7px 10px',
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              color: COLORS.textPrimary,
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={saveProgression}
            disabled={!saveTitle.trim()}
            style={{
              padding: '7px 14px',
              background: saveTitle.trim() ? COLORS.primary : COLORS.surface,
              color: saveTitle.trim() ? 'white' : COLORS.textGhost,
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: saveTitle.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            save
          </button>
        </div>
      )}

        {/* DIVIDER */}
        <div style={s.divider} />

        {/* RIGHT: transport */}
        <div style={s.rightCol}>

          <div style={s.block}>
            <span style={s.label}>Tempo</span>
            <div style={s.bpmDisplay}>
              <span style={s.bpmNumber}>{bpm}</span>
              <span style={s.bpmUnit}>BPM</span>
            </div>
            <input
              type="range"
              min={40}
              max={200}
              step={1}
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              disabled={isPlaying}
              style={{
                width: '100%',
                accentColor: COLORS.primary,
                cursor: isPlaying ? 'not-allowed' : 'pointer'
              }}
            />
            <div style={s.sliderRange}>
              <span>40</span>
              <span>200</span>
            </div>
          </div>

          <button
            onClick={handleTap}
            disabled={isPlaying}
            style={{
              ...s.tapBtn,
              background: tapping ? COLORS.primary : COLORS.surface,
              color: tapping ? 'white' : COLORS.textMuted,
              borderColor: tapping ? COLORS.primary : COLORS.border,
              opacity: isPlaying ? 0.4 : 1,
              cursor: isPlaying ? 'not-allowed' : 'pointer',
            }}
          >
            tap tempo
          </button>

          <div style={s.block}>
            <span style={s.label}>Rhythm</span>
            <div style={s.rhythmGrid}>
              {Object.entries(RHYTHM_PATTERNS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setRhythm(key)}
                  disabled={isPlaying}
                  title={val.title}
                  style={{
                    ...s.rhythmBtn,
                    background: rhythm === key ? COLORS.primary : COLORS.surface,
                    color: rhythm === key ? 'white' : COLORS.textMuted,
                    borderColor: rhythm === key ? COLORS.primary : COLORS.border,
                    opacity: isPlaying ? 0.3 : 1,
                    cursor: isPlaying ? 'not-allowed' : 'pointer',
                  }}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.block}>
            <button
              onClick={isPlaying ? stop : playSequence}
              disabled={progression.length === 0}
              style={{
                ...s.playBtn,
                background: isPlaying ? COLORS.danger : progression.length === 0 ? COLORS.surface : COLORS.primary,
                color: progression.length === 0 ? COLORS.textGhost : 'white',
                cursor: progression.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isPlaying ? '■  stop' : '▶  play'}
            </button>
            <label style={s.loopLabel}>
              <input
                type="checkbox"
                checked={loop}
                onChange={e => setLoop(e.target.checked)}
                style={{ marginRight: '6px', accentColor: COLORS.primary }}
              />
              loop
            </label>
          </div>

        </div>
      </div>
      <SavedProgressions
        saved={saved}
        onLoad={loadProgression}
        onDelete={deleteProgression}
      />
    </div>
  )
}

const s = {
  container: {
    marginTop: '24px',
    padding: '24px',
    background: COLORS.bg,
    borderRadius: '14px',
    color: COLORS.textPrimary,
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", monospace',
    border: `1px solid ${COLORS.border}`,
  },
  columns: {
    display: 'flex',
    gap: '0',
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    paddingRight: '24px',
    minWidth: 0,
  },
  divider: {
    width: '1px',
    background: COLORS.border,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  rightCol: {
    width: '148px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingLeft: '24px',
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '10px',
    color: COLORS.textGhost,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  keyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  select: {
    background: COLORS.surface,
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
  emotionTag: {
    fontSize: '10px',
    color: COLORS.textMuted,
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '20px',
    padding: '3px 10px',
    textTransform: 'capitalize',
    letterSpacing: '0.05em',
  },
  palette: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
  },
  paletteBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 10px',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '7px',
    transition: 'border-color 0.1s, background 0.1s',
    minWidth: '48px',
    cursor: 'pointer',
  },
  numeral: {
    fontSize: '9px',
    color: COLORS.textGhost,
    fontFamily: 'Georgia, serif',
  },
  chordName: {
    fontSize: '14px',
    color: COLORS.primary,
    fontWeight: 700,
  },
  sequence: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
    minHeight: '52px',
    padding: '8px',
    background: COLORS.sunken,
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    alignItems: 'center',
  },
  emptyHint: {
    fontSize: '11px',
    color: COLORS.textGhost,
    fontStyle: 'italic',
  },
  seqChord: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
    padding: '7px 10px',
    borderRadius: '6px',
    position: 'relative',
    transition: 'background 0.1s',
    minWidth: '44px',
    userSelect: 'none',
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
  },
  removeBtn: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: COLORS.border,
    color: COLORS.textMuted,
    border: 'none',
    cursor: 'pointer',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  },
  bpmDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
  },
  bpmNumber: {
    fontSize: '32px',
    fontWeight: 700,
    color: COLORS.primary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  bpmUnit: {
    fontSize: '10px',
    color: COLORS.textGhost,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  sliderRange: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: COLORS.textGhost,
  },
  tapBtn: {
    padding: '8px 0',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    fontSize: '11px',
    letterSpacing: '0.08em',
    transition: 'all 0.08s',
    width: '100%',
    fontFamily: 'inherit',
    background: COLORS.surface,
    color: COLORS.textMuted,
    cursor: 'pointer',
  },
  rhythmGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
  },
  rhythmBtn: {
    padding: '7px 0',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 600,
    transition: 'all 0.1s',
    letterSpacing: '0.02em',
    fontFamily: 'inherit',
    background: COLORS.surface,
    color: COLORS.textMuted,
    cursor: 'pointer',
  },
  playBtn: {
    padding: '10px 0',
    borderRadius: '7px',
    border: 'none',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    width: '100%',
    transition: 'background 0.1s',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  loopLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    color: COLORS.textMuted,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
}