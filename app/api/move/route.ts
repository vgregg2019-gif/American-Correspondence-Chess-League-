import { NextRequest, NextResponse } from "next/server";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";
import { createServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[Move API] ===== POST /api/move REQUEST =====');
    console.log('[Move API] Headers:', Object.fromEntries(req.headers.entries()));

    const allCookies = req.cookies.getAll();
    const authCookies = allCookies.filter(c => c.name.includes('sb-') || c.name.includes('auth'));
    console.log('[Move API] Total cookies:', allCookies.length);
    console.log('[Move API] Auth cookies:', authCookies.length);
    console.log('[Move API] Auth cookie names:', authCookies.map(c => c.name));

    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    if (!gameId || !playerId || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[Move API] Creating Supabase client...');
    const supabase = await createServerClient();

    // In Route Handlers, use getSession() because cookies are read-only
    // getUser() requires the ability to refresh tokens which needs cookie writes
    // Middleware already refreshed the session, so getSession() is safe
    console.log('[Move API] Calling getSession()...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const user = session?.user;

    console.log('[Move API] getSession() result:', {
      hasSession: !!session,
      hasUser: !!user,
      userId: user?.id,
      hasError: !!sessionError,
      errorMessage: sessionError?.message
    });

    if (sessionError || !user) {
      console.error('[Move API] ❌ Authentication failed - returning 401');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('[Move API] ✓ User authenticated:', user.id);

    if (user.id !== playerId) {
      // [Move API] User ID mismatch');
      return NextResponse.json(
        { error: 'Player ID does not match authenticated user' },
        { status: 403 }
      );
    }

    // [Move API] Fetching game from database...');
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'active') {
      // [Move API] Game not active:', game.status);
      return NextResponse.json(
        { error: 'Game is not active' },
        { status: 400 }
      );
    }

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    if (!isWhite && !isBlack) {
      // [Move API] Player not in this game');
      return NextResponse.json(
        { error: 'You are not a player in this game' },
        { status: 403 }
      );
    }

    const currentFen = game.current_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenParts = currentFen.split(' ');
    const currentTurn = fenParts[1] === 'w' ? 'white' : 'black';
    const playerColor = isWhite ? 'white' : 'black';

    if (currentTurn !== playerColor) {
      return NextResponse.json(
        { error: 'Not your turn' },
        { status: 400 }
      );
    }

    // [Move API] Validating move...');
    const moveResult = applyMove({
      fen: currentFen,
      move: { from, to, promotion }
    });

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
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

    // [Move API] Next move number:', nextMoveNumber);

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

    // [Move API] Clock calculation:', clockUpdate);

    let newStatus: 'active' | 'finished' = 'active';
    let newResult: string | null = null;

    if (moveResult.isCheckmate) {
      newStatus = 'finished';
      newResult = isWhite ? '1-0' : '0-1';
      // [Move API] Checkmate! Result:', newResult);
    } else if (moveResult.isDraw || moveResult.isStalemate) {
      newStatus = 'finished';
      newResult = '1/2-1/2';
      // [Move API] Draw! Result:', newResult);
    }

    const nextTurn: 'white' | 'black' = currentTurn === 'white' ? 'black' : 'white';
    const nextTimeoutAt = newStatus === 'active'
      ? getNextTimeoutAt(nextTurn, clockUpdate.whiteRemaining, clockUpdate.blackRemaining, now)
      : null;

    // [Move API] Inserting move into database...');
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

    if (moveInsertError) {
      return NextResponse.json(
        { error: 'Failed to save move' },
        { status: 500 }
      );
    }

    // [Move API] Updating game state...');
    const { data: updatedGame, error: gameUpdateError } = await supabase
      .from('games')
      .update({
        current_fen: moveResult.fen,
        turn: nextTurn,
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

    if (gameUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update game' },
        { status: 500 }
      );
    }

    // [Move API] ✓ Move processed successfully');
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
