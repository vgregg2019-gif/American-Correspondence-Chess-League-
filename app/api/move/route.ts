import { NextRequest, NextResponse } from "next/server";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";
import { createServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('[Move API] ===== NEW MOVE REQUEST =====');

  try {
    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    console.log('[Move API] Request:', { gameId, playerId, from, to, promotion });

    if (!gameId || !playerId || !from || !to) {
      console.log('[Move API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for Authorization header first (more reliable than cookies)
    const authHeader = req.headers.get('authorization');
    console.log('[Move API] Auth header present:', !!authHeader);

    // Log all cookies to debug auth issue
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const authCookies = allCookies.filter(c => c.name.includes('sb-') || c.name.includes('auth'));

    console.log('[Move API] ===== AUTH DEBUG =====');
    console.log('[Move API] Authorization header:', authHeader ? 'present (Bearer token)' : 'MISSING');
    console.log('[Move API] Total cookies:', allCookies.length);
    console.log('[Move API] Auth cookies:', authCookies.length);

    if (authCookies.length > 0) {
      authCookies.forEach(cookie => {
        console.log(`[Move API]   Cookie: ${cookie.name} (${cookie.value?.length || 0} chars)`);
      });
    }

    console.log('[Move API] ===== END AUTH DEBUG =====');

    const supabase = await createServerClient();

    // Try to get session from header token first, fall back to cookies
    let session = null;
    let sessionError = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('[Move API] Using Authorization header token');
      const { data, error } = await supabase.auth.getUser(token);
      if (data.user) {
        session = { user: data.user, access_token: token };
      }
      sessionError = error;
    } else {
      console.log('[Move API] Trying cookie-based session');
      const { data, error } = await supabase.auth.getSession();
      session = data.session;
      sessionError = error;
    }

    console.log('[Move API] ===== SESSION DEBUG =====');
    console.log('[Move API] Session check result:', {
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      sessionUserEmail: session?.user?.email,
      sessionError: sessionError?.message,
      sessionErrorName: sessionError?.name,
      sessionErrorStatus: sessionError?.status,
      accessToken: session?.access_token ? 'present (' + session.access_token.substring(0, 20) + '...)' : 'missing',
      refreshToken: session?.refresh_token ? 'present (length: ' + session.refresh_token.length + ')' : 'missing',
    });

    if (sessionError) {
      console.log('[Move API] ❌ Session error details:', {
        message: sessionError.message,
        name: sessionError.name,
        status: sessionError.status,
        fullError: JSON.stringify(sessionError, null, 2)
      });
    }

    if (!session) {
      console.log('[Move API] ❌ No session object returned');
      console.log('[Move API] Possible causes:');
      console.log('[Move API]   1. User not logged in');
      console.log('[Move API]   2. Session expired');
      console.log('[Move API]   3. Auth cookies not being sent from client');
      console.log('[Move API]   4. Middleware not refreshing session');
      console.log('[Move API]   5. Cookie domain/path mismatch');
    }

    if (!session?.user) {
      console.log('[Move API] ❌ No user in session');
    }

    console.log('[Move API] ===== END SESSION DEBUG =====');

    if (sessionError || !session?.user) {
      console.log('[Move API] 🚫 RETURNING 401 - Not authenticated');
      console.log('[Move API] Reason:', !session ? 'No session' : !session.user ? 'No user in session' : sessionError?.message);
      return NextResponse.json(
        {
          error: 'Not authenticated',
          debug: {
            hasSession: !!session,
            hasUser: !!session?.user,
            sessionError: sessionError?.message,
            cookieCount: allCookies.length,
            authCookieCount: authCookies.length,
          }
        },
        { status: 401 }
      );
    }

    const user = session.user;

    console.log('[Move API] Auth validated:', {
      userId: user.id,
      providedPlayerId: playerId,
      match: user.id === playerId
    });

    if (user.id !== playerId) {
      console.log('[Move API] User ID mismatch');
      return NextResponse.json(
        { error: 'Player ID does not match authenticated user' },
        { status: 403 }
      );
    }

    console.log('[Move API] Fetching game from database...');
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

    console.log('[Move API] Game fetch result:', {
      hasGame: !!game,
      gameId: game?.id,
      status: game?.status,
      currentFen: game?.current_fen,
      error: gameError?.message
    });

    if (gameError || !game) {
      console.log('[Move API] Game not found');
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'active') {
      console.log('[Move API] Game not active:', game.status);
      return NextResponse.json(
        { error: 'Game is not active' },
        { status: 400 }
      );
    }

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    if (!isWhite && !isBlack) {
      console.log('[Move API] Player not in this game');
      return NextResponse.json(
        { error: 'You are not a player in this game' },
        { status: 403 }
      );
    }

    const currentFen = game.current_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenParts = currentFen.split(' ');
    const currentTurn = fenParts[1] === 'w' ? 'white' : 'black';
    const playerColor = isWhite ? 'white' : 'black';

    console.log('[Move API] Turn validation:', {
      currentTurn,
      playerColor,
      isPlayerTurn: currentTurn === playerColor
    });

    if (currentTurn !== playerColor) {
      console.log('[Move API] Not player turn');
      return NextResponse.json(
        { error: 'Not your turn' },
        { status: 400 }
      );
    }

    console.log('[Move API] Validating move...');
    const moveResult = applyMove({
      fen: currentFen,
      move: { from, to, promotion }
    });

    console.log('[Move API] Move validation result:', {
      ok: moveResult.ok,
      san: moveResult.san,
      newFen: moveResult.fen,
      error: moveResult.error
    });

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
      console.log('[Move API] Invalid move');
      return NextResponse.json(
        { error: moveResult.error || 'Invalid move' },
        { status: 400 }
      );
    }

    const { data: movesCount } = await supabase
      .from('moves')
      .select('move_number', { count: 'exact', head: false })
      .eq('game_id', gameId)
      .order('move_number', { ascending: false })
      .limit(1);

    const nextMoveNumber = (movesCount && movesCount.length > 0)
      ? movesCount[0].move_number + 1
      : 1;

    console.log('[Move API] Next move number:', nextMoveNumber);

    const now = new Date();
    const nowISO = now.toISOString();

    const clockState: {
      turn: 'white' | 'black';
      white_time_remaining_seconds: number;
      black_time_remaining_seconds: number;
      last_move_at: string;
    } = {
      turn: currentTurn as 'white' | 'black',
      white_time_remaining_seconds: game.white_time_remaining_seconds,
      black_time_remaining_seconds: game.black_time_remaining_seconds,
      last_move_at: game.last_move_at,
    };

    const clockUpdate = calculateClock(clockState, now);

    console.log('[Move API] Clock calculation:', clockUpdate);

    let newStatus: 'active' | 'finished' = 'active';
    let newResult: string | null = null;

    if (moveResult.isCheckmate) {
      newStatus = 'finished';
      newResult = isWhite ? '1-0' : '0-1';
      console.log('[Move API] Checkmate! Result:', newResult);
    } else if (moveResult.isDraw || moveResult.isStalemate) {
      newStatus = 'finished';
      newResult = '1/2-1/2';
      console.log('[Move API] Draw! Result:', newResult);
    }

    const nextTurn: 'white' | 'black' = currentTurn === 'white' ? 'black' : 'white';
    const nextTimeoutAt = newStatus === 'active'
      ? getNextTimeoutAt(nextTurn, clockUpdate.whiteRemaining, clockUpdate.blackRemaining, now)
      : null;

    console.log('[Move API] Inserting move into database...');
    const { data: insertedMove, error: moveInsertError } = await supabase
      .from('moves')
      .insert({
        game_id: gameId,
        player_id: playerId,
        move_number: nextMoveNumber,
        move: moveResult.san,
        fen: moveResult.fen,
      })
      .select()
      .single();

    console.log('[Move API] Move insert result:', {
      success: !!insertedMove,
      moveId: insertedMove?.id,
      error: moveInsertError?.message
    });

    if (moveInsertError) {
      console.log('[Move API] Failed to insert move');
      return NextResponse.json(
        { error: 'Failed to save move' },
        { status: 500 }
      );
    }

    console.log('[Move API] Updating game state...');
    const { data: updatedGame, error: gameUpdateError } = await supabase
      .from('games')
      .update({
        current_fen: moveResult.fen,
        status: newStatus,
        result: newResult,
        last_move_at: nowISO,
        white_time_remaining_seconds: clockUpdate.whiteRemaining,
        black_time_remaining_seconds: clockUpdate.blackRemaining,
        timeout_at: nextTimeoutAt,
      })
      .eq('id', gameId)
      .select()
      .single();

    console.log('[Move API] Game update result:', {
      success: !!updatedGame,
      newFen: updatedGame?.current_fen,
      status: updatedGame?.status,
      result: updatedGame?.result,
      error: gameUpdateError?.message
    });

    if (gameUpdateError) {
      console.log('[Move API] Failed to update game');
      return NextResponse.json(
        { error: 'Failed to update game' },
        { status: 500 }
      );
    }

    console.log('[Move API] ✓ Move processed successfully');
    return NextResponse.json({
      success: true,
      moveId: insertedMove.id,
      fen: moveResult.fen,
      san: moveResult.san,
      status: newStatus,
      result: newResult,
    });

  } catch (error) {
    console.error('[Move API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
