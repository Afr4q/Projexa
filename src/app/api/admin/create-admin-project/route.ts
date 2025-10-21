import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { 
      title, 
      description, 
      department, 
      year, 
      semester, 
      max_students,
      project_type = 'individual',
      allow_group_formation = false,
      min_group_size = 2,
      max_group_size = 4
    } = await req.json()

    console.log('Creating admin project:', { 
      title, 
      description, 
      department, 
      year, 
      semester, 
      max_students,
      project_type,
      allow_group_formation,
      min_group_size,
      max_group_size
    })

    // Get and verify auth token
    const authToken = req.headers.get('authorization')?.split(' ')[1]
    if (!authToken) {
      return NextResponse.json({ message: 'No authorization token provided' }, { status: 401 })
    }

    // Verify that the admin has permission for this department
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('department')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData?.department || adminData.department !== department) {
      return NextResponse.json(
        { message: 'Admin can only create projects for their own department' },
        { status: 403 }
      )
    }

    // Create admin project
    const { data: adminProject, error: adminProjectError } = await supabaseAdmin
      .from('admin_projects')
      .insert({
        title,
        description,
        department,
        year,
        semester,
        created_by: user.id,
        max_students: max_students || 1,
        status: 'active',
        project_type,
        allow_group_formation,
        min_group_size,
        max_group_size
      })
      .select()
      .single()

    if (adminProjectError) {
      console.error('Error creating admin project:', adminProjectError)
      return NextResponse.json(
        { message: adminProjectError.message },
        { status: 400 }
      )
    }

    // Get students that will be assigned projects
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('department', department)
      .eq('year', year)
      .eq('semester', semester)

    if (studentsError) {
      console.error('Error fetching students:', studentsError)
      return NextResponse.json(
        { message: 'Error fetching students' },
        { status: 400 }
      )
    }

    // Create individual projects for each student
    if (students && students.length > 0) {
      console.log(`Creating projects for ${students.length} students`)
      
      // Check if projects already exist for this admin project to prevent duplicates
      const { data: existingProjects, error: existingError } = await supabaseAdmin
        .from('projects')
        .select('student_id')
        .eq('admin_project_id', adminProject.id)
      
      if (existingError) {
        console.error('Error checking existing projects:', existingError)
      }
      
      // Filter out students who already have projects for this admin project
      const existingStudentIds = existingProjects?.map(p => p.student_id) || []
      const studentsToCreate = students.filter(student => !existingStudentIds.includes(student.id))
      
      console.log(`${existingStudentIds.length} projects already exist, creating ${studentsToCreate.length} new projects`)
      
      if (studentsToCreate.length > 0) {
        const projectsToInsert = studentsToCreate.map(student => ({
          title,
          description,
          student_id: student.id,
          department,
          admin_project_id: adminProject.id,
          status: 'pending'
        }))

        const { error: projectsError } = await supabaseAdmin
          .from('projects')
          .insert(projectsToInsert)

        if (projectsError) {
          console.error('Error creating individual projects:', projectsError)
          
          // Check if it's a unique constraint violation (duplicate projects)
          if (projectsError.code === '23505' && projectsError.message.includes('projects_student_admin_project_unique')) {
            console.log('Some projects already exist for these students - this is expected during retries')
          } else {
            // Log other errors but don't fail the whole operation
            console.error('Unexpected error creating projects:', projectsError)
          }
        } else {
          console.log(`Successfully created ${projectsToInsert.length} projects`)
        }
      }
    }

    const studentCount = students?.length || 0

    return NextResponse.json({ 
      message: `Admin project created successfully! Individual projects will be automatically assigned to ${studentCount} students.`,
      adminProject,
      assignedStudents: studentCount
    })
  } catch (error) {
    console.error('Error in create-admin-project route:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}