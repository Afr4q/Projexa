import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Check if API key is available
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set')
}

interface SimilarityResult {
  similarityScore: number
  explanation: string
  isSimilar: boolean
  similarProjects?: string[]
}

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  private cleanExtractedText(rawText: string): string {
    let cleaned = rawText.trim()
    
    console.log('Raw text sample:', cleaned.substring(0, 200))
    
    // First, normalize all whitespace to single spaces
    cleaned = cleaned.replace(/\s+/g, ' ')
    
    // Fix the specific pattern we see: "P e t   H o s t e l" -> "Pet Hostel"
    // This pattern suggests each character is separated by spaces
    // We'll look for sequences of single letters with spaces and join them
    
    // Split by multiple spaces to get potential words/phrases
    const segments = cleaned.split(/\s{2,}/) // Split on 2+ spaces
    
    const fixedSegments = segments.map(segment => {
      // Check if this segment looks like spaced-out text (single chars with spaces)
      if (/^(\w\s+){2,}\w?$/.test(segment.trim())) {
        // This looks like spaced out text, remove spaces
        return segment.replace(/\s+/g, '')
      }
      return segment
    })
    
    cleaned = fixedSegments.join(' ')
    
    // Additional cleanup
    cleaned = cleaned.replace(/\s+([,.!?;:])/g, '$1') // Fix punctuation spacing
    cleaned = cleaned.replace(/\s+/g, ' ') // Final space normalization
    cleaned = cleaned.trim()
    
    console.log('Cleaned text sample:', cleaned.substring(0, 200))
    return cleaned
  }

  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Use pdfreader which is designed for Node.js
      const { PdfReader } = await import('pdfreader')
      
      return new Promise((resolve, reject) => {
        let text = ''
        
        new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
          if (err) {
            reject(err)
            return
          }
          
          if (!item) {
            // End of parsing - clean up the extracted text
            const cleanedText = this.cleanExtractedText(text)
            resolve(cleanedText)
            return
          }
          
          if (item.text) {
            text += item.text + ' '
          }
        })
      })
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  async checkSimilarity(currentPDFBuffer: Buffer, referencePDFBuffers: Buffer[]): Promise<SimilarityResult> {
    try {
      console.log('Starting similarity check with PDF attachments...')
      
      // Convert buffers to base64 for Gemini API
      const currentPDFBase64 = currentPDFBuffer.toString('base64')
      console.log('Current PDF size:', currentPDFBuffer.length, 'bytes')
      
      const referencePDFsBase64 = referencePDFBuffers.map((buffer, index) => {
        console.log(`Reference PDF ${index + 1} size:`, buffer.length, 'bytes')
        return buffer.toString('base64')
      })
      
      console.log('Reference PDFs count:', referencePDFsBase64.length)

      // Create the prompt for Gemini with PDF attachments
      const prompt = this.createSimilarityPromptWithPDFs()

      // Prepare the content parts for Gemini
      const contentParts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: currentPDFBase64
          }
        }
      ]

      // Add reference PDFs as attachments
      referencePDFsBase64.forEach((pdfBase64, index) => {
        contentParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        })
      })

      console.log('Sending', contentParts.length, 'parts to Gemini (1 prompt + 1 current PDF +', referencePDFsBase64.length, 'reference PDFs)')

      // Call Gemini API with PDF attachments
      console.log('Calling Gemini API with PDF attachments...')
      const result = await this.model.generateContent(contentParts)
      const response = await result.response
      const responseText = response.text()
      
      console.log('\n=== GEMINI RESPONSE ===')
      console.log('Response length:', responseText.length)
      console.log('Full response:')
      console.log(responseText)
      console.log('=== END RESPONSE ===\n')

      // Parse the response
      const parsedResult = this.parseSimilarityResponse(responseText)
      console.log('Parsed similarity result:', parsedResult)
      return parsedResult
    } catch (error) {
      console.error('Error checking similarity with Gemini:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error
      })
      throw new Error('Failed to check similarity')
    }
  }

  private createSimilarityPromptWithPDFs(): string {
    return `
You are analyzing academic submissions for plagiarism detection. You have been provided with:
1. The current student submission (PDF)
2. One or more reference PDFs from previous year projects

IMPORTANT INSTRUCTIONS:
1. Analyze the content of all PDFs directly - titles, abstracts, objectives, methodology, implementation details
2. Look for substantial overlaps in content, approach, and solutions
3. Check for similar problem statements, objectives, and technical approaches
4. Identify reused sections, methodologies, or implementation details
5. Consider structural similarities and content organization
6. Be thorough in your analysis - academic integrity is important

The first PDF is the current submission. The remaining PDFs are previous year reference projects.

Scoring Guidelines:
- 0-20: Completely different projects
- 21-40: Some common elements but clearly different work
- 41-60: Notable similarities that warrant attention
- 61-80: Significant overlap indicating possible plagiarism
- 81-100: Very high similarity suggesting direct copying

Provide a JSON response:
{
  "similarityScore": <number 0-100>,
  "explanation": "<detailed explanation of similarities found, mentioning specific reference documents if similar>",
  "isSimilar": <boolean true if score >= 40, false otherwise>,
  "similarProjects": ["Reference Document 1", "Reference Document 2"]
}

Be thorough and flag projects that share significant content, methods, or approaches. Analyze the actual PDF content, not just titles.
`
  }

  private createSimilarityPrompt(currentText: string, referenceTexts: string[]): string {
    const referenceDocs = referenceTexts.map((text, index) => 
      `Reference Project ${index + 1} (Previous Year Submission):\n${text}\n\n`
    ).join('')

    return `
You are analyzing academic submissions for plagiarism detection. Compare the current submission with previous year projects.

Current Student Submission:
${currentText}

Previous Year Projects:
${referenceDocs}

IMPORTANT INSTRUCTIONS:
1. Look for substantial overlaps in content, methodology, and approach
2. Check for similar problem statements, objectives, and solutions
3. Identify reused sections, methodologies, or implementation details
4. Consider structural similarities and content organization
5. Be thorough in your analysis - academic integrity is important

Scoring Guidelines:
- 0-20: Completely different projects
- 21-40: Some common elements but clearly different work
- 41-60: Notable similarities that warrant attention
- 61-80: Significant overlap indicating possible plagiarism
- 81-100: Very high similarity suggesting direct copying

Provide a JSON response:
{
  "similarityScore": <number 0-100>,
  "explanation": "<detailed explanation of similarities found>",
  "isSimilar": <boolean true if score >= 40, false otherwise>,
  "similarProjects": ["Reference Project 1"]
}

Be thorough and flag projects that share significant content, methods, or approaches.
`
  }

  private parseSimilarityResponse(responseText: string): SimilarityResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        similarityScore: parseInt(parsed.similarityScore) || 0,
        explanation: parsed.explanation || 'No explanation provided',
        isSimilar: parsed.similarityScore >= 40,
        similarProjects: parsed.similarProjects || []
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error)
      
      // Fallback parsing if JSON parsing fails
      const scoreMatch = responseText.match(/(\d{1,3})%?/)
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0
      
      return {
        similarityScore: score,
        explanation: 'Analysis completed but response format was unexpected',
        isSimilar: score >= 50
      }
    }
  }
}

export const geminiService = new GeminiService()