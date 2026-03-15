import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";

export async function POST(req: NextRequest) {
  try {
    console.log('[Move API] Processing move request');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    console.log('[Move API] Request body:', { gameId, playerId, from, to, promotion });

    if (!gameId || !playerId || !from || !to) {
      console.error('[Move API] Missing required fields');
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    console.log('[Move API] Game fetch result:', { game, gameError });

    if (gameError || !game) {
      console.error('[Move API] Game not found:', gameError);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "active") {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    if (!isWhite && !isBlack) {
      console.log('[Move API] 403: User not a player in this game', {
        playerId,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
      });
      return NextResponse.json({ error: "User is not a player in this game" }, { status: 403 });
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
        error: `Not your turn. Current turn: ${currentTurn}, you are: ${playerColor}`
      }, { status: 403 });
    }

    const clock = calculateClock({
      turn: currentTurn,
      white_time_remaining_seconds: game.white_time_remaining_seconds,
      black_time_remaining_seconds: game.black_time_remaining_seconds,
      last_move_at: game.last_move_at,
    });

    if (clock.timedOut) {
      const winnerId =
        clock.timedOutColor === "white" ? game.black_player_id : game.white_player_id;

      await supabase
        .from("games")
        .update({
          status: "finished",
          winner_id: winnerId,
          end_reason: "timeout",
          white_time_remaining_seconds: clock.whiteRemaining,
          black_time_remaining_seconds: clock.blackRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      return NextResponse.json({ error: "Game already ended on time" }, { status: 400 });
    }

    console.log('[Move API] Applying move to position:', game.current_fen);

    const moveResult = applyMove({
      fen: game.current_fen,
      move: { from, to, promotion },
    });

    console.log('[Move API] Move validation result:', moveResult);

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
      console.error('[Move API] Illegal move:', moveResult.error);
      return NextResponse.json({ error: moveResult.error || "Illegal move" }, { status: 400 });
    }

    const nextTurn = playerColor === "white" ? "black" : "white";
    const nowIso = new Date().toISOString();

    const newWhiteTime =
      playerColor === "white" ? clock.whiteRemaining : game.white_time_remaining_seconds;

    const newBlackTime =
      playerColor === "black" ? clock.blackRemaining : game.black_time_remaining_seconds;

    let status: 'active' | 'finished' = "active";
    let winnerId: string | null = null;
    let endReason: string | null = null;
    let timeoutAt: string | null = getNextTimeoutAt(nextTurn, newWhiteTime, newBlackTime, new Date());

    if (moveResult.isCheckmate) {
      status = "finished";
      winnerId = playerId;
      endReason = "checkmate";
      timeoutAt = null;
    } else if (
      moveResult.isDraw ||
      moveResult.isStalemate ||
      moveResult.isInsufficientMaterial ||
      moveResult.isThreefoldRepetition
    ) {
      status = "finished";
      winnerId = null;
      endReason = moveResult.isStalemate
        ? "stalemate"
        : moveResult.isInsufficientMaterial
        ? "draw"
        : moveResult.isThreefoldRepetition
        ? "draw"
        : "draw";
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
      return NextResponse.json({ error: "Failed to save move" }, { status: 500 });
    }

    console.log('[Move API] Move inserted successfully');

    const gameUpdate = {
      current_fen: moveResult.fen,
      turn: status === "active" ? nextTurn : game.turn,
      status,
      winner_id: winnerId,
      end_reason: endReason,
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
      return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
    }

    console.log('[Move API] Game updated successfully');

    const response = {
      ok: true,
      fen: moveResult.fen,
      move: moveResult.san,
      status,
      winnerId,
      endReason,
    };

    console.log('[Move API] Success response:', response);

    return NextResponse.json(response);
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
