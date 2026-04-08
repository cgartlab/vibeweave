import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

export function createSupabaseServerClient(request: Request) {
  let supabaseResponse = new Response();

  const supabase = createServerClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies: { name: string; value: string }[] = [];
          request.headers.get('cookie')?.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            if (name && rest.length > 0) {
              cookies.push({ name, value: rest.join('=') });
            }
          });
          return cookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.headers.append(
              'Set-Cookie',
              serializeCookie(name, value, options)
            );
          });
        },
      },
    }
  );

  return { supabase, response: supabaseResponse };
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function createSupabaseServerRouteHandler(request: Request) {
  let supabaseResponse = new Response();

  const supabase = createServerClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies: { name: string; value: string }[] = [];
          request.headers.get('cookie')?.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            if (name && rest.length > 0) {
              cookies.push({ name, value: rest.join('=') });
            }
          });
          return cookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.headers.append(
              'Set-Cookie',
              serializeCookie(name, value, options)
            );
          });
        },
      },
    }
  );

  return { supabase, response: supabaseResponse };
}
