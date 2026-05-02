// App.jsx — root component
// Handles: auth state, data fetching, routing between screens

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import StarField   from './StarField'
import Login       from './Login'
import LetterList  from './LetterList'
import LetterView  from './LetterView'
import Compose     from './Compose'
import './cosmic-theme.css'

// ── User label map ────────────────────────────────────────────────
// Set these to the Supabase user IDs of person A and person B.
// After creating accounts in Supabase, paste the UUIDs here.
// e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx': 'A'

const USER_LABELS = {
  [import.meta.env.VITE_USER_A_ID]: 'Amanda',
  [import.meta.env.VITE_USER_B_ID]: 'River',
}

export default function App() {
  const [session,    setSession]    = useState(null)
  const [letters,    setLetters]    = useState([])
  const [comments, setComments] = useState([])
  const commentsCache = useRef({})
  const [screen,     setScreen]     = useState('list')   // 'list' | 'letter' | 'compose'
  const [activeLetter, setActiveLetter] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [listView, setListView] = useState('inbox')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [lettersLoading, setLettersLoading] = useState(true)

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ── Fetch letters when logged in ─────────────────────────────
  useEffect(() => {
    if (!session) return
    fetchLetters()

    // Realtime subscription — new letters or updates appear instantly
    const channel = supabase
      .channel('letters-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters' }, fetchLetters)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        fetchLetters()
        if (activeLetter) fetchComments(activeLetter.id)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  async function fetchLetters() {
    setLettersLoading(true)
    const { data, error } = await supabase
      .from('letters')
      .select('*, comments(count)')
      .or(`from_user.eq.${session.user.id},to_user.eq.${session.user.id}`)
      .order('created_at', { ascending: false })

    if (error) { console.error(error); setLettersLoading(false); return }

    const seen = new Set()
    const deduped = (data || []).filter(l => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })

    const withLabels = deduped.map(l => ({
      ...l,
      from_label:    USER_LABELS[l.from_user] || '?',
      comment_count: l.comments?.[0]?.count ?? 0,
    }))
    setLetters(withLabels)
    setLettersLoading(false)
  }

  async function fetchComments(letterId) {
    setCommentsLoading(true)
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('letter_id', letterId)
      .order('created_at', { ascending: true })

    if (error) { console.error(error); setCommentsLoading(false); return }
    const withLabels = (data || []).map(c => ({ ...c, author_label: USER_LABELS[c.author_id] || '?' }))
    commentsCache.current[letterId] = withLabels
    setComments(withLabels)
    setCommentsLoading(false)
  }

  // ── Actions ──────────────────────────────────────────────────
  async function openLetter(letter) {
    setActiveLetter(letter)
    setScreen('letter')

    // Show cached comments instantly if available
    if (commentsCache.current[letter.id]) {
      setComments(commentsCache.current[letter.id])
    } else {
      setComments([])
    }

    // Always refresh in background
    fetchComments(letter.id)

    if (letter.to_user === session.user.id && !letter.read_at) {
      await supabase.from('letters').update({ read_at: new Date().toISOString() }).eq('id', letter.id)
      fetchLetters()
    }
  }

  const sendLetter = useCallback(async (title, body, status) => {
  const { error } = await supabase.from('letters').insert({
    from_user:  session.user.id,
    to_user:    status === 'draft' ? session.user.id : getPartnerId(),
    from_label: USER_LABELS[session.user.id],
    title,
    body,
    status,
  })
  if (error) { console.error(error); return }
  fetchLetters()
  setScreen('list')
}, [session])

  async function sealLetter() {
    await supabase.from('letters').update({ status: 'locked' }).eq('id', activeLetter.id)
    setActiveLetter(l => ({ ...l, status: 'locked' }))
    fetchLetters()
  }

  async function unsealLetter() {
    await supabase.from('letters').update({ status: 'open' }).eq('id', activeLetter.id)
    setActiveLetter(l => ({ ...l, status: 'open' }))
    fetchLetters()
  }

  async function deleteLetter() {
    await supabase.from('comments').delete().eq('letter_id', activeLetter.id)
    await supabase.from('letters').delete().eq('id', activeLetter.id)
    fetchLetters()
    setScreen('list')
    setActiveLetter(null)
  }

  async function editLetter(title, body) {
    await supabase.from('letters').update({ title, body }).eq('id', activeLetter.id)
    setActiveLetter(l => ({ ...l, title, body }))
    fetchLetters()
  }

  async function addComment({ spanText, body }) {
    const { error } = await supabase.from('comments').insert({
      letter_id:    activeLetter.id,
      author_id:    session.user.id,
      author_label: USER_LABELS[session.user.id],
      span_text:    spanText,
      body,
    })
    if (error) { console.error(error); return }
    delete commentsCache.current[activeLetter.id]
    await fetchComments(activeLetter.id)
    fetchLetters()
  }

  async function deleteComment(commentId) {
    await supabase.from('comments').delete().eq('id', commentId)
    delete commentsCache.current[activeLetter.id]
    await fetchComments(activeLetter.id)
    fetchLetters()
  }

  async function editComment(commentId, body) {
    await supabase.from('comments').update({ body }).eq('id', commentId)
    delete commentsCache.current[activeLetter.id]
    await fetchComments(activeLetter.id)
    fetchLetters()
  }

  async function reactToComment(commentId, emoji, currentReactions) {
    const userId = session.user.id
    const updated = { ...currentReactions }
    if (!updated[emoji]) updated[emoji] = []
    if (updated[emoji].includes(userId)) {
      updated[emoji] = updated[emoji].filter(id => id !== userId)
      if (updated[emoji].length === 0) delete updated[emoji]
    } else {
      updated[emoji].push(userId)
    }
    await supabase.from('comments').update({ reactions: updated }).eq('id', commentId)
    await fetchComments(activeLetter.id)
  }

  async function sendDraft(status) {
    await supabase.from('letters').update({ 
      status, 
      to_user: getPartnerId() 
    }).eq('id', activeLetter.id)
    setActiveLetter(l => ({ ...l, status }))
    fetchLetters()
  }

  async function autoSaveDraft(title, body, existingId) {
    if (existingId) {
      await supabase.from('letters').update({ title, body }).eq('id', existingId)
      fetchLetters()
      return existingId
    } else {
      const { data, error } = await supabase.from('letters').insert({
        from_user:  session.user.id,
        to_user:    session.user.id,
        from_label: USER_LABELS[session.user.id],
        title,
        body,
        status: 'draft',
      }).select().single()
      if (error) { console.error(error); return null }
      fetchLetters()
      return data.id
    }
  }

  async function promoteDraft(draftId, status) {
    await supabase.from('letters').update({
      status,
      to_user: status === 'draft' ? session.user.id : getPartnerId()
    }).eq('id', draftId)
    fetchLetters()
    setScreen('list')
  }

  async function discardDraft(draftId) {
  await supabase.from('letters').delete().eq('id', draftId)
  fetchLetters()
}
  function getPartnerId() {
    return Object.keys(USER_LABELS).find(id => id !== session.user.id)
  }

  async function logout() {
    await supabase.auth.signOut()
    setScreen('list')
    setLetters([])
  }

  // ── Derived ──────────────────────────────────────────────────
  const currentUser = session ? {
    id:    session.user.id,
    label: USER_LABELS[session.user.id] || '?',
  } : null

  const partnerLabel = currentUser
    ? Object.values(USER_LABELS).find(l => l !== currentUser.label) || '?'
    : '?'

  const isAuthor = activeLetter && session && activeLetter.from_user === session.user.id

  // ── Render ───────────────────────────────────────────────────
  if (loading) return null

  return (
    <div className="cosmos-shell">
      <StarField />
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />

      <div className="ui-layer">
        {!session && <Login onLogin={() => {}} />}

        {session && screen === 'list' && (
          <LetterList
            letters={letters}
            currentUser={currentUser}
            partnerName={partnerLabel}
            onOpen={openLetter}
            onCompose={() => setScreen('compose')}
            onLogout={logout}
            view={listView}
            onViewChange={setListView}
            loading={lettersLoading}
          />
        )}

        {session && screen === 'letter' && activeLetter && (
          <LetterView
            letter={activeLetter}
            comments={comments}
            currentUser={currentUser}
            isAuthor={isAuthor}
            onBack={() => { setScreen('list'); setActiveLetter(null) }}
            onSeal={sealLetter}
            onUnseal={unsealLetter}
            onAddComment={addComment}
            onDelete={deleteLetter}
            onEdit={editLetter}
            onDeleteComment={deleteComment}
            onEditComment={editComment}
            onSendDraft={sendDraft}
            commentsLoading={commentsLoading}
            onReactToComment={reactToComment}
          />
        )}

        {session && screen === 'compose' && (
          <Compose
            currentUser={currentUser}
            partnerName={partnerLabel}
            onSend={sendLetter}
            onCancel={() => setScreen('list')}
            onAutoSave={autoSaveDraft}
            onPromoteDraft={promoteDraft}
            onDiscardDraft={discardDraft}
          />
        )}
      </div>
    </div>
  )
}
