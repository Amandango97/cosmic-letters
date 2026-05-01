// LetterList.jsx — inbox / sent list view
// Receives: letters[], currentUser, partnerName, onOpen(letter), onCompose()

export default function LetterList({ letters, currentUser, partnerName, onOpen, onCompose, onLogout }) {
  const [view, setView] = useState('inbox')

  const inbox = letters.filter(l => l.to_user === currentUser.id)
  const sent  = letters.filter(l => l.from_user === currentUser.id)
  const items = view === 'inbox' ? inbox : sent

  const unread = items.filter(l => !l.read_at && l.status !== 'locked')
  const rest   = items.filter(l =>  l.read_at || l.status === 'locked')

  return (
    <div>
      <div className="top-bar">
        <span className="app-name">letters</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-accent" onClick={onCompose}>+ write a letter</button>
          <button className="btn btn-ghost" onClick={onLogout} style={{ fontSize: 11 }}>sign out</button>
        </div>
      </div>

      <div className="tab-bar">
        <button className={view === 'inbox' ? 'on' : ''} onClick={() => setView('inbox')}>
          from {partnerName}
        </button>
        <button className={view === 'sent' ? 'on' : ''} onClick={() => setView('sent')}>
          from me
        </button>
      </div>

      {items.length === 0 && (
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-faint)', textAlign: 'center', padding: '3rem 0' }}>
          nothing here yet
        </p>
      )}

      {view === 'inbox' && unread.length > 0 && (
        <>
          <p className="sec-label">new</p>
          {unread.map(l => <Row key={l.id} letter={l} onOpen={onOpen} />)}
          {rest.length > 0 && <div className="list-divider" />}
          {rest.length > 0 && <p className="sec-label">earlier</p>}
        </>
      )}

      {(view === 'sent' || !unread.length
          ? items
          : rest
        ).map(l => <Row key={l.id} letter={l} onOpen={onOpen} />)
      }
    </div>
  )
}

function Row({ letter: l, onOpen }) {
  const sealed = l.status === 'locked'
  const orbClass = sealed ? 'orb-sealed' : (l.from_label === 'Amanda' ? 'orb-a' : 'orb-b')
  const totalComments = l.comment_count ?? 0

  return (
    <div
      className={`letter-row ${!l.read_at && !sealed ? 'unread' : ''}`}
      onClick={() => onOpen(l)}
    >
      <span className={`orb ${orbClass}`} />
      <span className={`title serif ${l.read_at && !sealed ? 'dim' : ''}`}>{l.title || '(untitled)'}</span>
      {sealed
        ? <span className="tag tag-sealed">sealed</span>
        : totalComments > 0
          ? <span className="cmt-count">{totalComments} comment{totalComments !== 1 ? 's' : ''}</span>
          : <span className="cmt-count" />
      }
      <span className="date">{formatDate(l.created_at)}</span>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'today ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return 'yesterday ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

import { useState } from 'react'
