import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[Move API] Processing move request');

    const authHeader = req.headers.get('authorization');
    console.log('[Move API] ===== AUTH CHECK =====');
    console.log('[Move API] Authorization header present:', !!authHeader);
    console.log('[Move API] Authorization header value (first 20 chars):', authHeader ? authHeader.substring(0, 20) + '...' : 'N/A');

    if (!authHeader) {
      return NextResponse.json({
        step: "auth",
        error: "Missing authorization",
        message: "Authorization header is required"
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Move API] Token extracted (first 20 chars):', token.substring(0, 20) + '...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log('[Move API] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlValue: supabaseUrl,
      keyPrefix: supabaseKey?.substring(0, 20)
    });

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        step: "config",
        error: "Supabase configuration missing",
        message: "Server environment variables not configured",
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }, { status: 500 });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    console.log('[Move API] Verifying user from token...');
    const authResult = await supabase.auth.getUser(token);
    const { data: { user }, error: authError } = authResult;

    console.log('[Move API] auth.getUser() result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      hasError: !!authError,
      errorMessage: authError?.message,
      errorStatus: authError?.status,
    });

    if (authError || !user) {
      console.error('[Move API] Auth verification failed:', authError);
      return NextResponse.json({
        step: "auth",
        error: "Invalid authorization",
        message: authError?.message || "Could not verify user token"
      }, { status: 401 });
    }

    console.log('[Move API] ✓ Authenticated user ID:', user.id);

    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    console.log('[Move API] Request body:', { gameId, playerId, from, to, promotion });

    if (user.id !== playerId) {
      return NextResponse.json({
        step: "auth",
        error: "Player ID mismatch",
        message: "Authenticated user does not match playerId in request"
      }, { status: 403 });
    }

    if (!gameId || !playerId || !from || !to) {
      console.error('[Move API] Missing required fields');
      return NextResponse.json({
        step: "validation",
        error: "Missing required fields",
        message: "Required fields: gameId, playerId, from, to",
        details: { gameId: !!gameId, playerId: !!playerId, from: !!from, to: !!to }
      }, { status: 400 });
    }

    console.log('[Move API] ===== GAME FETCH =====');
    console.log('[Move API] Game ID to fetch:', gameId);

    const supabaseHost = new URL(supabaseUrl).hostname;
    console.log('[Move API] Supabase project host:', supabaseHost);
    console.log('[Move API] Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('[Move API] Using anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('[Move API] Auth method: Bearer token from frontend (anon key + user token)');
    console.log('[Move API] Auth context in client:', user.id);
    console.log('[Move API] RLS will be enforced: YES (using anon key with user auth)');

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: adminGameCheck } = await adminClient
        .from("games")
        .select("id, white_player_id, black_player_id, status")
        .eq("id", gameId)
        .maybeSingle();

      console.log('[Move API] 🔍 Admin check (bypasses RLS):', {
        gameExists: !!adminGameCheck,
        gameId: adminGameCheck?.id,
        whitePlayerId: adminGameCheck?.white_player_id,
        blackPlayerId: adminGameCheck?.black_player_id,
        status: adminGameCheck?.status,
        userIsWhite: adminGameCheck?.white_player_id === user.id,
        userIsBlack: adminGameCheck?.black_player_id === user.id,
        userShouldHaveAccess: adminGameCheck ?
          (adminGameCheck.white_player_id === user.id || adminGameCheck.black_player_id === user.id) :
          false,
      });
    } else {
      console.log('[Move API] ⚠️  No service role key available - skipping admin check');
    }

    const selectQuery = `
        id,
        white_player_id,
        black_player_id,
        current_fen,
        turn,
        status,
        winner_id,
        time_control,
        white_time_remaining_seconds,
        black_time_remaining_seconds,
        last_move_at,
        timeout_at,
        created_at,
        updated_at
      `;

    console.log('[Move API] Query: SELECT', selectQuery.trim(), 'FROM games WHERE id =', gameId);

    const queryBuilder = supabase
      .from("games")
      .select(selectQuery)
      .eq("id", gameId);

    console.log('[Move API] Query built, executing .maybeSingle()...');
    console.log('[Move API] Expected RLS to pass if user is white_player_id OR black_player_id');
    console.log('[Move API] User auth.uid():', user.id);

    const result = await queryBuilder.maybeSingle();
    const { data: game, error: gameError, status: responseStatus, statusText: responseStatusText } = result;

    console.log('[Move API] ===== RAW SUPABASE RESPONSE =====');
    console.log('[Move API] Response status:', responseStatus);
    console.log('[Move API] Response statusText:', responseStatusText);
    console.log('[Move API] Has data:', !!game);
    console.log('[Move API] Has error:', !!gameError);

    if (gameError) {
      console.log('[Move API] Error code:', gameError.code);
      console.log('[Move API] Error message:', gameError.message);
      console.log('[Move API] Error details:', gameError.details);
      console.log('[Move API] Error hint:', gameError.hint);
      console.log('[Move API] Full error object:', JSON.stringify(gameError, null, 2));

      if (gameError.code === 'PGRST116') {
        console.log('[Move API] ⚠️  PGRST116 = No rows returned (either no match OR RLS denied)');
      }
    }

    if (game) {
      console.log('[Move API] Game data:', {
        id: game.id,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        status: game.status,
        turn: game.turn,
      });
      console.log('[Move API] ✓ Game fetched successfully');
    } else {
      console.log('[Move API] ✗ No game data returned');
    }

    if (gameError || !game) {
      console.error('[Move API] ❌ Game fetch failed or returned null');
      console.error('[Move API] This usually means:');
      console.error('[Move API]   1. Game ID does not exist in database, OR');
      console.error('[Move API]   2. RLS policy blocked access (user not white_player_id or black_player_id)');
      console.error('[Move API] Error details:', {
        hasError: !!gameError,
        hasGame: !!game,
        errorCode: gameError?.code,
        errorMessage: gameError?.message,
        gameId: gameId,
        userId: user.id,
      });

      return NextResponse.json({
        step: "game_fetch",
        error: "Game not found",
        message: gameError?.message || "Game does not exist or you don't have access",
        code: gameError?.code,
        details: gameError?.details,
        hint: gameError?.hint,
        debug: {
          gameId,
          userId: user.id,
          possibleCauses: [
            'Game does not exist',
            'User is not white_player_id or black_player_id',
            'RLS policy blocking access'
          ]
        }
      }, { status: 404 });
    }

    console.log('[Move API] Time values from database:', {
      white_time_remaining_seconds: game.white_time_remaining_seconds,
      black_time_remaining_seconds: game.black_time_remaining_seconds,
      last_move_at: game.last_move_at,
      time_control: game.time_control,
      timeout_at: game.timeout_at,
      typeOf_white_time: typeof game.white_time_remaining_seconds,
      typeOf_black_time: typeof game.black_time_remaining_seconds,
    });

    if (game.status !== "active") {
      return NextResponse.json({
        step: "game_status",
        error: "Game is not active",
        message: `Game status is: ${game.status}`,
        details: { currentStatus: game.status, requiredStatus: "active" }
      }, { status: 400 });
    }

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    if (!isWhite && !isBlack) {
      console.log('[Move API] 403: User not a player in this game', {
        playerId,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
      });
      return NextResponse.json({
        step: "auth",
        error: "User is not a player in this game",
        message: "You are not authorized to make moves in this game",
        details: {
          playerId,
          whitePlayerId: game.white_player_id,
          blackPlayerId: game.black_player_id
        }
      }, { status: 403 });
    }

    const playerColor = isWhite ? "white" : "black";

    const fenTurn = game.current_fen.split(' ')[1];
    const currentTurn = fenTurn === 'w' ? 'white' : 'black';

    console.log('[Move API] Turn validation:', {
      playerId,
      white_player_id: game.white_player_id,
      black_player_id: game.black_player_id,
      playerColor,
      current_fen: game.current_fen,
      fenTurn,
      currentTurn,
      gameTurnColumn: game.turn,
      isPlayersTurn: currentTurn === playerColor,
    });

    if (currentTurn !== playerColor) {
      console.log('[Move API] 403: Not your turn', {
        playerColor,
        currentTurn,
        reason: `Current turn is ${currentTurn}, but you are ${playerColor}`,
      });
      return NextResponse.json({
        step: "turn_validation",
        error: "Not your turn",
        message: `Current turn is ${currentTurn}, you are ${playerColor}`,
        details: { playerColor, currentTurn, fen: game.current_fen }
      }, { status: 403 });
    }

    const nowIso = new Date().toISOString();

    let clock: {
      whiteRemaining: number;
      blackRemaining: number;
      activeColor: "white" | "black";
      timedOut: boolean;
      timedOutColor?: "white" | "black";
    };

    if (!game.last_move_at) {
      console.log('[Move API] First move - using initial time values');
      const whiteTime = game.white_time_remaining_seconds ?? 172800;
      const blackTime = game.black_time_remaining_seconds ?? 172800;

      clock = {
        whiteRemaining: whiteTime,
        blackRemaining: blackTime,
        activeColor: currentTurn,
        timedOut: false,
        timedOutColor: undefined,
      };

      console.log('[Move API] First move clock:', clock);
    } else {
      console.log('[Move API] Calculating clock for non-first move');
      try {
        clock = calculateClock({
          turn: currentTurn,
          white_time_remaining_seconds: game.white_time_remaining_seconds ?? 172800,
          black_time_remaining_seconds: game.black_time_remaining_seconds ?? 172800,
          last_move_at: game.last_move_at,
        });
        console.log('[Move API] Clock calculated:', clock);
      } catch (error) {
        console.error('[Move API] Clock calculation error:', error);
        return NextResponse.json({
          step: "clock_calculation",
          error: "Clock calculation failed",
          message: error instanceof Error ? error.message : 'Unknown error',
          details: {
            turn: currentTurn,
            whiteTime: game.white_time_remaining_seconds,
            blackTime: game.black_time_remaining_seconds,
            lastMoveAt: game.last_move_at
          },
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
      }

      if (clock.timedOut) {
        const winnerId =
          clock.timedOutColor === "white" ? game.black_player_id : game.white_player_id;

        await supabase
          .from("games")
          .update({
            status: "finished",
            winner_id: winnerId,
            white_time_remaining_seconds: clock.whiteRemaining,
            black_time_remaining_seconds: clock.blackRemaining,
            updated_at: nowIso,
          })
          .eq("id", gameId);

        return NextResponse.json({
          step: "timeout_check",
          error: "Game already ended on time",
          message: `${clock.timedOutColor} ran out of time`,
          details: {
            timedOutColor: clock.timedOutColor,
            whiteRemaining: clock.whiteRemaining,
            blackRemaining: clock.blackRemaining
          }
        }, { status: 400 });
      }
    }

    console.log('[Move API] Applying move to position:', game.current_fen);

    const moveResult = applyMove({
      fen: game.current_fen,
      move: { from, to, promotion },
    });

    console.log('[Move API] Move validation result:', moveResult);

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
      console.error('[Move API] Illegal move:', moveResult.error);
      return NextResponse.json({
        step: "move_validation",
        error: "Illegal move",
        message: moveResult.error || "The move is not legal in the current position",
        details: { from, to, promotion, fen: game.current_fen }
      }, { status: 400 });
    }

    const nextTurn = playerColor === "white" ? "black" : "white";

    const newWhiteTime =
      playerColor === "white" ? clock.whiteRemaining : (game.white_time_remaining_seconds ?? 172800);

    const newBlackTime =
      playerColor === "black" ? clock.blackRemaining : (game.black_time_remaining_seconds ?? 172800);

    console.log('[Move API] Time values for update:', {
      playerColor,
      clockWhite: clock.whiteRemaining,
      clockBlack: clock.blackRemaining,
      newWhiteTime,
      newBlackTime,
    });

    let status: 'active' | 'finished' = "active";
    let winnerId: string | null = null;
    let timeoutAt: string | null = null;

    console.log('[Move API] About to calculate timeout with:', {
      nextTurn,
      newWhiteTime,
      newBlackTime,
      typeOf_newWhiteTime: typeof newWhiteTime,
      typeOf_newBlackTime: typeof newBlackTime,
      isNaN_newWhiteTime: isNaN(newWhiteTime),
      isNaN_newBlackTime: isNaN(newBlackTime),
    });

    try {
      if (typeof newWhiteTime !== 'number' || typeof newBlackTime !== 'number' ||
          isNaN(newWhiteTime) || isNaN(newBlackTime)) {
        throw new Error(`Invalid time values: white=${newWhiteTime}, black=${newBlackTime}`);
      }

      timeoutAt = getNextTimeoutAt(nextTurn, newWhiteTime, newBlackTime, new Date());
      console.log('[Move API] Next timeout calculated:', {
        nextTurn,
        newWhiteTime,
        newBlackTime,
        timeoutAt,
      });
    } catch (error) {
      console.error('[Move API] Error calculating timeout:', error);
      console.error('[Move API] Timeout error details:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      timeoutAt = new Date(Date.now() + 172800 * 1000).toISOString();
    }

    if (moveResult.isCheckmate) {
      status = "finished";
      winnerId = playerId;
      timeoutAt = null;
    } else if (
      moveResult.isDraw ||
      moveResult.isStalemate ||
      moveResult.isInsufficientMaterial ||
      moveResult.isThreefoldRepetition
    ) {
      status = "finished";
      winnerId = null;
      timeoutAt = null;
    }

    const { data: movesCount } = await supabase
      .from("moves")
      .select("move_number", { count: 'exact' })
      .eq("game_id", gameId)
      .order("move_number", { ascending: false })
      .limit(1);

    const moveNumber = movesCount && movesCount.length > 0
      ? movesCount[0].move_number + 1
      : 1;

    const moveInsert = {
      game_id: gameId,
      move_number: moveNumber,
      move: moveResult.san,
      fen: moveResult.fen,
      player_id: playerId,
      created_at: nowIso,
    };

    console.log('[Move API] Inserting move:', moveInsert);

    const { error: moveInsertError } = await supabase.from("moves").insert(moveInsert);

    if (moveInsertError) {
      console.error('[Move API] Failed to insert move:', moveInsertError);
      console.error('[Move API] Move insert error details:', {
        message: moveInsertError.message,
        details: moveInsertError.details,
        hint: moveInsertError.hint,
        code: moveInsertError.code,
      });
      return NextResponse.json({
        step: "move_insert",
        error: "Failed to save move",
        message: moveInsertError.message,
        code: moveInsertError.code,
        details: moveInsertError.details,
        hint: moveInsertError.hint,
        moveData: moveInsert
      }, { status: 500 });
    }

    console.log('[Move API] Move inserted successfully');

    const gameUpdate = {
      current_fen: moveResult.fen,
      turn: status === "active" ? nextTurn : game.turn,
      status,
      winner_id: winnerId,
      white_time_remaining_seconds: newWhiteTime,
      black_time_remaining_seconds: newBlackTime,
      last_move_at: nowIso,
      timeout_at: status === "active" ? timeoutAt : null,
      updated_at: nowIso,
    };

    console.log('[Move API] Updating game:', gameUpdate);

    const { error: updateError } = await supabase
      .from("games")
      .update(gameUpdate)
      .eq("id", gameId);

    if (updateError) {
      console.error('[Move API] Failed to update game:', updateError);
      console.error('[Move API] Game update error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      return NextResponse.json({
        step: "game_update",
        error: "Failed to update game",
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        gameUpdate
      }, { status: 500 });
    }

    console.log('[Move API] Game updated successfully');

    const response = {
      ok: true,
      fen: moveResult.fen,
      move: moveResult.san,
      status,
      winnerId,
    };

    console.log('[Move API] Success response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Move API] Unexpected error:', error);
    console.error('[Move API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Move API] Error details:', {
      type: typeof error,
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      error: JSON.stringify(error, null, 2),
    });
    return NextResponse.json(
      {
        step: "unexpected_error",
        error: error instanceof Error ? error.message : "Unknown server error",
        message: "An unexpected error occurred while processing the move",
        type: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : { value: String(error) }
      },
      { status: 500 }
    );
  }
}
