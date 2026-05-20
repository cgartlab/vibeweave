import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export async function getUserFromRequest(req: Request): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { userId: '', error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return { userId: '', error: 'Invalid token: ' + error.message };
    }
    
    if (!user) {
      return { userId: '', error: 'Invalid token: User not found' };
    }
    
    return { userId: user.id };
  } catch (err) {
    return { userId: '', error: 'Invalid token: ' + String(err) };
  }
}