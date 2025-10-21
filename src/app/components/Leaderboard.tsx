'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface LeaderboardEntry {
  id: string
  name: string
  totalMarks: number
  averageMarks: string | number
  submissions: number
}

interface LeaderboardProps {
  userRole: 'student' | 'guide' | 'admin'
  userDepartment?: string
  compact?: boolean
  maxEntries?: number
}

export default function LeaderboardComponent({ 
  userRole, 
  userDepartment, 
  compact = false, 
  maxEntries = 0 
}: LeaderboardProps) {
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState<string>(userDepartment || '')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (userDepartment) {
      fetchLeaderboard(userDepartment)
    } else {
      fetchUserDepartment()
    }
  }, [userDepartment])

  const fetchUserDepartment = async () => {
    try {
      // Get current user's department
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get user's department
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (!data?.department) throw new Error('No department found')

      setDepartment(data.department)
      fetchLeaderboard(data.department)
    } catch (error) {
      console.error('Error fetching user department:', error)
      setLoading(false)
    }
  }

  const fetchLeaderboard = async (dept: string) => {
    try {
      setLoading(true)

      // Get all students in the department with their total marks
      const { data: students, error: studentsError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          projects!projects_student_id_fkey (
            id,
            title,
            submissions (
              marks_awarded,
              late_days,
              phases (
                max_marks,
                late_penalty_per_day
              )
            )
          )
        `)
        .eq('role', 'student')
        .eq('department', dept)

      if (studentsError) throw studentsError

      // Calculate total marks for each student
      const leaderboardData: LeaderboardEntry[] = (students || [])
        .map((student: any) => {
          let totalMarks = 0
          let totalSubmissions = 0

          student.projects?.forEach((project: any) => {
            project.submissions?.forEach((submission: any) => {
              if (submission.marks_awarded !== null && submission.marks_awarded !== undefined) {
                // Calculate penalty for late submissions
                const penalty = (submission.late_days || 0) * (submission.phases?.late_penalty_per_day || 0)
                const finalMarks = Math.max(0, submission.marks_awarded - penalty)
                totalMarks += finalMarks
                totalSubmissions++
              }
            })
          })

          return {
            id: student.id,
            name: student.name,
            totalMarks,
            averageMarks: totalSubmissions > 0 ? (totalMarks / totalSubmissions).toFixed(2) : '0',
            submissions: totalSubmissions
          }
        })
        .filter(student => student.submissions > 0) // Only show students with submissions
        .sort((a, b) => b.totalMarks - a.totalMarks)

      // If maxEntries is specified, limit the results
      const limitedData = maxEntries > 0 ? leaderboardData.slice(0, maxEntries) : leaderboardData
      setLeaderboard(limitedData)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (!department) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'}`}>
        <div className="text-center">
          <p className="text-gray-600">Unable to load department information.</p>
        </div>
      </div>
    )
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return '🥇'
      case 1:
        return '🥈'
      case 2:
        return '🥉'
      default:
        return `#${index + 1}`
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return 'text-yellow-600 font-bold'
      case 1:
        return 'text-gray-600 font-bold'
      case 2:
        return 'text-orange-600 font-bold'
      default:
        return 'text-gray-900'
    }
  }

  return (
    <div className={`${compact ? 'bg-white rounded-lg shadow-md border border-gray-200' : ''}`}>
      <div className={`${compact ? 'px-4 py-3 border-b border-gray-200' : 'mb-6'}`}>
        <div className="flex justify-between items-center">
          <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold`}>
            {compact ? 'Top Performers' : 'Department Leaderboard'}
          </h2>
          <div className="bg-gray-100 px-3 py-1 rounded-md">
            <span className="text-sm text-gray-600">Department: </span>
            <span className="font-medium">{department}</span>
          </div>
        </div>
      </div>

      <div className={compact ? 'p-4' : ''}>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rankings available</h3>
            <p className="text-gray-500">Students with graded submissions will appear here.</p>
          </div>
        ) : (
          <div className={`${compact ? '' : 'bg-white rounded-lg shadow'} overflow-hidden`}>
            {compact ? (
              // Compact card view for dashboards
              <div className="space-y-3">
                {leaderboard.map((student, index) => (
                  <div key={student.id} className={`flex items-center justify-between p-3 rounded-lg ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <span className={`text-lg font-bold ${getRankColor(index)}`}>
                        {getRankIcon(index)}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">{student.submissions} submissions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">{student.totalMarks.toFixed(1)}</p>
                      <p className="text-sm text-gray-500">Avg: {student.averageMarks}</p>
                    </div>
                  </div>
                ))}
                {maxEntries > 0 && leaderboard.length === maxEntries && (
                  <div className="text-center pt-2">
                    <p className="text-sm text-gray-500">
                      Showing top {maxEntries} performers
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Full table view for dedicated leaderboard page
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Marks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaderboard.map((student, index) => (
                    <tr key={student.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${getRankColor(index)}`}>
                          {getRankIcon(index)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{student.totalMarks.toFixed(1)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{student.averageMarks}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{student.submissions}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}