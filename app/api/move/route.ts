import { NextRequest, NextResponse } from "next/server";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";
import { createServerClient } from "@/lib/supabaseServer";

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

    console.log('[Move API] ===== AUTH CHECK (using cookies) =====');

    // Log all cookies received
    const cookieHeader = req.headers.get('cookie');
    console.log('[Move API] Cookie header present:', !!cookieHeader);
    console.log('[Move API] Cookie header length:', cookieHeader?.length || 0);
    if (cookieHeader) {
      const cookieNames = cookieHeader.split(';').map(c => c.trim().split('=')[0]);
      console.log('[Move API] Cookie names:', cookieNames);
    }

    const supabase = await createServerClient();

    console.log('[Move API] Getting authenticated user from cookies...');
    const authResult = await supabase.auth.getUser();
    const { data: { user }, error: authError } = authResult;

    console.log('[Move API] auth.getUser() result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      hasError: !!authError,
      errorMessage: authError?.message,
      errorStatus: authError?.status,
      errorName: authError?.name,
      fullAuthResult: JSON.stringify({ user: user ? { id: user.id, email: user.email } : null, error: authError }, null, 2)
    });

    if (authError || !user) {
      console.error('[Move API] ❌ Auth verification failed');
      console.error('[Move API] authError:', JSON.stringify(authError, null, 2));
      console.error('[Move API] user:', user);
      console.error('[Move API] This means cookies are not being sent or session is invalid');

      // DEBUG: Get all cookies to see what's being sent
      const allCookies = req.cookies.getAll();
      const cookieDebug = allCookies.map(c => ({
        name: c.name,
        valueLength: c.value?.length,
        hasAuthPrefix: c.name.startsWith('sb-'),
      }));

      // Fetch game data without auth to get player IDs for debugging
      const supabaseAdmin = await createServerClient();
      const { data: gameDebug } = await supabaseAdmin
        .from("games")
        .select("white_player_id, black_player_id")
        .eq("id", gameId)
        .maybeSingle();

      return NextResponse.json({
        step: "auth",
        error: "Invalid authorization",
        message: authError?.message || "Could not verify user from cookies. Session may be expired or cookies not sent.",
        debug: {
          hasError: !!authError,
          hasUser: !!user,
          errorMessage: authError?.message,
          errorStatus: authError?.status,
          // COOKIE DEBUG
          cookies_received: cookieDebug,
          cookie_count: allCookies.length,
          // DEBUG VALUES
          authenticated_user_id: user?.id || null,
          request_body_playerId: playerId,
          game_white_player_id: gameDebug?.white_player_id || null,
          game_black_player_id: gameDebug?.black_player_id || null,
          comparisons: {
            user_id_equals_playerId: user?.id === playerId,
            user_id_equals_white: user?.id === gameDebug?.white_player_id,
            user_id_equals_black: user?.id === gameDebug?.black_player_id,
            playerId_equals_white: playerId === gameDebug?.white_player_id,
            playerId_equals_black: playerId === gameDebug?.black_player_id,
          }
        }
      }, { status: 401 });
    }

    console.log('[Move API] ✓ Authenticated user ID:', user.id);
    console.log('[Move API] ✓ User email:', user.email);

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
    console.log('[Move API] Auth method: Cookie-based session');
    console.log('[Move API] Auth context in client:', user.id);
    console.log('[Move API] RLS will be enforced: YES (using cookie session)');

    const selectQuery = `
        id,
        white_player_id,
        black_player_id,
        current_fen,
        status,
        result,
        time_control,
        timeout_at,
        white_time_remaining_seconds,
        black_time_remaining_seconds,
        last_move_at,
        created_at
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
        current_fen: game.current_fen,
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

    console.log('[Move API] ===== TIMER STATE BEFORE MOVE =====');
    console.log('[Move API] Time values from database:', {
      time_control: game.time_control,
      timeout_at: game.timeout_at,
      white_time_remaining_seconds: game.white_time_remaining_seconds,
      black_time_remaining_seconds: game.black_time_remaining_seconds,
      last_move_at: game.last_move_at,
    });

    if (game.status !== "active") {
      return NextResponse.json({
        step: "game_status",
        error: "Game is not active",
        message: `Game status is: ${game.status}`,
        details: { currentStatus: game.status, requiredStatus: "active" }
      }, { status: 400 });
    }

    console.log('[Move API] ===== AUTHORIZATION VALUES =====');
    console.log('authenticated user.id        :', user.id);
    console.log('request body playerId        :', playerId);
    console.log('game.white_player_id         :', game.white_player_id);
    console.log('game.black_player_id         :', game.black_player_id);
    console.log('');
    console.log('user.id === playerId         :', user.id === playerId, user.id === playerId ? '✓' : '✗ MISMATCH');
    console.log('playerId === white_player_id :', playerId === game.white_player_id, playerId === game.white_player_id ? '✓' : '✗ MISMATCH');
    console.log('playerId === black_player_id :', playerId === game.black_player_id, playerId === game.black_player_id ? '✓' : '✗ MISMATCH');

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    console.log('[Move API] isWhite:', isWhite);
    console.log('[Move API] isBlack:', isBlack);

    if (!isWhite && !isBlack) {
      console.log('[Move API] ❌ 403: User not a player in this game');
      console.log('[Move API] Comparison details:', {
        authenticatedUserId: user.id,
        requestPlayerId: playerId,
        gameWhitePlayerId: game.white_player_id,
        gameBlackPlayerId: game.black_player_id,
        userIdMatchesWhite: user.id === game.white_player_id,
        userIdMatchesBlack: user.id === game.black_player_id,
        playerIdMatchesWhite: playerId === game.white_player_id,
        playerIdMatchesBlack: playerId === game.black_player_id,
      });
      return NextResponse.json({
        step: "auth",
        error: "User is not a player in this game",
        message: "You are not authorized to make moves in this game",
        details: {
          authenticatedUserId: user.id,
          requestPlayerId: playerId,
          whitePlayerId: game.white_player_id,
          blackPlayerId: game.black_player_id
        }
      }, { status: 403 });
    }

    console.log('[Move API] ✓ User is authorized to play this game');

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

    if (game.timeout_at && new Date(game.timeout_at) < new Date()) {
      console.log('[Move API] Game timed out');
      const timedOutColor = currentTurn;
      const resultString = timedOutColor === 'white' ? '0-1' : '1-0';

      await supabase
        .from("games")
        .update({
          status: "finished",
          result: resultString,
        })
        .eq("id", gameId);

      return NextResponse.json({
        step: "timeout_check",
        error: "Game already ended on time",
        message: `${timedOutColor} ran out of time`,
        details: {
          timedOutColor,
          timeout_at: game.timeout_at
        }
      }, { status: 400 });
    }

    console.log('[Move API] ===== STEP 1: CHESS MOVE GENERATION =====');
    console.log('[Move API] Current position (FEN):', game.current_fen);
    console.log('[Move API] Move to apply:', { from, to, promotion });

    const moveResult = applyMove({
      fen: game.current_fen,
      move: { from, to, promotion },
    });

    console.log('[Move API] Chess engine result:', {
      ok: moveResult.ok,
      fen: moveResult.fen,
      san: moveResult.san,
      isCheckmate: moveResult.isCheckmate,
      isDraw: moveResult.isDraw,
      isStalemate: moveResult.isStalemate,
      error: moveResult.error,
    });

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
      console.error('[Move API] ❌ Chess move validation failed');
      return NextResponse.json({
        step: "move_validation",
        error: "Illegal move",
        message: moveResult.error || "The move is not legal in the current position",
        details: { from, to, promotion, fen: game.current_fen }
      }, { status: 400 });
    }

    console.log('[Move API] ✓ Chess move validated successfully');

    const nextTurn: 'white' | 'black' = playerColor === "white" ? "black" : "white";

    console.log('[Move API] ===== TIMER CALCULATION =====');
    const clockBefore = calculateClock({
      turn: currentTurn,
      white_time_remaining_seconds: game.white_time_remaining_seconds,
      black_time_remaining_seconds: game.black_time_remaining_seconds,
      last_move_at: game.last_move_at,
    }, new Date());

    console.log('[Move API] Clock state before move:', {
      moving_player: playerColor,
      white_remaining_before: clockBefore.whiteRemaining,
      black_remaining_before: clockBefore.blackRemaining,
      active_color: clockBefore.activeColor,
    });

    const updatedWhiteTime = clockBefore.whiteRemaining;
    const updatedBlackTime = clockBefore.blackRemaining;

    console.log('[Move API] Timer handoff:', {
      moving_player: playerColor,
      stopped_timer: `${playerColor}_time`,
      white_time_after_move: updatedWhiteTime,
      black_time_after_move: updatedBlackTime,
      next_turn: nextTurn,
      next_active_timer: `${nextTurn}_time`,
    });

    let status: 'active' | 'finished' = "active";
    let resultString: string | null = null;
    let timeoutAt: string | null = getNextTimeoutAt(
      nextTurn,
      updatedWhiteTime,
      updatedBlackTime,
      new Date()
    );

    console.log('[Move API] Next timeout calculated:', {
      next_turn: nextTurn,
      timeout_at: timeoutAt,
    });

    if (moveResult.isCheckmate) {
      status = "finished";
      resultString = playerColor === 'white' ? '1-0' : '0-1';
      timeoutAt = null;
    } else if (
      moveResult.isDraw ||
      moveResult.isStalemate ||
      moveResult.isInsufficientMaterial ||
      moveResult.isThreefoldRepetition
    ) {
      status = "finished";
      resultString = '1/2-1/2';
      timeoutAt = null;
    }

    console.log('[Move API] ===== STEP 2: INSERT INTO public.moves =====');

    const { data: movesCount, error: movesCountError } = await supabase
      .from("moves")
      .select("move_number", { count: 'exact' })
      .eq("game_id", gameId)
      .order("move_number", { ascending: false })
      .limit(1);

    console.log('[Move API] Move count query result:', {
      hasData: !!movesCount,
      count: movesCount?.length,
      lastMoveNumber: movesCount?.[0]?.move_number,
      hasError: !!movesCountError,
      error: movesCountError,
    });

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

    console.log('[Move API] Data to insert:', JSON.stringify(moveInsert, null, 2));
    console.log('[Move API] Executing: INSERT INTO moves', moveInsert);

    const moveInsertResult = await supabase.from("moves").insert(moveInsert).select();

    console.log('[Move API] ===== INSERT RESPONSE =====');
    console.log('[Move API] Status:', moveInsertResult.status);
    console.log('[Move API] StatusText:', moveInsertResult.statusText);
    console.log('[Move API] Has data:', !!moveInsertResult.data);
    console.log('[Move API] Data:', moveInsertResult.data);
    console.log('[Move API] Has error:', !!moveInsertResult.error);

    if (moveInsertResult.error) {
      console.log('[Move API] Error.message:', moveInsertResult.error.message);
      console.log('[Move API] Error.code:', moveInsertResult.error.code);
      console.log('[Move API] Error.details:', moveInsertResult.error.details);
      console.log('[Move API] Error.hint:', moveInsertResult.error.hint);
      console.log('[Move API] Full error object:', JSON.stringify(moveInsertResult.error, null, 2));
    }

    if (moveInsertResult.error) {
      console.error('[Move API] ❌ FAILED AT: INSERT INTO public.moves');
      console.error('[Move API] Full error object:', JSON.stringify(moveInsertResult.error, null, 2));
      console.error('[Move API] Move data we tried to insert:', JSON.stringify(moveInsert, null, 2));

      return NextResponse.json({
        step: "move_insert",
        failedAt: "INSERT INTO public.moves",
        error: "Failed to insert move",
        message: moveInsertResult.error.message,
        code: moveInsertResult.error.code,
        details: moveInsertResult.error.details,
        hint: moveInsertResult.error.hint,
        moveData: moveInsert,
        fullError: JSON.parse(JSON.stringify(moveInsertResult.error))
      }, { status: 500 });
    }

    console.log('[Move API] ✓ Move inserted successfully');

    console.log('[Move API] ===== STEP 3: UPDATE public.games =====');

    const gameUpdate: any = {
      current_fen: moveResult.fen,
      status,
      white_time_remaining_seconds: updatedWhiteTime,
      black_time_remaining_seconds: updatedBlackTime,
      last_move_at: nowIso,
    };

    if (resultString) {
      gameUpdate.result = resultString;
    }

    if (timeoutAt !== null) {
      gameUpdate.timeout_at = timeoutAt;
    }

    console.log('[Move API] ===== PERSISTING TIMER STATE =====');
    console.log('[Move API] Game update payload:', JSON.stringify(gameUpdate, null, 2));
    console.log('[Move API] Timer state to persist:', {
      white_time_remaining_seconds: updatedWhiteTime,
      black_time_remaining_seconds: updatedBlackTime,
      last_move_at: nowIso,
      timeout_at: timeoutAt,
    });
    console.log('[Move API] Executing UPDATE games...');

    try {
      const gameUpdateResult = await supabase
        .from("games")
        .update(gameUpdate)
        .eq("id", gameId);

      if (gameUpdateResult.error) {
        console.error('[Move API] ⚠️ Game update failed but move was persisted:', gameUpdateResult.error.message);
        console.error('[Move API] Realtime subscription will handle UI update');
      } else {
        console.log('[Move API] ✓ Game updated successfully');
      }
    } catch (updateError) {
      console.error('[Move API] ⚠️ Game update threw exception but move was persisted:', updateError);
      console.error('[Move API] Realtime subscription will handle UI update');
    }

    const insertedMove = moveInsertResult.data?.[0];

    const response = {
      ok: true,
      fen: moveResult.fen,
      move: moveResult.san,
      san: moveResult.san,
      status,
      result: resultString,
      moveId: insertedMove?.id,
      moveNumber: moveNumber,
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
