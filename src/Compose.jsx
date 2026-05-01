// Compose.jsx — write a new letter
// Receives: currentUser, partnerName, onSend(title, body, status), onCancel

import { useState } from 'react'

export default function Compose({ currentUser, partnerName, onSend, onCancel }) {
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [saving, setSaving] = useState(false)

  async function send(status) {
    if (!body.trim()) return
    setSaving(true)
    await onSend(title.trim() || '(untitled)', body.trim(), status)
    setSaving(false)
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onCancel} style={{ marginBottom: '1.1rem' }}>← back</button>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          to {partnerName}
        </p>
        <input
          className="compose-title-inp"
          placeholder="subject…"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="compose-body-ta"
          placeholder={`Dear ${partnerName},\n\n…`}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-open"   onClick={() => send('open')}   disabled={saving || !body.trim()}>send open</button>
        <button className="btn btn-sealed" onClick={() => send('locked')} disabled={saving || !body.trim()}>seal &amp; send</button>
        <button className="btn btn-ghost"  onClick={onCancel} style={{ marginLeft: 'auto' }}>cancel</button>
      </div>
    </div>
  )
}
