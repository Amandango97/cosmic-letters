import { useState, useEffect } from 'react'

export default function CommentsList({ comments, currentUser, onEditComment, onDeleteComment, onReactToComment, onFocusSpan }) {
  const [editingComment, setEditingComment] = useState(null)
  const [editCommentText, setEditCommentText] = useState('')
  const [hoveredComment, setHoveredComment] = useState(null)
  const [hoveredEdit, setHoveredEdit] = useState(null)
  const [hoveredDelete, setHoveredDelete] = useState(null)
  const [emojiPickerFor, setEmojiPickerFor] = useState(null)

  useEffect(() => {
    function handleClick() { setEmojiPickerFor(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])
  
  if (!comments?.length) return null

  return (
    <>
      {comments.map((c, i) => (
        <div
          key={i}
          className="cmt-bubble"
          style={{ marginBottom: 10, position: 'relative', paddingBottom: 14, cursor: onFocusSpan ? 'pointer' : 'default' }}
          onClick={() => !editingComment && onFocusSpan?.(c.span_text)}
          onMouseEnter={() => setHoveredComment(c.id)}
          onMouseLeave={() => setHoveredComment(null)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className={`who who-${c.author_label?.toLowerCase()}`}>{c.author_label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{formatDate(c.created_at)}</div>
          </div>

          {editingComment === c.id ? (
            <div onClick={e => e.stopPropagation()}>
              <textarea
                className="cmt-input"
                value={editCommentText}
                autoFocus
                style={{ resize: 'vertical', lineHeight: 1.5, width: '100%' }}
                onChange={e => setEditCommentText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button className="btn btn-accent" style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => { onEditComment(c.id, editCommentText); setEditingComment(null) }}>save</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setEditingComment(null)}>cancel</button>
              </div>
            </div>
          ) : (
            <div className="body" style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.body}</div>
          )}

          {/* Reactions */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, minHeight: 28, alignItems: 'center' }}>
            {Object.entries(c.reactions || {}).map(([emoji, users]) => (
              users.length > 0 && (
                <button
                  key={emoji}
                  onClick={e => { e.stopPropagation(); onReactToComment(c.id, emoji, c.reactions) }}
                  style={{
                    background: users.includes(currentUser.id) ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `0.5px solid ${users.includes(currentUser.id) ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 'var(--radius-pill)',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {emoji} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{users.length}</span>
                </button>
              )
            ))}
            <div style={{ position: 'relative', opacity: hoveredComment === c.id && editingComment !== c.id ? 1 : 0, transition: 'opacity 0.15s' }}>
              <button
                style={{
                  background: 'none',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}
                onClick={e => {
                  e.stopPropagation()
                  setEmojiPickerFor(emojiPickerFor === c.id ? null : c.id)
                }}
              >+</button>
              {emojiPickerFor === c.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 28,
                    left: 0,
                    background: '#1a1230',
                    border: '0.5px solid var(--border-hover)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    display: 'flex',
                    gap: 6,
                    zIndex: 20,
                  }}
                >
                  {['❤️', '✨', '😢', '😂', '🔥', '👀'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={e => {
                        e.stopPropagation()
                        onReactToComment(c.id, emoji, c.reactions)
                        setEmojiPickerFor(null)
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {c.author_id === currentUser.id && hoveredComment === c.id && editingComment !== c.id && (
            <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); setEditingComment(c.id); setEditCommentText(c.body) }}
                onMouseEnter={() => setHoveredEdit(c.id)}
                onMouseLeave={() => setHoveredEdit(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: hoveredEdit === c.id ? '#ffffff' : 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)', padding: 0, transition: 'color 0.15s',
                }}
              >edit</button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteComment(c.id) }}
                onMouseEnter={() => setHoveredDelete(c.id)}
                onMouseLeave={() => setHoveredDelete(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: hoveredDelete === c.id ? '#ffffff' : '#f87171',
                  fontFamily: 'var(--font-sans)', padding: 0, transition: 'color 0.15s',
                }}
              >delete</button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 172800000) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}