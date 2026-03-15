import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyMove } from "@/lib/chessEngine";
import { calculateClock, getNextTimeoutAt } from "@/lib/timeControl";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await req.json();
    const { gameId, playerId, from, to, promotion } = body;

    if (!gameId || !playerId || !from || !to) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "active") {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const isWhite = game.white_player_id === playerId;
    const isBlack = game.black_player_id === playerId;

    if (!isWhite && !isBlack) {
      return NextResponse.json({ error: "Not your game" }, { status: 403 });
    }

    const playerColor = isWhite ? "white" : "black";

    if (game.turn !== playerColor) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 });
    }

    const clock = calculateClock({
      turn: game.turn,
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

    const moveResult = applyMove({
      fen: game.current_fen,
      move: { from, to, promotion },
    });

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
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

    const { error: moveInsertError } = await supabase.from("moves").insert({
      game_id: gameId,
      move_number: moveNumber,
      move: moveResult.san,
      fen: moveResult.fen,
      player_id: playerId,
      created_at: nowIso,
    });

    if (moveInsertError) {
      return NextResponse.json({ error: "Failed to save move" }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({
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
      })
      .eq("id", gameId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      fen: moveResult.fen,
      move: moveResult.san,
      status,
      winnerId,
      endReason,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
