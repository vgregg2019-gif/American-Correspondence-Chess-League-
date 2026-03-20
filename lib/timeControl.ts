export type GameClockState = {
  turn: "white" | "black";
  white_time_remaining_seconds: number;
  black_time_remaining_seconds: number;
  last_move_at: string;
};

export type CalculatedClock = {
  whiteRemaining: number;
  blackRemaining: number;
  activeColor: "white" | "black";
  timedOut: boolean;
  timedOutColor?: "white" | "black";
};

export function calculateClock(state: GameClockState, now = new Date()): CalculatedClock {
  console.log('[calculateClock] ===== TIMER CALCULATION =====');
  console.log('[calculateClock] Input state:', {
    turn: state?.turn,
    white_time: state?.white_time_remaining_seconds,
    black_time: state?.black_time_remaining_seconds,
    last_move_at: state?.last_move_at,
    now: now.toISOString(),
  });

  if (!state ||
      typeof state.white_time_remaining_seconds !== 'number' ||
      typeof state.black_time_remaining_seconds !== 'number') {
    console.log('[calculateClock] Invalid state, returning zeros');
    return {
      whiteRemaining: 0,
      blackRemaining: 0,
      activeColor: state?.turn || "white",
      timedOut: false,
      timedOutColor: undefined,
    };
  }

  if (!state.last_move_at) {
    console.log('[calculateClock] No last_move_at (game start), returning initial times');
    return {
      whiteRemaining: state.white_time_remaining_seconds,
      blackRemaining: state.black_time_remaining_seconds,
      activeColor: state.turn,
      timedOut: false,
      timedOutColor: undefined,
    };
  }

  const lastMoveMs = new Date(state.last_move_at).getTime();
  const nowMs = now.getTime();

  if (isNaN(lastMoveMs) || isNaN(nowMs)) {
    console.log('[calculateClock] Invalid timestamps, returning stored values');
    return {
      whiteRemaining: state.white_time_remaining_seconds || 0,
      blackRemaining: state.black_time_remaining_seconds || 0,
      activeColor: state.turn,
      timedOut: false,
      timedOutColor: undefined,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - lastMoveMs) / 1000));

  console.log('[calculateClock] Time calculation:', {
    last_move_at: state.last_move_at,
    last_move_ms: lastMoveMs,
    now_ms: nowMs,
    elapsed_seconds: elapsedSeconds,
    active_player: state.turn,
  });

  let whiteRemaining = state.white_time_remaining_seconds || 0;
  let blackRemaining = state.black_time_remaining_seconds || 0;

  if (state.turn === "white") {
    console.log('[calculateClock] White is active - deducting elapsed time from white');
    whiteRemaining = Math.max(0, whiteRemaining - elapsedSeconds);
  } else {
    console.log('[calculateClock] Black is active - deducting elapsed time from black');
    blackRemaining = Math.max(0, blackRemaining - elapsedSeconds);
  }

  console.log('[calculateClock] Final calculated times:', {
    white_remaining: whiteRemaining,
    black_remaining: blackRemaining,
    white_lost: state.turn === "white" ? elapsedSeconds : 0,
    black_lost: state.turn === "black" ? elapsedSeconds : 0,
  });

  const timedOut =
    (state.turn === "white" && whiteRemaining <= 0) ||
    (state.turn === "black" && blackRemaining <= 0);

  return {
    whiteRemaining,
    blackRemaining,
    activeColor: state.turn,
    timedOut,
    timedOutColor: timedOut ? state.turn : undefined,
  };
}

export function getNextTimeoutAt(
  turn: "white" | "black",
  whiteRemaining: number,
  blackRemaining: number,
  from = new Date()
): string {
  console.log('[timeControl] getNextTimeoutAt called with:', {
    turn,
    whiteRemaining,
    blackRemaining,
    from: from.toISOString(),
    typeOf_white: typeof whiteRemaining,
    typeOf_black: typeof blackRemaining,
  });

  const seconds = turn === "white" ? whiteRemaining : blackRemaining;

  console.log('[timeControl] Active player seconds:', seconds);

  if (!seconds || isNaN(seconds) || seconds <= 0) {
    console.log('[timeControl] Invalid seconds, using 24hr fallback');
    return new Date(from.getTime() + 86400 * 1000).toISOString();
  }

  const targetTime = from.getTime() + seconds * 1000;

  console.log('[timeControl] Target time calculated:', {
    targetTime,
    targetTimeDate: new Date(targetTime).toISOString(),
  });

  if (isNaN(targetTime)) {
    console.log('[timeControl] Invalid target time, using 24hr fallback');
    return new Date(from.getTime() + 86400 * 1000).toISOString();
  }

  return new Date(targetTime).toISOString();
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
