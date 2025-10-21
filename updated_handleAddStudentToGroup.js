// After running the migration, replace the handleAddStudentToGroup function with this:

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

    // Update the student's project to mark it as a group project and assign guide
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        is_group_project: true,
        group_id: groupId,
        assigned_guide_id: adminProject?.assigned_guide_id || null
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