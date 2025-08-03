import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yizreuianmkswuiibhsd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpenJldWlhbm1rc3d1aWliaHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NTMxMTMsImV4cCI6MjA2ODMyOTExM30.1oF0sgVBb-QAnWxxUdHkiefVCrlZqDwPx0l7Ebb1HPw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 