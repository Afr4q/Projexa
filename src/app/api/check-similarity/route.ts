import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { geminiService } from '@/lib/geminiService'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
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

    if (!file || !phaseId || !projectId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, phaseId, or projectId' 
      }, { status: 400 })
    }

    // Check if this is Phase 1 submission (only Phase 1 needs similarity check)
    const { data: phase } = await supabase
      .from('phases')
      .select('name')
      .eq('id', phaseId)
      .single()

    if (!phase || !phase.name.toLowerCase().includes('phase 1')) {
      return NextResponse.json({ 
        similarityScore: 0, 
        isSimilar: false, 
        message: 'Similarity check not required for this phase' 
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
    const similarityResult = await geminiService.checkSimilarity(
      currentPDFBuffer, 
      referencePDFBuffers
    )

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