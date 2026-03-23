import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // [Middleware] Processing request:', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] Missing Supabase environment variables');
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // CRITICAL: This refreshes the session and ensures cookies are up-to-date
  const { data: { session }, error } = await supabase.auth.getSession();

  const allCookies = request.cookies.getAll();
  const authCookies = allCookies.filter(c => c.name.includes('sb-') || c.name.includes('auth'));

  // [Middleware] ===== REQUEST PROCESSING =====');
  // [Middleware] Path:', request.nextUrl.pathname);
  // [Middleware] Method:', request.method);
  // [Middleware] Total cookies:', allCookies.length);
  // [Middleware] Auth cookies:', authCookies.length);

  if (session) {
  } else if (error) {
    // [Middleware] ❌ Session error:', error.message);
  } else {
    // [Middleware] ⚠️ No session (user not logged in)');
  }

  // [Middleware] ===== END REQUEST PROCESSING =====');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
