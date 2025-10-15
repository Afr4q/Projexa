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

export default function Leaderboard() {
  const [loading, setLoading] = useState(true)
  const [adminDepartment, setAdminDepartment] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    fetchAdminDepartment()
  }, [])

  const fetchAdminDepartment = async () => {
    try {
      // Get current admin user's department
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get admin's department
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (!data?.department) throw new Error('No department found')

      setAdminDepartment(data.department)
      // Fetch leaderboard after we know the department
      fetchLeaderboard(data.department)
    } catch (error) {
      console.error('Error fetching admin department:', error)
    }
  }

  const fetchLeaderboard = async (department: string) => {
    try {
      setLoading(true)

      // Get all students in the admin's department with their total marks
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
        .eq('department', department)

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
        .sort((a, b) => b.totalMarks - a.totalMarks)

      setLeaderboard(leaderboardData)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }

  if (loading && !leaderboard.length) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (!adminDepartment) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Unable to load department information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Department Leaderboard</h1>
        <div className="bg-gray-100 px-4 py-2 rounded-md">
          <span className="text-sm text-gray-600">Department: </span>
          <span className="font-medium">{adminDepartment}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No students found with submissions in this department.
                  </td>
                </tr>
              ) : (
                leaderboard.map((student, index) => (
                  <tr key={student.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        index === 0 ? 'text-yellow-600 font-bold' :
                        index === 1 ? 'text-gray-600 font-bold' :
                        index === 2 ? 'text-orange-600 font-bold' :
                        'text-gray-900'
                      }`}>
                        #{index + 1}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}