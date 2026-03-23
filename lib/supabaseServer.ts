import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  console.log('[supabaseServer] Creating server client');
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
          console.log('[supabaseServer] Cookie names:', cookiesToSet.map(c => c.name));

          // Try to set cookies - this may fail silently in Route Handlers during read phase
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
            console.log('[supabaseServer] ✓ Cookies set successfully');
          } catch (error) {
            console.error('[supabaseServer] ⚠️ Failed to set cookies:', error instanceof Error ? error.message : 'Unknown error');
            // Don't throw - this is expected in Route Handlers during read phase
          }
        },
      },
    }
  );
}
