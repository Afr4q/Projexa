'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabaseClient'
import type { UserRole } from '@/types/auth'
import styles from './page.module.css'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      console.log('Attempting to sign in with:', formData.email)
      const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })

      if (authError) {
        console.error('Authentication error:', authError)
        throw authError
      }

      if (!session?.user) {
        console.error('No session or user after sign in')
        throw new Error('Sign in failed')
      }

      console.log('Successfully signed in user:', session.user.id)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (userError) {
        console.error('Error fetching user role:', userError)
        throw userError
      }

      if (!userData) {
        console.error('No user data found')
        throw new Error('User role not found')
      }

      const userRole = userData as UserRole
      console.log('User role:', userRole.role)

      let redirectPath: string
      switch (userRole.role) {
        case 'admin':
          redirectPath = '/dashboard/admin'
          break
        case 'student':
          redirectPath = '/dashboard/student'
          break
        case 'guide':
          redirectPath = '/dashboard/guide'
          break
        default:
          throw new Error('Invalid role')
      }

      console.log('Redirecting to:', redirectPath)
      window.location.href = redirectPath
    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.loginContainer}>
      <form className={styles.loginForm} onSubmit={handleLogin}>
        <div className={styles.flexRow}>
          <label className={styles.inputLabel} htmlFor="email">
            <svg className={styles.userIcon} viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </label>
          <input
            id="email"
            className={styles.inputField}
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className={styles.flexRow}>
          <label className={styles.inputLabel} htmlFor="password">
            <svg className={styles.passwordIcon} viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
            </svg>
          </label>
          <input
            id="password"
            className={styles.inputField}
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>
        {error && <p className={styles.errorMessage}>{error}</p>}
        <button className={styles.submitButton} type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <a href="#" className={styles.forgotPassword}>
        Forgot password?
      </a>
    </div>
  )
}