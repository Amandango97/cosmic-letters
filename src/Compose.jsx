import { useState, useRef, useCallback, memo } from 'react'
import { supabase } from './supabase'


const Compose = memo(function Compose({ currentUser, partnerName, onSend, onCancel }) {
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const taRef = useRef(null)

  async function uploadImage(file) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${currentUser.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('letter-images').upload(path, file)
    if (error) { console.error(error); setUploading(false); return }
    const { data } = supabase.storage.from('letter-images').getPublicUrl(path)
    const url = data.publicUrl
    // Insert markdown at cursor position
    const ta = taRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const insertion = `![](${url})`
    setBody(b => b.slice(0, start) + insertion + b.slice(end))
    setUploading(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadImage(file)
  }

  function handlePaste(e) {
    const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'))
    if (file) { e.preventDefault(); uploadImage(file) }
  }

  const autoResize = useCallback((e) => {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

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
          placeholder="Subject"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            borderRadius: 'var(--radius-sm)',
            outline: dragging ? '2px dashed var(--accent-a)' : '2px solid transparent',
            transition: 'outline 0.15s',
          }}
        >
          <textarea
            ref={taRef}
            className="compose-body-ta"
            placeholder={`Dear ${partnerName},`}
            value={body}
            onChange={e => setBody(e.target.value)}
            onPaste={handlePaste}
            onInput={autoResize}
          />
        </div>
        {uploading && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>uploading image…</p>}
        {dragging && <p style={{ fontSize: 11, color: 'var(--accent-a)', marginTop: 6 }}>drop to insert image</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-open"   onClick={() => send('open')}   disabled={saving || uploading || !body.trim()}>send open</button>
        <button className="btn btn-sealed" onClick={() => send('locked')} disabled={saving || uploading || !body.trim()}>seal &amp; send</button>
        <button className="btn btn-ghost"  onClick={onCancel} style={{ marginLeft: 'auto' }}>cancel</button>
        <button className="btn btn-ghost" onClick={() => send('draft')} disabled={saving || !body.trim()}>save draft</button>
      </div>
    </div>
  )
})

export default memo(Compose)
