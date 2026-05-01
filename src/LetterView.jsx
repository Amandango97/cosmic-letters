// LetterView.jsx — open letter with inline margin comments
// Receives: letter, comments[], currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment

import { useState, useRef, useEffect } from 'react'

export default function LetterView({ letter, comments, currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment, onDelete }) {
  const [spans, setSpans]           = useState(buildSpansFromComments(comments))
  const [pendingSpan, setPending]   = useState(null)  // { id, text, top }
  const [replyText, setReplyText]   = useState({})    // spanId -> string
  const [newCmtText, setNewCmtText] = useState('')
  const bodyRef = useRef(null)
  const tipRef  = useRef(null)

  // Re-derive spans when comments change
  useEffect(() => {
    setSpans(buildSpansFromComments(comments))
  }, [comments])

  // ── Sealed view ──────────────────────────────────────────────
  if (letter.status === 'locked' && !isAuthor) {
    return (
      <div>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.1rem' }}>← back</button>
        <div className="card">
          <div className="sealed-view">
            <div className="seal-icon"><div className="seal-circle" /></div>
            <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--sealed-text)', fontSize: 15, marginBottom: 6 }}>
              This letter is sealed
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting to be opened to you</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Build annotated body HTML ────────────────────────────────
  function buildBody() {
    let html = letter.body || ''
    spans.forEach(sp => {
      const esc = sp.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      html = html.replace(
        new RegExp(esc),
        `<span class="hl ${sp.id === pendingSpan?.id || sp.active ? 'active' : ''}" data-span="${sp.id}">${sp.text}</span>`
      )
    })
    return html.split('\n').map(l => l === '' ? '<br>' : l).join('\n')
  }

  // ── Selection handler ────────────────────────────────────────
  function handleMouseUp() {
    const sel = window.getSelection()
    console.log('mouseup fired')
    console.log('selection:', sel?.toString())
    console.log('tipRef:', tipRef.current)
    
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      tipRef.current.style.display = 'none'
      return
    }
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    const wr    = bodyRef.current.getBoundingClientRect()
    
    console.log('rect:', rect)
    console.log('wr:', wr)
    console.log('left:', Math.max(0, rect.left - wr.left + rect.width / 2 - 45))
    console.log('top:', rect.top - wr.top - 36)
    
    const rawTop = rect.top - wr.top - 36
tipRef.current.style.display = 'block'
tipRef.current.style.left    = Math.max(0, rect.left - wr.left + rect.width / 2 - 45) + 'px'
tipRef.current.style.top     = Math.max(0, rawTop) + 'px'
  }

  function startComment() {
    const sel  = window.getSelection()
    if (!sel || !sel.toString().trim()) return
    const text = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    const wr    = bodyRef.current.getBoundingClientRect()
    sel.removeAllRanges()
    tipRef.current.style.display = 'none'
    const id = 'pending-' + Date.now()
    setPending({ id, text, top: rect.top - wr.top })
    setNewCmtText('')
  }

  async function saveNewComment() {
    if (!newCmtText.trim() || !pendingSpan) return
    await onAddComment({ spanText: pendingSpan.text, body: newCmtText.trim() })
    setPending(null)
    setNewCmtText('')
  }

  function cancelPending() { setPending(null); setNewCmtText('') }

  async function saveReply(spanId, spanText) {
    const txt = (replyText[spanId] || '').trim()
    if (!txt) return
    await onAddComment({ spanText, body: txt })
    setReplyText(r => ({ ...r, [spanId]: '' }))
  }

  function focusSpan(spanId) {
    document.querySelectorAll('.hl').forEach(e => e.classList.remove('active'))
    document.getElementById('hl-' + spanId)?.classList.add('active')
    document.getElementById('mg-' + spanId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // --- Delete handler ---

  function deleteLetter() {
    if (!window.confirm('Delete this letter? This can\'t be undone.')) return
    onDelete()
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.1rem' }}>← back</button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Letter paper */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="letter-meta">
              <span>
                <span style={{ color: letter.from_label === 'Amanda' ? 'var(--accent-a)' : 'var(--accent-b)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.12em' }}>
                  {letter.from_label}
                </span>
                <span style={{ marginLeft: 10 }}>{letter.title}</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{formatDate(letter.created_at)}</span>
              {isAuthor && letter.status === 'open'   && <button className="btn btn-sealed" style={{ fontSize: 11, padding: '3px 10px' }} onClick={onSeal}>seal</button>}
              {isAuthor && letter.status === 'locked' && <button className="btn btn-open"   style={{ fontSize: 11, padding: '3px 10px' }} onClick={onUnseal}>unseal</button>}
              {isAuthor && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: '#f87171' }} onClick={deleteLetter}>delete</button>}
            </div>
            </div>

            {/* Body with span click handlers */}
            <div style={{ position: 'relative', overflow: 'visible' }}>
              <div
                ref={bodyRef}
                className="letter-body"
                onMouseUp={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: buildBody() }}
                onClick={e => {
                  const id = e.target.dataset?.span
                  if (id) focusSpan(id)
                }}
              />
              <div ref={tipRef} className="sel-tip">
                <button onClick={startComment}>+ comment</button>
              </div>
            </div>

          </div>
          <p style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', marginTop: 6 }}>
            select text to leave a comment
          </p>
        </div>

        {/* Margin */}
        <div className="margin-col">
          {spans.length === 0 && !pendingSpan && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', paddingTop: '1rem' }}>
              no comments yet
            </p>
          )}

          {spans.map(sp => (
            <div key={sp.id} id={'mg-' + sp.id} style={{ marginBottom: 10 }}>
              {sp.comments.map((c, i) => (
                <div key={i} className="cmt-bubble">
                  <div className={`who who-${c.author_label?.toLowerCase()}`}>{c.author_label}</div>
                  <div className="body">{c.body}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                <input
                  className="cmt-input"
                  style={{ flex: 1, fontSize: 11 }}
                  placeholder={`reply as ${currentUser.label}…`}
                  value={replyText[sp.id] || ''}
                  onChange={e => setReplyText(r => ({ ...r, [sp.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveReply(sp.id, sp.text)}
                />
                <button className="btn btn-accent" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => saveReply(sp.id, sp.text)}>↩</button>
              </div>
            </div>
          ))}

          {pendingSpan && (
            <div className="new-cmt-box">
              <p style={{ fontSize: 10, color: 'var(--sealed-text)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                new comment · {currentUser.label}
              </p>
              <textarea
                className="cmt-input"
                autoFocus
                placeholder="write a comment…"
                value={newCmtText}
                rows={3}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
                onChange={e => setNewCmtText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && saveNewComment()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-accent" style={{ fontSize: 11, padding: '4px 10px' }} onClick={saveNewComment}>save</button>
                <button className="btn btn-ghost"  style={{ fontSize: 11, padding: '4px 10px' }} onClick={cancelPending}>cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function buildSpansFromComments(comments) {
  // Group flat comments by span_text to recreate span groups
  const map = {}
  ;(comments || []).forEach(c => {
    const key = c.span_text
    if (!map[key]) map[key] = { id: 'span-' + btoa(key).slice(0, 8), text: key, comments: [] }
    map[key].comments.push(c)
  })
  return Object.values(map)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (now - d < 86400000 && d.getDate() === now.getDate()) return 'today'
  if (now - d < 172800000) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
