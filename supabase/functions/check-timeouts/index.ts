import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: timedOutGames, error: fetchError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "active")
      .lte("timeout_at", now);

    if (fetchError) {
      throw new Error(`Failed to fetch timed out games: ${fetchError.message}`);
    }

    const results = [];

    for (const game of timedOutGames || []) {
      const winnerId =
        game.turn === "white" ? game.black_player_id : game.white_player_id;

      const { error: updateError } = await supabase
        .from("games")
        .update({
          status: "finished",
          winner_id: winnerId,
          end_reason: "timeout",
          white_time_remaining_seconds:
            game.turn === "white" ? 0 : game.white_time_remaining_seconds,
          black_time_remaining_seconds:
            game.turn === "black" ? 0 : game.black_time_remaining_seconds,
          updated_at: now,
        })
        .eq("id", game.id)
        .eq("status", "active");

      if (updateError) {
        results.push({
          gameId: game.id,
          success: false,
          error: updateError.message,
        });
      } else {
        results.push({
          gameId: game.id,
          success: true,
          winnerId,
        });
      }
    }

    return new Response(
      JSON.stringify({
        checked: timedOutGames?.length || 0,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
