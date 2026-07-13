import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

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
    signUp: (email, password, name) =>
      supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }),
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
