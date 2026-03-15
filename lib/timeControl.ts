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
  if (!state || !state.last_move_at ||
      typeof state.white_time_remaining_seconds !== 'number' ||
      typeof state.black_time_remaining_seconds !== 'number') {
    return {
      whiteRemaining: 0,
      blackRemaining: 0,
      activeColor: state?.turn || "white",
      timedOut: false,
      timedOutColor: undefined,
    };
  }

  const lastMoveMs = new Date(state.last_move_at).getTime();
  const nowMs = now.getTime();

  if (isNaN(lastMoveMs) || isNaN(nowMs)) {
    return {
      whiteRemaining: state.white_time_remaining_seconds || 0,
      blackRemaining: state.black_time_remaining_seconds || 0,
      activeColor: state.turn,
      timedOut: false,
      timedOutColor: undefined,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - lastMoveMs) / 1000));

  let whiteRemaining = state.white_time_remaining_seconds || 0;
  let blackRemaining = state.black_time_remaining_seconds || 0;

  if (state.turn === "white") {
    whiteRemaining = Math.max(0, whiteRemaining - elapsedSeconds);
  } else {
    blackRemaining = Math.max(0, blackRemaining - elapsedSeconds);
  }

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
  const seconds = turn === "white" ? whiteRemaining : blackRemaining;
  return new Date(from.getTime() + seconds * 1000).toISOString();
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
