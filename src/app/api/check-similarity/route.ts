import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { geminiService } from '@/lib/geminiService'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Similarity Check API Called ===')
    
    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured')
      return NextResponse.json({ 
        error: 'Similarity checking service is not properly configured' 
      }, { status: 500 })
    }

    // Use direct Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const phaseId = formData.get('phaseId') as string
    const projectId = formData.get('projectId') as string

    console.log('Similarity check request received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      phaseId,
      projectId
    })

    if (!file || !phaseId || !projectId) {
      console.error('Missing required fields:', { file: !!file, phaseId, projectId })
      return NextResponse.json({ 
        error: 'Missing required fields: file, phaseId, or projectId' 
      }, { status: 400 })
    }

    // Check if this is the initial phase (similarity check needed for the first phase by timestamp)
    const { data: phase } = await supabase
      .from('phases')
      .select('name, created_at, department, project_id')
      .eq('id', phaseId)
      .single()

    if (!phase) {
      return NextResponse.json({ 
        error: 'Phase not found' 
      }, { status: 404 })
    }

    // Get all phases for the same project/department to find the earliest one
    let allPhases
    if (phase.project_id) {
      // If phase is tied to a specific project
      const { data } = await supabase
        .from('phases')
        .select('id, created_at')
        .eq('project_id', phase.project_id)
        .order('created_at', { ascending: true })
      allPhases = data
    } else {
      // If phase is department-wide
      const { data } = await supabase
        .from('phases')
        .select('id, created_at')
        .eq('department', phase.department)
        .is('project_id', null)
        .order('created_at', { ascending: true })
      allPhases = data
    }

    // Check if current phase is the earliest (initial) phase
    const isInitialPhase = allPhases && allPhases.length > 0 && allPhases[0].id === phaseId

    console.log('Phase analysis:', {
      phaseName: phase.name,
      phaseId: phaseId,
      createdAt: phase.created_at,
      totalPhases: allPhases?.length || 0,
      isInitialPhase: isInitialPhase,
      earliestPhaseId: allPhases?.[0]?.id
    })

    if (!isInitialPhase) {
      return NextResponse.json({ 
        similarityScore: 0, 
        isSimilar: false, 
        message: 'Similarity check not required for this phase (not the initial phase)' 
      })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const currentPDFBuffer = Buffer.from(arrayBuffer)

    // Get reference PDFs from the project directory
    const referencePDFPaths = [
      path.join(process.cwd(), '20MCA 246 - MAIN PROJECT [2023-24].PDF'),
      path.join(process.cwd(), 'Mini Project Topic - Topics.pdf'),
    ]

    console.log('Looking for reference PDFs at:')
    referencePDFPaths.forEach(path => console.log('  -', path))

    // Read reference PDFs
    const referencePDFBuffers: Buffer[] = []
    for (const pdfPath of referencePDFPaths) {
      try {
        if (fs.existsSync(pdfPath)) {
          const buffer = fs.readFileSync(pdfPath)
          referencePDFBuffers.push(buffer)
          console.log(`✅ Successfully loaded reference PDF: ${path.basename(pdfPath)} (${buffer.length} bytes)`)
        } else {
          console.log(`❌ Reference PDF not found: ${pdfPath}`)
        }
      } catch (error) {
        console.error(`Error reading reference PDF ${pdfPath}:`, error)
      }
    }

    if (referencePDFBuffers.length === 0) {
      return NextResponse.json({ 
        error: 'No reference PDFs found for comparison. Expected files: "20MCA 246 - MAIN PROJECT [2023-24].PDF" and "Mini Project Topic - Topics.pdf"' 
      }, { status: 500 })
    }

    console.log(`📚 Total reference PDFs loaded: ${referencePDFBuffers.length}/2`)

    // Check similarity using Gemini
    console.log('Starting Gemini similarity check...')
    const similarityResult = await geminiService.checkSimilarity(
      currentPDFBuffer, 
      referencePDFBuffers
    )
    console.log('Gemini similarity check completed:', similarityResult)

    // Update the project with similarity score
    const { error: updateError } = await supabase
      .from('projects')
      .update({ similarity_score: similarityResult.similarityScore })
      .eq('id', projectId)
      .eq('student_id', user.id)

    if (updateError) {
      console.error('Error updating similarity score:', updateError)
    }

    return NextResponse.json({
      similarityScore: similarityResult.similarityScore,
      explanation: similarityResult.explanation,
      isSimilar: similarityResult.isSimilar,
      message: similarityResult.isSimilar 
        ? 'High similarity detected. Please contact your guide before proceeding.'
        : 'Similarity check passed. You may proceed with submission.'
    })

  } catch (error) {
    console.error('Error in similarity check API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during similarity check' 
    }, { status: 500 })
  }
}