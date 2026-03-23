import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';

export async function createServerClient(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // If called from Route Handler with request object, use request cookies directly
  if (request) {
    console.log('[supabaseServer] Creating client from NextRequest');
    console.log('[supabaseServer] Request cookies:', request.cookies.getAll().length);

    return createSupabaseServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            const allCookies = request.cookies.getAll();
            console.log('[supabaseServer] getAll() from NextRequest - returning', allCookies.length, 'cookies');
            return allCookies;
          },
          setAll(cookiesToSet) {
            // In Route Handlers, we can't set cookies on the request
            // This is expected and safe - we're just reading the session
            console.log('[supabaseServer] setAll() called (no-op in Route Handler)');
          },
        },
      }
    );
  }

  // Otherwise use next/headers cookies (for Server Components, Server Actions)
  const cookieStore = await cookies();
  console.log('[supabaseServer] Creating server client from cookies()');
  console.log('[supabaseServer] Cookies available:', cookieStore.getAll().length);

  return createSupabaseServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          const allCookies = cookieStore.getAll();
          console.log('[supabaseServer] getAll() called - returning', allCookies.length, 'cookies');
          return allCookies;
        },
        setAll(cookiesToSet) {
          console.log('[supabaseServer] setAll() called with', cookiesToSet.length, 'cookies');

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
            console.log('[supabaseServer] ✓ Cookies set successfully');
          } catch (error) {
            console.error('[supabaseServer] ⚠️ Failed to set cookies:', error instanceof Error ? error.message : 'Unknown error');
          }
        },
      },
    }
  );
}
