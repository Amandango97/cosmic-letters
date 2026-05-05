// LetterView.jsx — open letter with inline margin comments
// Receives: letter, comments[], currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import { supabase } from './supabase'
import remarkGfm from 'remark-gfm'
import rehypeExternalLinks from 'rehype-external-links'

export default function LetterView({ letter, comments, currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment, onDelete, onEdit, onDeleteComment, onEditComment, onSendDraft, commentsLoading, onReactToComment, onReactToLetter }) {
  const [spans, setSpans] = useState(buildSpansFromComments(comments, letter.body))
  const [pendingSpan, setPending]   = useState(null)  // { id, text, top }
  const [replyText, setReplyText]   = useState({})    // spanId -> string
  const [newCmtText, setNewCmtText] = useState('')
  const bodyRef = useRef(null)
  const tipRef  = useRef(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(letter.title)
  const [editBody, setEditBody]   = useState(letter.body)
  const [dragging, setDragging] = useState(false)
  const editTaRef = useRef(null)
  const [hoveredComment, setHoveredComment] = useState(null)
  const [hoveredDelete, setHoveredDelete] = useState(null)
  const [editingComment, setEditingComment] = useState(null) // comment id
  const [editCommentText, setEditCommentText] = useState('')
  const [hoveredEdit, setHoveredEdit] = useState(null)
  const editCommentTaRef = useRef(null)
  const [emojiPickerFor, setEmojiPickerFor] = useState(null)
  const editAutoSaveTimer = useRef(null)
  const [editAutoSaved, setEditAutoSaved] = useState(false)

  // Re-derive spans when comments change
  useEffect(() => {
    setSpans(buildSpansFromComments(comments, letter.body))
  }, [comments, letter.body])

  useEffect(() => {
  if (editing && editTaRef.current) {
    editTaRef.current.style.height = 'auto'
    editTaRef.current.style.height = editTaRef.current.scrollHeight + 'px'
  }
}, [editing])

useEffect(() => {
  if (editingComment && editCommentTaRef.current) {
    editCommentTaRef.current.style.height = 'auto'
    editCommentTaRef.current.style.height = editCommentTaRef.current.scrollHeight + 'px'
  }
}, [editingComment])

useEffect(() => {
  function handleClick() { setEmojiPickerFor(null) }
  document.addEventListener('click', handleClick)
  return () => document.removeEventListener('click', handleClick)
}, [])

useEffect(() => {
  if (!editing || !editBody.trim()) return
  setEditAutoSaved(false)
  clearTimeout(editAutoSaveTimer.current)
  editAutoSaveTimer.current = setTimeout(async () => {
    await onEdit(editTitle.trim() || '(untitled)', editBody.trim())
    setEditAutoSaved(true)
  }, 500)
  return () => clearTimeout(editAutoSaveTimer.current)
}, [editBody, editTitle, editing])

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
  const md = letter.body || ''
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeExternalLinks, { target: '_blank', rel: ['nofollow'] })
    .use(rehypeStringify)
    .processSync(md)
  let html = String(file)

  // Sort spans by their position in the original markdown (longest first to avoid partial overlaps)
  const sorted = [...spans].sort((a, b) => {
    const posA = md.indexOf(a.text)
    const posB = md.indexOf(b.text)
    return posA - posB
  })

  sorted.forEach(sp => {
    // Strip tags from current html to find plain-text position
    const plain = html.replace(/<[^>]+>/g, '')
    const idx = plain.indexOf(sp.text)
    if (idx === -1) return

    // Walk the html char by char, counting only non-tag chars
    let plainCount = 0
    let startPos = -1
    let endPos = -1
    let inTag = false

    for (let i = 0; i < html.length; i++) {
      if (html[i] === '<') { inTag = true; continue }
      if (html[i] === '>') { inTag = false; continue }
      if (inTag) continue

      if (plainCount === idx) startPos = i
      if (plainCount === idx + sp.text.length) { endPos = i; break }
      plainCount++
    }

    if (startPos === -1 || endPos === -1) return

    // Find the real html positions accounting for tags we skipped
    // Re-walk to get actual string indices
    let pCount = 0
    let htmlStart = -1
    let htmlEnd = -1
    let inT = false

    for (let i = 0; i < html.length; i++) {
      if (html[i] === '<') { inT = true }
      if (html[i] === '>') { inT = false; continue }
      if (inT) continue

      if (pCount === idx) htmlStart = i
      if (pCount === idx + sp.text.length) { htmlEnd = i; break }
      pCount++
    }

    if (htmlStart === -1 || htmlEnd === -1) return

    const before = html.slice(0, htmlStart)
    const middle = html.slice(htmlStart, htmlEnd)
    const after  = html.slice(htmlEnd)
    html = `${before}<span class="hl" id="hl-${sp.id}" data-span="${sp.id}">${middle}</span>${after}`
  })

  return html
}

  // -- Edit handler -----

  async function saveEdit() {
    clearTimeout(editAutoSaveTimer.current)
    await onEdit(editTitle.trim() || '(untitled)', editBody.trim())
    setEditing(false)
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
    const mgEl = document.getElementById('mg-' + spanId)
    if (mgEl) {
      mgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      mgEl.classList.add('mg-active')
      setTimeout(() => mgEl.classList.remove('mg-active'), 1500)
    }
  }

  const autoResize = useCallback((e) => {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

  // --- Delete handler ---

  function deleteLetter() {
    if (!window.confirm('Delete this letter? This can\'t be undone.')) return
    onDelete()
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.1rem' }}>← back</button>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }} className="letter-view-layout">

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
              {isAuthor && letter.status === 'draft' && (
                <>
                  <button className="btn btn-open" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => onSendDraft('open')}>send</button>
                  <button className="btn btn-sealed" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => onSendDraft('locked')}>seal & send</button>
                </>
              )}
              {editing && (
                <>
                  <button className="btn btn-accent" style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={saveEdit}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: editAutoSaved ? '#7ecba1' : '#c4874a', transition: 'background 0.6s', flexShrink: 0 }} />
                    save
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditing(false)}>cancel</button>
                </>
              )}
              {isAuthor && !editing && (
                <button
                  className="icon-btn"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setEditing(true); setEditTitle(letter.title); setEditBody(letter.body) }}
                  title="edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              {isAuthor && (
                <button
                  className="icon-btn icon-btn-danger"
                  onClick={deleteLetter}
                  title="delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
            </div>

            {/* Body with span click handlers */}
            <div style={{ position: 'relative', overflow: 'visible' }}>
              {editing ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={async e => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (!file) return
                    const isImage = file.type.startsWith('image/')
                    const isAudio = file.type.startsWith('audio/')
                    if (!isImage && !isAudio) return
                    const ext = file.name.split('.').pop()
                    const path = `${currentUser.id}/${Date.now()}.${ext}`
                    const { error } = await supabase.storage.from('letter-images').upload(path, file)
                    if (error) return
                    const { data } = supabase.storage.from('letter-images').getPublicUrl(path)
                    const ta = editTaRef.current
                    const start = ta.selectionStart
                    const end = ta.selectionEnd
                    const insertion = isAudio
                      ? `\n<audio controls src="${data.publicUrl}"></audio>\n`
                      : `\n![](${data.publicUrl})\n`
                    setEditBody(b => b.slice(0, start) + insertion + b.slice(end))
                  }}
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    outline: dragging ? '2px dashed var(--accent-a)' : '2px solid transparent',
                    transition: 'outline 0.15s',
                  }}
                >
                  <input
                    className="compose-title-inp"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    style={{ marginBottom: 14 }}
                  />
                  <textarea
                    ref={editTaRef}
                    className="compose-body-ta"
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    style={{ minHeight: 300, overflow: 'hidden' }}
                    onInput={autoResize}
                  />
                  {dragging && <p style={{ fontSize: 11, color: 'var(--accent-a)', marginTop: 6 }}>drop to insert image</p>}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

          </div>
        </div>

        {/* Margin */}
        <div className="margin-col">
            <span className="margin-col-label">comments</span>

            {/* Letter reactions */}
            {!editing && (
              <div style={{ marginBottom: '1.2rem', paddingBottom: '1rem', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['❤️', '✨', '😢', '😂', '🔥', '👀'].map(emoji => {
                  const users = letter.reactions?.[emoji] || []
                  const reacted = users.includes(currentUser.id)
                  return (
                    <button
                      key={emoji}
                      onClick={() => onReactToLetter(emoji, letter.reactions || {})}
                      style={{
                        background: reacted ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `0.5px solid ${reacted ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      {emoji}
                      {users.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{users.length}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {spans.length === 0 && !pendingSpan && (
            <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 6 }}>
                {commentsLoading ? 'loading…' : 'no comments yet'}
              </p>
              {!editing && !commentsLoading && (
                <p style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
                  select text to leave a comment
                </p>
              )}
            </div>
          )}

          {spans.map(sp => (
            <div key={sp.id} id={'mg-' + sp.id} style={{ marginBottom: 10 }}>
              {sp.comments.map((c, i) => (
                <div
                  key={i}
                  className="cmt-bubble"
                  style={{ cursor: 'pointer', position: 'relative', paddingBottom: 14 }}
                  onClick={() => !editingComment && focusSpan(sp.id)}
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
                        ref={editCommentTaRef}
                        className="cmt-input"
                        value={editCommentText}
                        autoFocus
                        onInput={autoResize}
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
                    <div className="body" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
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
              <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                <textarea
                  className="cmt-input"
                  style={{ flex: 1, resize: 'none', overflow: 'hidden', lineHeight: 1.5 }}
                  placeholder="Reply"
                  value={replyText[sp.id] || ''}
                  rows={1}
                  onChange={e => setReplyText(r => ({ ...r, [sp.id]: e.target.value }))}
                  onInput={autoResize}
                />
                <button className="btn btn-accent" style={{ padding: '3px 8px', fontSize: 11, alignSelf: 'flex-end' }} onClick={() => saveReply(sp.id, sp.text)}>↩</button>
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
                onInput={autoResize}
                style={{ resize: 'vertical', lineHeight: 1.5, overflow: 'hidden' }}
                onChange={e => setNewCmtText(e.target.value)}
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

function buildSpansFromComments(comments, letterBody) {
  const map = {}
  ;(comments || []).forEach(c => {
    const key = c.span_text
    if (!map[key]) map[key] = { id: 'span-' + Math.abs(key.split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)).toString(36), text: key, comments: [] }
    map[key].comments.push(c)
  })
  const spans = Object.values(map)
  if (letterBody) {
    spans.sort((a, b) => letterBody.indexOf(a.text) - letterBody.indexOf(b.text))
  }
  return spans
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