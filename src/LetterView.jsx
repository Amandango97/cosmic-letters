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

export default function LetterView({ letter, comments, currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment, onDelete, onEdit, onDeleteComment, onEditComment, onSendDraft, commentsLoading }) {
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
              {isAuthor && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: '#f87171' }} onClick={deleteLetter}>delete</button>}
              {isAuthor && !editing && (
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setEditing(true); setEditTitle(letter.title); setEditBody(letter.body) }}>edit</button>
              )}
              {isAuthor && letter.status === 'draft' && (
                <>
                  <button className="btn btn-open" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => onSendDraft('open')}>send</button>
                  <button className="btn btn-sealed" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => onSendDraft('locked')}>seal & send</button>
                </>
              )}
              {editing && (
                <>
                  <button className="btn btn-accent" style={{ fontSize: 11, padding: '3px 10px' }} onClick={saveEdit}>save</button>
                  <button className="btn btn-ghost"  style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditing(false)}>cancel</button>
                </>
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
                    if (!file?.type.startsWith('image/')) return
                    const ext = file.name.split('.').pop()
                    const path = `${currentUser.id}/${Date.now()}.${ext}`
                    const { error } = await supabase.storage.from('letter-images').upload(path, file)
                    if (error) return
                    const { data } = supabase.storage.from('letter-images').getPublicUrl(path)
                    const ta = editTaRef.current
                    const start = ta.selectionStart
                    const end = ta.selectionEnd
                    const insertion = `\n![](${data.publicUrl})\n`
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
          <p style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', marginTop: 6 }}>
            {editing ? '' : 'select text to leave a comment'}
          </p>
        </div>

        {/* Margin */}
        <div className="margin-col">
          <span className="margin-col-label">comments</span>
          {spans.length === 0 && !pendingSpan && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', paddingTop: '1rem' }}>
              {commentsLoading && spans.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', paddingTop: '1rem' }}>
                  loading…
                </p>
              ) : spans.length === 0 && !pendingSpan ? (
                <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', paddingTop: '1rem' }}>
                  no comments yet
                </p>
              ) : null}
            </p>
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
                <input
                  className="cmt-input"
                  style={{ flex: 1 }}
                  placeholder={`Reply`}
                  value={replyText[sp.id] || ''}
                  onChange={e => setReplyText(r => ({ ...r, [sp.id]: e.target.value }))}
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