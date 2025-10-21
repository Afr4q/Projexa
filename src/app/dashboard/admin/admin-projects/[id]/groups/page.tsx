'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/supabaseClient'
import Link from 'next/link'

interface AdminProject {
  id: string
  title: string
  description: string
  department: string
  year: number
  semester: number
  project_type: 'individual' | 'group' | 'mixed'
  allow_group_formation: boolean
  min_group_size: number
  max_group_size: number
}

interface Student {
  id: string
  name: string
  email: string
  year: number
  semester: number
}

interface ProjectGroup {
  id: string
  name: string
  description: string
  max_members: number
  created_at: string
  member_count?: number
  members?: GroupMember[]
}

interface GroupMember {
  id: string
  student_id: string
  role: 'leader' | 'member'
  users: Student
}

export default function ManageGroups() {
  const params = useParams()
  const router = useRouter()
  const adminProjectId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [adminProject, setAdminProject] = useState<AdminProject | null>(null)
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<ProjectGroup | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    max_members: 4
  })

  useEffect(() => {
    if (adminProjectId) {
      fetchProjectAndGroups()
    }
  }, [adminProjectId])

  const fetchProjectAndGroups = async () => {
    try {
      setLoading(true)

      // Fetch admin project details
      const { data: projectData, error: projectError } = await supabase
        .from('admin_projects')
        .select('*')
        .eq('id', adminProjectId)
        .single()

      if (projectError) throw projectError
      setAdminProject(projectData)

      // Only fetch groups and students if group formation is allowed
      if (projectData.allow_group_formation) {
        await Promise.all([
          fetchGroups(),
          fetchAvailableStudents(projectData.department, projectData.year, projectData.semester)
        ])
      }
    } catch (error) {
      console.error('Error fetching project and groups:', error)
      alert('Error loading project details')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('project_groups')
        .select(`
          *,
          group_members (
            id,
            student_id,
            role,
            users (id, name, email, year, semester)
          )
        `)
        .eq('admin_project_id', adminProjectId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const groupsWithCount = data?.map(group => ({
        ...group,
        member_count: group.group_members?.length || 0,
        members: group.group_members || []
      })) || []

      setGroups(groupsWithCount)
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchAvailableStudents = async (department: string, year: number, semester: number) => {
    try {
      // Get all students for this department/year/semester
      const { data: allStudents, error: studentsError } = await supabase
        .from('users')
        .select('id, name, email, year, semester')
        .eq('role', 'student')
        .eq('department', department)
        .eq('year', year)
        .eq('semester', semester)
        .order('name')

      if (studentsError) throw studentsError

      // Get all group members for this admin project to exclude them
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('student_id, group_id, project_groups!inner(admin_project_id)')
        .eq('project_groups.admin_project_id', adminProjectId)

      if (membersError) throw membersError

      // Extract student IDs that are already in groups for this project
      const groupedStudentIds = groupMembers?.map(member => member.student_id) || []

      // Filter out students who are already in groups
      const available = allStudents?.filter(student => 
        !groupedStudentIds.includes(student.id)
      ) || []

      setAvailableStudents(available)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newGroup.name.trim()) {
      alert('Please enter a group name')
      return
    }

    try {
      setSubmitting(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('project_groups')
        .insert({
          admin_project_id: adminProjectId,
          name: newGroup.name.trim(),
          description: newGroup.description.trim(),
          max_members: newGroup.max_members,
          created_by: user.id
        })

      if (error) throw error

      // Reset form
      setNewGroup({ name: '', description: '', max_members: 4 })
      setShowCreateGroup(false)

      // Refresh data
      await fetchGroups()
      
      alert('Group created successfully!')
    } catch (error) {
      console.error('Error creating group:', error)
      alert('Error creating group')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddStudentToGroup = async (groupId: string, studentId: string, role: 'leader' | 'member') => {
    try {
      // First check if student is already in any group for this project
      const { data: existingMember, error: checkError } = await supabase
        .from('group_members')
        .select('id, group_id, project_groups!inner(admin_project_id)')
        .eq('student_id', studentId)
        .eq('project_groups.admin_project_id', adminProjectId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing membership:', checkError)
        throw new Error(`Failed to check student membership: ${checkError.message}`)
      }

      if (existingMember) {
        alert('This student is already assigned to a group for this project!')
        return
      }

      // Check if group has reached max capacity
      const currentGroup = groups.find(g => g.id === groupId)
      if (currentGroup && currentGroup.member_count >= currentGroup.max_members) {
        alert('This group has reached its maximum capacity!')
        return
      }

      // Add student to group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          student_id: studentId,
          role: role
        })

      if (memberError) {
        console.error('Error adding to group_members:', memberError)
        throw new Error(`Failed to add student to group: ${memberError.message}`)
      }

      // Update the student's project to mark it as a group project
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          is_group_project: true,
          group_id: groupId
        })
        .eq('admin_project_id', adminProjectId)
        .eq('student_id', studentId)

      if (projectError) {
        console.error('Error updating project:', projectError)
        // Don't throw error here as the group membership was successful
        console.warn('Student added to group but project update failed:', projectError.message)
      }

      // Refresh data
      await fetchGroups()
      await fetchAvailableStudents(adminProject!.department, adminProject!.year, adminProject!.semester)
      
      alert('Student added to group successfully!')
    } catch (error) {
      console.error('Error adding student to group:', error)
      alert(error instanceof Error ? error.message : 'Error adding student to group')
    }
  }

  const handleRemoveStudentFromGroup = async (groupId: string, studentId: string) => {
    if (!confirm('Are you sure you want to remove this student from the group?')) return

    try {
      // Remove student from group
      const { error: memberError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('student_id', studentId)

      if (memberError) {
        console.error('Error removing from group_members:', memberError)
        throw new Error(`Failed to remove student from group: ${memberError.message}`)
      }

      // Update the student's project back to individual
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          is_group_project: false,
          group_id: null
        })
        .eq('admin_project_id', adminProjectId)
        .eq('student_id', studentId)

      if (projectError) {
        console.error('Error updating project:', projectError)
        console.warn('Student removed from group but project update failed:', projectError.message)
      }

      // Refresh data
      await fetchGroups()
      await fetchAvailableStudents(adminProject!.department, adminProject!.year, adminProject!.semester)
      
      alert('Student removed from group successfully!')
    } catch (error) {
      console.error('Error removing student from group:', error)
      alert(error instanceof Error ? error.message : 'Error removing student from group')
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will remove all members from the group.')) return

    try {
      // First, update all projects in this group back to individual
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          is_group_project: false,
          group_id: null
        })
        .eq('group_id', groupId)

      if (projectError) {
        console.error('Error updating projects:', projectError)
        // Continue with deletion despite project update error
      }

      // Delete the group (CASCADE will handle group_members)
      const { error: groupError } = await supabase
        .from('project_groups')
        .delete()
        .eq('id', groupId)

      if (groupError) throw groupError

      // Refresh data
      await fetchGroups()
      await fetchAvailableStudents(adminProject!.department, adminProject!.year, adminProject!.semester)
      
      alert('Group deleted successfully!')
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Error deleting group')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project groups...</p>
        </div>
      </div>
    )
  }

  if (!adminProject) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
          <Link href="/dashboard/admin/admin-projects" className="text-indigo-600 hover:text-indigo-700">
            Back to Admin Projects
          </Link>
        </div>
      </div>
    )
  }

  if (!adminProject.allow_group_formation) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Groups Not Enabled</h1>
          <p className="text-gray-600 mb-4">
            Group formation is not enabled for this project. This project is set to "{adminProject.project_type}" mode.
          </p>
          <Link href={`/dashboard/admin/admin-projects/${adminProjectId}/students`} className="text-indigo-600 hover:text-indigo-700">
            View Students Instead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <Link href="/dashboard/admin/admin-projects" className="hover:text-gray-700">
                Admin Projects
              </Link>
              <span>/</span>
              <Link href={`/dashboard/admin/admin-projects/${adminProjectId}/students`} className="hover:text-gray-700">
                {adminProject.title}
              </Link>
              <span>/</span>
              <span className="text-gray-900">Groups</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">Manage Groups</h1>
            <p className="text-gray-600">{adminProject.title} - Year {adminProject.year}, Semester {adminProject.semester}</p>
          </div>
          <div className="flex space-x-3">
            <Link
              href={`/dashboard/admin/admin-projects/${adminProjectId}/students`}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              View Students
            </Link>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create Group
            </button>
          </div>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-800 mb-1">Group Settings</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Project Type: <span className="font-medium">{adminProject.project_type}</span></p>
              <p>Group Size: {adminProject.min_group_size} - {adminProject.max_group_size} members</p>
              <p>Available Students: {availableStudents.length} (not assigned to groups)</p>
              <p>Total Groups: {groups.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  placeholder="e.g., Team Alpha"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  rows={3}
                  placeholder="Brief description of the group..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Members</label>
                <input
                  type="number"
                  min={adminProject.min_group_size}
                  max={adminProject.max_group_size}
                  value={newGroup.max_members}
                  onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) || 4 })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div className="space-y-6">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow-md border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      (group.member_count || 0) >= group.max_members 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {group.member_count || 0} / {group.max_members} members
                    </span>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete Group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Current Members */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Current Members</h4>
                  {group.members && group.members.length > 0 ? (
                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                          <div className="flex items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{member.users.name}</p>
                              <p className="text-xs text-gray-500">{member.users.email}</p>
                            </div>
                            <span className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full ${
                              member.role === 'leader' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveStudentFromGroup(group.id, member.student_id)}
                            className="text-red-600 hover:text-red-700"
                            title="Remove from group"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No members assigned yet</p>
                  )}
                </div>

                {/* Add Students */}
                {(group.member_count || 0) < group.max_members && availableStudents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Add Students</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableStudents.slice(0, 6).map((student) => (
                        <div key={student.id} className="flex items-center justify-between bg-blue-50 rounded-md p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAddStudentToGroup(group.id, student.id, 'leader')}
                              className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                              disabled={group.members?.some(m => m.role === 'leader')}
                              title="Add as leader"
                            >
                              Leader
                            </button>
                            <button
                              onClick={() => handleAddStudentToGroup(group.id, student.id, 'member')}
                              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                              title="Add as member"
                            >
                              Member
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {availableStudents.length > 6 && (
                      <p className="text-sm text-gray-500 mt-2">
                        And {availableStudents.length - 6} more students available...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Created</h3>
            <p className="text-gray-500 mb-4">
              Create groups to organize students for collaborative projects.
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create First Group
            </button>
          </div>
        )}
      </div>
    </div>
  )
}