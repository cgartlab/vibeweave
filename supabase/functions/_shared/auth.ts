export async function getUserFromRequest(req: Request): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { userId: '', error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // In Deno edge runtime, we'd use the Supabase auth helper
    // For now, decode the JWT to get the user ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.sub };
  } catch {
    return { userId: '', error: 'Invalid token' };
  }
}
