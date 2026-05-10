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
import CommentsList from './CommentsList'

export default function LetterView({ letter, comments, currentUser, isAuthor, onBack, onSeal, onUnseal, onAddComment, onDelete, onOpenEdit, onDeleteComment, onEditComment, onSendDraft, commentsLoading, onReactToComment, onReactToLetter }) {
  const [spans, setSpans] = useState(buildSpansFromComments(comments, letter.body))
  const [pendingSpan, setPending]   = useState(null)  // { id, text, top }
  const [replyText, setReplyText]   = useState({})    // spanId -> string
  const [newCmtText, setNewCmtText] = useState('')
  const bodyRef = useRef(null)
  const tipRef  = useRef(null)

  // Re-derive spans when comments change
  useEffect(() => {
    setSpans(buildSpansFromComments(comments, letter.body))
  }, [comments, letter.body])

  // ── Sealed view ──────────────────────────────────────────────
  if (letter.status === 'locked' && !isAuthor) {
    return (
      <div>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.1rem' }}>← back</button>
        <div className="card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
    const plain = html.replace(/<[^>]+>/g, '')
    const idx = plain.indexOf(sp.text)
    if (idx === -1) return

    let pCount = 0
    let htmlStart = -1
    let htmlEnd = -1
    let inTag = false

    for (let i = 0; i < html.length; i++) {
      if (html[i] === '<') { inTag = true; continue }
      if (html[i] === '>') { inTag = false; continue }
      if (inTag) continue

      if (pCount === idx && htmlStart === -1) htmlStart = i
      pCount++
      if (pCount === idx + sp.text.length && htmlEnd === -1) { htmlEnd = i + 1; break }
    }

    if (htmlStart === -1 || htmlEnd === -1) return

    const before = html.slice(0, htmlStart)
    const middle = html.slice(htmlStart, htmlEnd)
    const after  = html.slice(htmlEnd)
    html = `${before}<span class="hl" id="hl-${sp.id}" data-span="${sp.id}">${middle}</span>${after}`
  })

  return html
}

  // ── Selection handler ────────────────────────────────────────
  function handleMouseUp() {
    const sel = window.getSelection()
    
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      tipRef.current.style.display = 'none'
      return
    }
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    const wr    = bodyRef.current.getBoundingClientRect()
    
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
    await onAddComment({ spanText: spanText || null, body: txt })
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
              {isAuthor && (
                <button
                  className="icon-btn"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={onOpenEdit}
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

            {/* Body */}
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
          </div>

        {/* Margin */}
          <div className="margin-col">
            <span className="margin-col-label">comments</span>

            <CommentsList
              comments={comments.filter(c => !c.span_text)}
              currentUser={currentUser}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onReactToComment={onReactToComment}
              onAddComment={onAddComment}
              letterReactions={letter.reactions}
              onReactToLetter={onReactToLetter}
            />
            {comments.filter(c => !c.span_text).length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 4, marginBottom: 12 }}>
                <textarea
                  className="cmt-input"
                  style={{ flex: 1, resize: 'none', overflow: 'hidden', lineHeight: 1.5 }}
                  placeholder="Reply"
                  value={replyText['general'] || ''}
                  rows={1}
                  onChange={e => setReplyText(r => ({ ...r, general: e.target.value }))}
                  onInput={autoResize}
                />
                <button
                  className="btn btn-accent"
                  style={{ padding: '3px 8px', fontSize: 11, alignSelf: 'flex-end' }}
                  onClick={() => saveReply('general', null)}
                >↩</button>
              </div>
            )}

            {spans.length === 0 && !pendingSpan && comments.filter(c => !c.span_text).length === 0 && !commentsLoading && (
              <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 6 }}>no comments yet</p>
                <p style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>select text to leave a comment</p>
              </div>
            )}

            {spans.map(sp => (
              <div key={sp.id} id={'mg-' + sp.id} style={{ marginBottom: 10 }}>
                <CommentsList
                  comments={sp.comments}
                  currentUser={currentUser}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                  onReactToComment={onReactToComment}
                  onFocusSpan={() => focusSpan(sp.id)}
                />
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
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={cancelPending}>cancel</button>
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
    if (!key) return  // skip general comments
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