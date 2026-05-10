import { useState, useRef, useCallback, memo, useEffect } from 'react'
import { supabase } from './supabase'

export default memo(function Compose({ currentUser, partnerName, onSend, onCancel, onAutoSave, onPromoteDraft, onDiscardDraft }) {
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const taRef = useRef(null)
  const autoSaveTimer = useRef(null)
  const draftIdRef = useRef(null)
  const fileInputRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (!body.trim()) return
    if (saving) return
    setAutoSaved(false)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const id = await onAutoSave(title.trim() || '(untitled)', body.trim(), draftIdRef.current)
      draftIdRef.current = id
      setAutoSaved(true)
    }, 500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [body, title, saving])

  async function uploadFile(file) {
    const isImage = file.type.startsWith('image/')
    const isAudio = file.type.startsWith('audio/')
    if (!isImage && !isAudio) return
    
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${currentUser.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('letter-images').upload(path, file)
    if (error) { console.error(error); setUploading(false); return }
    const { data } = supabase.storage.from('letter-images').getPublicUrl(path)
    const url = data.publicUrl

    const ta = taRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const insertion = isAudio
      ? `\n<audio controls src="${url}"></audio>\n`
      : `![](${url})`
    setBody(b => b.slice(0, start) + insertion + b.slice(end))
    setUploading(false)
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    const ext = mimeType === 'audio/webm' ? 'webm' : 'mp4'
    const mr = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType })
      await uploadFile(file)
    }
    mr.start()
    setMediaRecorder(mr)
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorder?.stop()
    setMediaRecorder(null)
    setRecording(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handlePaste(e) {
    const file = Array.from(e.clipboardData.files).find(f => 
      f.type.startsWith('image/') || f.type.startsWith('audio/')
    )
    if (file) { e.preventDefault(); uploadFile(file) }
  }

  const autoResize = useCallback((e) => {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

  async function send(status) {
    if (!body.trim()) return
    setSaving(true)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = null
    if (draftIdRef.current) {
      await onAutoSave(title.trim() || '(untitled)', body.trim(), draftIdRef.current)
      await onPromoteDraft(draftIdRef.current, status)
    } else {
      await onSend(title.trim() || '(untitled)', body.trim(), status)
    }
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
        <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '0.5px solid var(--border)', marginTop: 4 }}>
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 12px' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              attach
            </button>
            <button
              className="btn btn-ghost"
              onClick={recording ? stopRecording : startRecording}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 12px', color: recording ? '#f87171' : undefined, borderColor: recording ? 'rgba(248,113,113,0.4)' : undefined }}
            >
              {recording ? (
                <>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite' }} />
                  stop
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  record
                </>
              )}
            </button>
            {uploading && <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>uploading…</span>}
            {recording && <span style={{ fontSize: 10, color: '#f87171', alignSelf: 'center', letterSpacing: '0.05em' }}>recording…</span>}
          </div>
        {dragging && <p style={{ fontSize: 11, color: 'var(--accent-a)', marginTop: 6 }}>drop to insert file</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) uploadFile(f); e.target.value = '' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-open" onClick={() => send('open')} disabled={saving || uploading || !body.trim()}>send open</button>
        <button className="btn btn-sealed" onClick={() => send('locked')} disabled={saving || uploading || !body.trim()}>seal &amp; send</button>
        <button
          className="btn btn-ghost"
          onClick={() => send('draft')}
          disabled={saving || !body.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: autoSaved ? '#7ecba1' : '#c4874a',
            transition: 'background 0.6s', flexShrink: 0,
          }} />
          save draft
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>autosaves</span>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            clearTimeout(autoSaveTimer.current)
            if (draftIdRef.current) await onDiscardDraft(draftIdRef.current)
            onCancel()
          }}
          style={{ marginLeft: 'auto' }}
        >cancel</button>
      </div>
    </div>
  )
})