'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface UserProfile {
  email: string
  department: string
  year?: number
  semester?: number
}

export default function Navbar() {
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData, error } = await supabase
        .from('users')
        .select('email, department, year, semester')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setUserProfile(userData)
      
      // Determine user role based on the current path
      if (pathname.includes('/admin')) {
        setUserRole('Admin')
      } else if (pathname.includes('/guide')) {
        setUserRole('Guide')
      } else if (pathname.includes('/student')) {
        setUserRole('Student')
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Don't show navbar on the main page (login/signup)
  if (pathname === '/') return null

  // Get current page title based on pathname
  const getPageTitle = () => {
    if (pathname.includes('/dashboard/admin/admin-projects/') && pathname.includes('/students')) return 'Students Management'
    if (pathname.includes('/dashboard/admin/admin-projects/') && pathname.includes('/groups')) return 'Groups Management'
    if (pathname.includes('/dashboard/admin/admin-projects')) return 'Admin Projects'
    if (pathname.includes('/dashboard/admin/projects')) return 'Projects Overview'
    if (pathname.includes('/dashboard/admin/phases')) return 'Phases Management'
    if (pathname.includes('/dashboard/admin/users')) return 'Users Management'
    if (pathname.includes('/dashboard/admin/leaderboard')) return 'Leaderboard'
    if (pathname.includes('/dashboard/admin')) return 'Admin Dashboard'
    if (pathname.includes('/dashboard/student/leaderboard')) return 'Leaderboard'
    if (pathname.includes('/dashboard/student/submissions')) return 'Project Submissions'
    if (pathname.includes('/dashboard/student/project/register')) return 'Project Registration'
    if (pathname.includes('/dashboard/student')) return 'Student Dashboard'
    if (pathname.includes('/dashboard/guide/leaderboard')) return 'Leaderboard'
    if (pathname.includes('/dashboard/guide/assigned')) return 'Assigned Projects'
    if (pathname.includes('/dashboard/guide/review')) return 'Review Submissions'
    if (pathname.includes('/dashboard/guide')) return 'Guide Dashboard'
    return 'Dashboard'
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and Page Title */}
          <div className="flex items-center space-x-6">
            <Link 
              href="/" 
              className="flex items-center space-x-2 text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span>Projexa</span>
            </Link>
            
            {/* Page Title with Role Badge */}
            <div className="flex items-center space-x-3">
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                {userRole && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    userRole === 'Admin' ? 'bg-purple-100 text-purple-800' :
                    userRole === 'Guide' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {userRole}
                  </span>
                )}
                <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
              </div>
            </div>
          </div>

          {/* Right side - User Info and Actions */}
          <div className="flex items-center space-x-4">
            {/* User Profile Info */}
            {userProfile && (
              <div className="hidden md:flex flex-col items-end text-sm">
                <span className="font-medium text-gray-900">{userProfile.email}</span>
                <span className="text-gray-500">
                  {userProfile.department}
                  {userProfile.year && userProfile.semester && 
                    ` • Year ${userProfile.year}, Sem ${userProfile.semester}`
                  }
                </span>
              </div>
            )}

            {/* Navigation Links based on role - Hide on deep pages to reduce clutter */}
            {!pathname.includes('/admin-projects/') && (
              <div className="hidden lg:flex items-center space-x-2">
                {pathname.includes('/admin') && (
                  <>
                    <Link 
                      href="/dashboard/admin" 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        pathname === '/dashboard/admin' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link 
                      href="/dashboard/admin/admin-projects" 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        pathname.includes('/admin-projects') 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Projects
                    </Link>
                  <Link 
                    href="/dashboard/admin/phases" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/phases') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Phases
                  </Link>
                  <Link 
                    href="/dashboard/admin/users" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/users') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Users
                  </Link>
                  <Link 
                    href="/dashboard/admin/leaderboard" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/leaderboard') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Leaderboard
                  </Link>
                </>
              )}
              
              {pathname.includes('/student') && (
                <>
                  <Link 
                    href="/dashboard/student" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/dashboard/student' 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/dashboard/student/submissions" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/submissions') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Submissions
                  </Link>
                  <Link 
                    href="/dashboard/student/leaderboard" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/leaderboard') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Leaderboard
                  </Link>
                </>
              )}
              
              {pathname.includes('/guide') && (
                <>
                  <Link 
                    href="/dashboard/guide" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/dashboard/guide' 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/dashboard/guide/assigned" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/assigned') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Assigned
                  </Link>
                  <Link 
                    href="/dashboard/guide/review" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/review') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Review
                  </Link>
                  <Link 
                    href="/dashboard/guide/leaderboard" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.includes('/leaderboard') 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Leaderboard
                  </Link>
                </>
              )}
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors border border-gray-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}