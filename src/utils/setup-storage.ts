import { supabase } from '@/app/supabaseClient'

export async function findSubmissionsBucket() {
  try {
    // List available buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return { success: false, bucketName: null, availableBuckets: [] }
    }

    console.log('Available buckets:', buckets?.map(b => b.name))

    // Check if any submission-related bucket exists
    const submissionBuckets = buckets?.filter(bucket => 
      ['submissions', 'submission-files', 'files', 'uploads', 'documents', 'attachments'].includes(bucket.name)
    )

    if (submissionBuckets && submissionBuckets.length > 0) {
      return { success: true, bucketName: submissionBuckets[0].name, availableBuckets: buckets?.map(b => b.name) || [] }
    }

    // If no common bucket names found, try the first available bucket
    if (buckets && buckets.length > 0) {
      return { success: true, bucketName: buckets[0].name, availableBuckets: buckets.map(b => b.name) }
    }

    return { success: false, bucketName: null, availableBuckets: [] }
  } catch (error) {
    console.error('Error in findSubmissionsBucket:', error)
    return { success: false, bucketName: null, availableBuckets: [] }
  }
}

export function getSubmissionFileUrl(bucketName: string, fileName: string): string {
  return `https://yizreuianmkswuiibhsd.storage.supabase.co/storage/v1/s3/${bucketName}/${fileName}`
}
