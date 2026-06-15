import { COLORS } from './theme'

export default function SavedProgressions({ saved, onLoad, onDelete }) {
  if (saved.length === 0) return null

  return (
    <div style={s.container}>
      <span style={s.label}>Saved progressions</span>
      <div style={s.list}>
        {saved.map((item, i) => (
          <div key={i} style={s.item}>
            <div style={s.itemLeft}>
              <span style={s.title}>{item.title}</span>
              <span style={s.meta}>
                {item.key} · {item.emotion} · {item.chords.map(c => c.name).join(' – ')}
              </span>
            </div>
            <div style={s.actions}>
              <button onClick={() => onLoad(item)} style={s.loadBtn}>load</button>
              <button onClick={() => onDelete(i)} style={s.deleteBtn}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  container: {
    marginTop: '16px',
    padding: '16px',
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
  },
  label: {
    fontSize: '10px',
    color: COLORS.textGhost,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    display: 'block',
    marginBottom: '10px',
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    gap: '12px',
  },
  itemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.textPrimary,
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  meta: {
    fontSize: '11px',
    color: COLORS.textGhost,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  loadBtn: {
    padding: '4px 10px',
    background: COLORS.primary,
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: '"SF Mono", "Fira Code", monospace',
    letterSpacing: '0.05em',
  },
  deleteBtn: {
    padding: '4px 8px',
    background: 'transparent',
    color: COLORS.textGhost,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '5px',
    fontSize: '12px',
    cursor: 'pointer',
  },
}