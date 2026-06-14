const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

const CHORD_QUALITIES = {
  major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'],
  minor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
}

const ROMAN_NUMERALS = {
  major: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
}

export const KEY_ROOT_MAP = {
  'Am': { root: 'A', scale: 'minor' },
  'Dm': { root: 'D', scale: 'minor' },
  'Em': { root: 'E', scale: 'minor' },
  'Bm': { root: 'B', scale: 'minor' },
  'Fm': { root: 'F', scale: 'minor' },
  'Cm': { root: 'C', scale: 'minor' },
  'Gm': { root: 'G', scale: 'minor' },
  'C':  { root: 'C', scale: 'major' },
  'G':  { root: 'G', scale: 'major' },
  'D':  { root: 'D', scale: 'major' },
  'A':  { root: 'A', scale: 'major' },
  'E':  { root: 'E', scale: 'major' },
  'F':  { root: 'F', scale: 'major' },
  'B':  { root: 'B', scale: 'major' },
}

export const ALL_KEYS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F',
  'Am', 'Em', 'Bm', 'Dm', 'Fm', 'Cm', 'Gm'
]

// Helper: get note at chromatic interval from a root
function noteAt(root, semitones) {
  const rootIndex = CHROMATIC.indexOf(root)
  return CHROMATIC[(rootIndex + semitones + 12) % 12]
}

// Helper: build a chord name from a root and quality
function buildChordName(root, quality) {
  if (quality === 'major') return root
  if (quality === 'minor') return root + 'm'
  if (quality === 'diminished') return root + '°'
  if (quality === 'augmented') return root + 'aug'
  if (quality === 'dominant7') return root + '7'
  return root
}

// Returns the 7 diatonic chords for a given key
export function getDiatonicChords(key) {
  const { root, scale } = KEY_ROOT_MAP[key] || { root: 'C', scale: 'major' }
  const rootIndex = CHROMATIC.indexOf(root)
  const intervals = SCALE_INTERVALS[scale]
  const qualities = CHORD_QUALITIES[scale]
  const numerals = ROMAN_NUMERALS[scale]

  return intervals.map((interval, i) => {
    const note = CHROMATIC[(rootIndex + interval) % 12]
    const quality = qualities[i]
    return {
      numeral: numerals[i],
      name: buildChordName(note, quality),
      quality,
      degree: i,
    }
  })
}

// Returns chromatic chord groups for a given key:
// borrowed, secondary dominants, neapolitan, chromatic mediants, passing
export function getChromaticChords(key) {
  const { root, scale } = KEY_ROOT_MAP[key] || { root: 'C', scale: 'major' }

  // The parallel scale is the opposite mode on the same root
  const parallelScale = scale === 'major' ? 'minor' : 'major'
  const parallelIntervals = SCALE_INTERVALS[parallelScale]
  const parallelQualities = CHORD_QUALITIES[parallelScale]
  const diatonicChords = getDiatonicChords(key)
  const diatonicNames = new Set(diatonicChords.map(c => c.name))

  const rootIndex = CHROMATIC.indexOf(root)

  // ── 1. BORROWED CHORDS ──────────────────────────────────────────
  // Chords from the parallel mode that aren't already diatonic
  // e.g. in C major, borrow from C minor: Fm, Bb, Ab, Eb
  const parallelNumerals = ROMAN_NUMERALS[parallelScale]
  const borrowed = parallelIntervals
    .map((interval, i) => {
      const note = CHROMATIC[(rootIndex + interval) % 12]
      const quality = parallelQualities[i]
      const name = buildChordName(note, quality)
      return {
        numeral: parallelNumerals[i],
        name,
        quality,
        why: `Borrowed from ${scale === 'major' ? 'parallel minor' : 'parallel major'}`,
      }
    })
    .filter(c => !diatonicNames.has(c.name))

  // ── 2. SECONDARY DOMINANTS ──────────────────────────────────────
  // For each diatonic chord (except the diminished vii°),
  // compute its V chord: a major chord a perfect fifth above it.
  // If that V chord isn't already diatonic, it's a secondary dominant.
  const secondaryDominants = diatonicChords
    .filter(c => c.quality !== 'diminished')
    .map(c => {
      // The root of this diatonic chord
      const chordRoot = c.name.replace('m', '').replace('°', '')
      const chordRootIndex = CHROMATIC.indexOf(chordRoot)
      // A fifth above = 7 semitones
      const domRoot = CHROMATIC[(chordRootIndex + 7) % 12]
      const name = domRoot // major chord, no suffix
      const label = `V/${c.numeral}`
      return {
        numeral: label,
        name,
        quality: 'major',
        why: `Secondary dominant — resolves to ${c.name}`,
      }
    })
    .filter(c => !diatonicNames.has(c.name))
    // Deduplicate — some secondary dominants may share a name
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)

  // ── 3. NEAPOLITAN ───────────────────────────────────────────────
  // A major chord built on the flat 2nd degree.
  // e.g. in C major: Db major. Dramatic, resolves to V or I.
  const neapolitanRoot = noteAt(root, 1) // one semitone up
  const neapolitan = [{
    numeral: '♭II',
    name: neapolitanRoot,
    quality: 'major',
    why: 'Neapolitan — dramatic, resolves to V',
  }].filter(c => !diatonicNames.has(c.name))

  // ── 4. CHROMATIC MEDIANTS ────────────────────────────────────────
  // Major/minor chords a major or minor third away from the tonic.
  // They share notes with the tonic chord, so they feel smooth
  // despite being outside the key.
  const chromaticMediants = [
    { semitones: 3,  quality: 'major', numeral: '♭III' },
    { semitones: 3,  quality: 'minor', numeral: '♭iii' },
    { semitones: 4,  quality: 'minor', numeral: 'III'  },
    { semitones: 8,  quality: 'major', numeral: '♭VI'  },
    { semitones: 8,  quality: 'minor', numeral: '♭vi'  },
    { semitones: 9,  quality: 'major', numeral: 'VI'   },
  ]
    .map(({ semitones, quality, numeral }) => {
      const note = noteAt(root, semitones)
      const name = buildChordName(note, quality)
      return {
        numeral,
        name,
        quality,
        why: 'Chromatic mediant — smooth despite being outside the key',
      }
    })
    .filter(c => !diatonicNames.has(c.name))
    .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)

  // ── 5. PASSING CHORDS ────────────────────────────────────────────
  // Diminished 7th and augmented chords used as passing chords
  // between diatonic chords. Short-lived, create tension and motion.
  const passingChords = [
    {
      numeral: 'aug',
      name: buildChordName(root, 'augmented'),
      quality: 'augmented',
      why: 'Augmented I — passing between I and IV',
    },
    {
      numeral: '♭VII',
      name: noteAt(root, 10), // flat 7, major
      quality: 'major',
      why: 'Flat VII — anthemic, borrowed from Mixolydian',
    },
  ].filter(c => !diatonicNames.has(c.name))

  return { borrowed, secondaryDominants, neapolitan, chromaticMediants, passingChords }
}

export const CHORD_NOTES = {
  'C':    ['C3', 'E3', 'G3', 'C4', 'E4'],
  'Cm':   ['C3', 'G3', 'C4', 'D#4', 'G4'],
  'Caug': ['C3', 'E3', 'G#3', 'C4', 'E4'],
  'C#':   ['C#3', 'F3', 'G#3', 'C#4', 'F4'],
  'C#m':  ['C#3', 'G#3', 'C#4', 'E4', 'G#4'],
  'Db':   ['C#3', 'F3', 'G#3', 'C#4', 'F4'],
  'D':    ['D3', 'A3', 'D4', 'F#4', 'A4'],
  'Dm':   ['D3', 'A3', 'D4', 'F4', 'A4'],
  'Daug': ['D3', 'F#3', 'A#3', 'D4', 'F#4'],
  'D#':   ['D#3', 'A#3', 'D#4', 'G4', 'A#4'],
  'Eb':   ['D#3', 'A#3', 'D#4', 'G4', 'A#4'],
  'E':    ['E2', 'B2', 'E3', 'G#3', 'B3'],
  'Em':   ['E2', 'B2', 'E3', 'G3', 'B3'],
  'Eaug': ['E3', 'G#3', 'C4', 'E4', 'G#4'],
  'F':    ['F2', 'C3', 'F3', 'A3', 'C4'],
  'Fm':   ['F2', 'C3', 'F3', 'G#3', 'C4'],
  'Faug': ['F3', 'A3', 'C#4', 'F4', 'A4'],
  'F#':   ['F#2', 'C#3', 'F#3', 'A#3', 'C#4'],
  'F#m':  ['F#2', 'A2', 'C#3', 'F#3', 'A3'],
  'G':    ['G2', 'B2', 'D3', 'G3', 'B3'],
  'Gm':   ['G2', 'D3', 'G3', 'A#3', 'D4'],
  'Gaug': ['G3', 'B3', 'D#4', 'G4', 'B4'],
  'G#':   ['G#2', 'D#3', 'G#3', 'C4', 'D#4'],
  'Ab':   ['G#2', 'D#3', 'G#3', 'C4', 'D#4'],
  'A':    ['A2', 'E3', 'A3', 'C#4', 'E4'],
  'Am':   ['A2', 'E3', 'A3', 'C4', 'E4'],
  'Aaug': ['A3', 'C#4', 'F4', 'A4', 'C#5'],
  'A#':   ['A#2', 'F3', 'A#3', 'D4', 'F4'],
  'Bb':   ['A#2', 'F3', 'A#3', 'D4', 'F4'],
  'B':    ['B2', 'F#3', 'B3', 'D#4', 'F#4'],
  'Bm':   ['B2', 'F#3', 'B3', 'D4', 'F#4'],
  'Baug': ['B3', 'D#4', 'G4', 'B4', 'D#5'],
  // Diminished
  'B°':   ['B2', 'F3', 'B3', 'D4', 'F4'],
  'C#°':  ['C#3', 'G3', 'C#4', 'E4', 'G4'],
  'D°':   ['D3', 'G#3', 'D4', 'F4', 'G#4'],
  'E°':   ['E3', 'A#3', 'E4', 'G4', 'A#4'],
  'F#°':  ['F#3', 'C4', 'F#4', 'A4', 'C5'],
  'G#°':  ['G#3', 'D4', 'G#4', 'B4', 'D5'],
  'A#°':  ['A#3', 'E4', 'A#4', 'C#5', 'E5'],
}