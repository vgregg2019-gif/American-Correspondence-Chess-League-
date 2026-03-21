import { NextRequest, NextResponse } from "next/server";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('[Move API] HIT /api/move route');

  try {
    console.log('[Move API] ===== NEW REQUEST RECEIVED =====');
    console.log('[Move API] Request method:', req.method);
    console.log('[Move API] Request URL:', req.url);

    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    console.log('[Move API] ===== REQUEST BODY PARSED =====');
    console.log('[Move API] gameId:', gameId);
    console.log('[Move API] playerId:', playerId);
    console.log('[Move API] from:', from);
    console.log('[Move API] to:', to);

    console.log('[Move API] ===== COOKIE HEADER DEBUG =====');

    // Log server environment Supabase config
    const serverSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serverSupabaseProjectRef = serverSupabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    console.log('[Move API] Server NEXT_PUBLIC_SUPABASE_URL:', serverSupabaseUrl);
    console.log('[Move API] Server Supabase project ref:', serverSupabaseProjectRef);

    // CRITICAL: Check raw Cookie header first
    const rawCookieHeader = req.headers.get('cookie');
    console.log('[Move API] Raw Cookie header present:', !!rawCookieHeader);
    console.log('[Move API] Raw Cookie header length:', rawCookieHeader?.length || 0);
    console.log('[Move API] Raw Cookie header value (first 200 chars):', rawCookieHeader?.substring(0, 200));

    // Check req.cookies.getAll()
    const parsedCookies = req.cookies.getAll();
    console.log('[Move API] req.cookies.getAll() count:', parsedCookies.length);
    console.log('[Move API] req.cookies.getAll() names:', parsedCookies.map(c => c.name));

    let cookieNames: string[] = [];
    let cookieProjectRef: string | undefined;

    if (rawCookieHeader) {
      cookieNames = rawCookieHeader.split(';').map(c => c.trim().split('=')[0]);
      console.log('[Move API] Cookie names from raw header:', cookieNames);

      // Extract Supabase project ref from cookie names
      const supabaseCookie = cookieNames.find(name => name.startsWith('sb-') && name.includes('-auth-token'));
      cookieProjectRef = supabaseCookie?.match(/sb-([^-]+)-auth-token/)?.[1];
      console.log('[Move API] Cookie Supabase project ref:', cookieProjectRef);
      console.log('[Move API] PROJECT REF MATCH:', serverSupabaseProjectRef === cookieProjectRef ? '✓ MATCH' : '✗ MISMATCH');
    }

    // TEMPORARY: Return cookie debug info
    return NextResponse.json({
      marker: "COOKIE_HEADER_DEBUG_V1",
      raw_cookie_header_present: !!rawCookieHeader,
      raw_cookie_header_length: rawCookieHeader?.length || 0,
      raw_cookie_header_sample: rawCookieHeader?.substring(0, 300),
      parsed_cookies_count: parsedCookies.length,
      parsed_cookie_names: parsedCookies.map(c => c.name),
      cookie_names_from_raw_header: cookieNames,
      has_supabase_cookie_in_raw: cookieNames.some(n => n.startsWith('sb-') && n.includes('-auth-token')),
      server_project_ref: serverSupabaseProjectRef,
      cookie_project_ref: cookieProjectRef,
      project_ref_match: serverSupabaseProjectRef === cookieProjectRef,
    }, { status: 200 });
  } catch (error) {
    console.error('[Move API] Unexpected error:', error);
    return NextResponse.json(
      {
        step: "unexpected_error",
        error: error instanceof Error ? error.message : "Unknown server error",
        message: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
