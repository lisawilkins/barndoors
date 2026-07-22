import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

// Hands no longer have individual accounts — everyone signs in as a hand
// through this one shared Supabase Auth account, gated by a single
// universal password entered on the login screen. This email isn't a
// secret (it ships in the JS bundle); the password is the only thing that
// actually needs to be kept to "people who work here." See AGENTS.md "Auth".
const HAND_LOGIN_EMAIL = 'hand@barndoors.internal'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return

    let active = true
    setLoading(true)

    supabase
      .from('profiles')
      .select('id, role, name, phone, email, status')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Failed to load profile', error)
          setProfile(null)
        } else {
          setProfile(data)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isManager: profile?.role === 'manager',
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInAsHand: (password) =>
      supabase.auth.signInWithPassword({ email: HAND_LOGIN_EMAIL, password }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
