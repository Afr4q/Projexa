'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface User {
  id: string
  email: string
  name: string
  role: 'student' | 'guide' | 'admin'
  department: string
  specialization?: string
  year?: number
  semester?: number
  created_at: string
}

export default function ManageUsers() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [adminDepartment, setAdminDepartment] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'student' as 'student' | 'guide' | 'admin',
    specialization: '',
    year: 1,
    semester: 1,
    password: ''
  })

  useEffect(() => {
    fetchAdminInfo()
  }, [])

  const fetchAdminInfo = async () => {
    try {
      // Get current user
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

      setAdminDepartment(data.department)
      // Fetch users after we know the department
      fetchUsers(data.department)
    } catch (error) {
      console.error('Error fetching admin info:', error)
      alert('Error: Could not fetch admin department information')
    }
  }

  const fetchUsers = async (department: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('department', department)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('Error loading users. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!adminDepartment) {
      alert('Error: No department found for admin')
      return
    }

    // Validate form data
    if (!formData.email || !formData.email.includes('@')) {
      alert('Please enter a valid email address')
      return
    }
    if (!formData.name || formData.name.trim().length < 2) {
      alert('Please enter a valid name (at least 2 characters)')
      return
    }
    if (!formData.password || formData.password.length < 6) {
      alert('Please enter a password (minimum 6 characters)')
      return
    }

    // Prepare data to send
    const userData: any = {
      email: formData.email,
      name: formData.name,
      role: formData.role,
      password: formData.password,
      department: adminDepartment
    }

    // Add role-specific fields
    if (formData.role === 'student') {
      userData.year = formData.year
      userData.semester = formData.semester
    } else if (formData.role === 'guide' && formData.specialization.trim()) {
      userData.specialization = formData.specialization.trim()
    }

    try {
      setLoading(true)
      
      console.log('Sending user data:', userData) // Debug log
      
      // Create the user with admin API
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(userData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error creating user')
      }

      // Clear form and refresh list
      setFormData({
        email: '',
        name: '',
        role: 'student',
        specialization: '',
        year: 1,
        semester: 1,
        password: ''
      })
      fetchUsers(adminDepartment)
    } catch (error) {
      console.error('Error creating user:', error)
      if (error instanceof Error) {
        alert(`Error creating user: ${error.message}`)
      } else {
        alert('Error creating user. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setIsEditing(true)
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      specialization: user.specialization || '',
      year: user.year || 1,
      semester: user.semester || 1,
      password: '' // Don't pre-fill password for security
    })
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingUser || !adminDepartment) {
      alert('Error: No user selected for editing')
      return
    }

    // Validate form data (password not required for updates)
    if (!formData.email || !formData.email.includes('@')) {
      alert('Please enter a valid email address')
      return
    }
    if (!formData.name || formData.name.trim().length < 2) {
      alert('Please enter a valid name (at least 2 characters)')
      return
    }

    // Prepare update data
    const updateData: any = {
      name: formData.name.trim(),
      email: formData.email,
      role: formData.role,
      department: adminDepartment
    }

    // Add role-specific fields
    if (formData.role === 'student') {
      updateData.year = formData.year
      updateData.semester = formData.semester
      updateData.specialization = null // Clear specialization for students
    } else if (formData.role === 'guide') {
      updateData.specialization = formData.specialization.trim() || null
      updateData.year = null // Clear year/semester for guides
      updateData.semester = null
    } else {
      // Admin role
      updateData.specialization = null
      updateData.year = null
      updateData.semester = null
    }

    // Include password if provided
    if (formData.password.trim()) {
      if (formData.password.length < 6) {
        alert('Password must be at least 6 characters')
        return
      }
      updateData.password = formData.password
    }

    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingUser.id)

      if (error) throw error

      // If password was provided, update it via Supabase Auth (requires admin privileges)
      if (formData.password.trim()) {
        try {
          const { error: passwordError } = await supabase.auth.admin.updateUserById(
            editingUser.id,
            { password: formData.password }
          )
          
          if (passwordError) {
            console.warn('Password update failed:', passwordError)
            alert('User updated successfully, but password update failed. The user may need to reset their password.')
          }
        } catch (passwordError) {
          console.warn('Password update failed:', passwordError)
          alert('User updated successfully, but password update failed. The user may need to reset their password.')
        }
      }

      // Reset form and refresh list
      setFormData({
        email: '',
        name: '',
        role: 'student',
        specialization: '',
        year: 1,
        semester: 1,
        password: ''
      })
      setEditingUser(null)
      setIsEditing(false)
      fetchUsers(adminDepartment)
      alert('User updated successfully!')
    } catch (error) {
      console.error('Error updating user:', error)
      if (error instanceof Error) {
        alert(`Error updating user: ${error.message}`)
      } else {
        alert('Error updating user. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setIsEditing(false)
    setFormData({
      email: '',
      name: '',
      role: 'student',
      specialization: '',
      year: 1,
      semester: 1,
      password: ''
    })
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.name}" (${user.email})? This action cannot be undone.`)) {
      return
    }

    try {
      setLoading(true)
      
      // Delete from users table
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (error) throw error

      // Try to delete from Supabase Auth (may fail if admin doesn't have permission)
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
        if (authError) {
          console.warn('Auth user deletion failed:', authError)
        }
      } catch (authError) {
        console.warn('Auth user deletion failed:', authError)
      }

      fetchUsers(adminDepartment!)
      alert('User deleted successfully!')
    } catch (error) {
      console.error('Error deleting user:', error)
      if (error instanceof Error) {
        alert(`Error deleting user: ${error.message}`)
      } else {
        alert('Error deleting user. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading && !adminDepartment) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Users</h1>

      {/* Display admin's department */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700">Your Department</label>
        <div className="mt-1 block w-full px-3 py-2 bg-gray-100 rounded-md text-gray-700">
          {adminDepartment || 'Loading...'}
        </div>
      </div>

      {/* Add/Edit User Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {isEditing ? `Edit User: ${editingUser?.name}` : 'Add New User'}
        </h2>
        <form onSubmit={isEditing ? handleUpdateUser : handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                required
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                required
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as 'student' | 'guide' | 'admin'
                  setFormData({ 
                    ...formData, 
                    role: newRole,
                    // Reset role-specific fields when role changes
                    specialization: '',
                    year: newRole === 'student' ? 1 : formData.year,
                    semester: newRole === 'student' ? 1 : formData.semester
                  })
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                required
              >
                <option value="student">Student</option>
                <option value="guide">Guide</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password {!isEditing && <span className="text-red-500">*</span>}
                {isEditing && <span className="text-sm text-gray-500">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                required={!isEditing}
                minLength={6}
                placeholder={isEditing ? "Leave blank to keep current password" : "Minimum 6 characters"}
              />
            </div>
          </div>

          {/* Role-specific fields */}
          {formData.role === 'student' && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Student Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                  >
                    <option value={1}>1st Semester</option>
                    <option value={2}>2nd Semester</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {formData.role === 'guide' && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Guide Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                  placeholder="e.g., Machine Learning, Web Development, Data Science"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                } transition-colors`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Updating User...' : 'Creating User...'}
                </div>
              ) : (
                isEditing ? 'Update User' : 'Add User'
              )}
            </button>
            
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year/Semester</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'guide' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.role === 'student' && user.year && user.semester ? (
                        `Year ${user.year}, Sem ${user.semester}`
                      ) : (
                        '-'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.specialization || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        disabled={loading}
                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                        title="Edit user"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete user"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <div className="text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-500">Start by adding a new user to your department.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}