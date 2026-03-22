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

    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Move API] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      providedPlayerId: playerId,
      authError: authError?.message
    });

    if (authError || !user) {
      console.log('[Move API] Authentication failed');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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
