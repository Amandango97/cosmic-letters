// App.jsx — root component
// Handles: auth state, data fetching, routing between screens

import { useEffect, useState } from 'react'
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
  const [comments,   setComments]   = useState([])
  const [screen,     setScreen]     = useState('list')   // 'list' | 'letter' | 'compose'
  const [activeLetter, setActiveLetter] = useState(null)
  const [loading,    setLoading]    = useState(true)

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
    const { data, error } = await supabase
      .from('letters')
      .select('*, comments(count)')
      .or(`from_user.eq.${session.user.id},to_user.eq.${session.user.id}`)
      .order('created_at', { ascending: false })

    if (error) { console.error(error); return }

    const withLabels = (data || []).map(l => ({
      ...l,
      from_label:    USER_LABELS[l.from_user] || '?',
      comment_count: l.comments?.[0]?.count ?? 0,
    }))
    setLetters(withLabels)
  }

  async function fetchComments(letterId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('letter_id', letterId)
      .order('created_at', { ascending: true })

    if (error) { console.error(error); return }
    const withLabels = (data || []).map(c => ({ ...c, author_label: USER_LABELS[c.author_id] || '?' }))
    setComments(withLabels)
  }

  // ── Actions ──────────────────────────────────────────────────
  async function openLetter(letter) {
    setActiveLetter(letter)
    setComments([])          // clear immediately before fetching
    setScreen('letter')
    await fetchComments(letter.id)

    if (letter.to_user === session.user.id && !letter.read_at) {
      await supabase.from('letters').update({ read_at: new Date().toISOString() }).eq('id', letter.id)
      fetchLetters()
    }
  }

  async function sendLetter(title, body, status) {
    const partnerId = getPartnerId()
    const { error } = await supabase.from('letters').insert({
      from_user:  session.user.id,
      to_user:    partnerId,
      from_label: USER_LABELS[session.user.id],
      title,
      body,
      status,
    })
    if (error) { console.error(error); return }
    fetchLetters()
    setScreen('list')
  }

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

  async function addComment({ spanText, body }) {
    const { error } = await supabase.from('comments').insert({
      letter_id:    activeLetter.id,
      author_id:    session.user.id,
      author_label: USER_LABELS[session.user.id],
      span_text:    spanText,
      body,
    })
    if (error) { console.error(error); return }
    await fetchComments(activeLetter.id)  // wait for this before moving on
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
          />
        )}

        {session && screen === 'compose' && (
          <Compose
            currentUser={currentUser}
            partnerName={partnerLabel}
            onSend={sendLetter}
            onCancel={() => setScreen('list')}
          />
        )}
      </div>
    </div>
  )
}
