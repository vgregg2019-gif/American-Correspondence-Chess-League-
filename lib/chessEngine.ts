import { Chess } from "chess.js";

export type PlayerColor = "white" | "black";

export type ApplyMoveInput = {
  fen: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
};

export type ApplyMoveResult = {
  ok: boolean;
  error?: string;
  fen?: string;
  san?: string;
  isCheckmate?: boolean;
  isDraw?: boolean;
  isStalemate?: boolean;
  isInsufficientMaterial?: boolean;
  isThreefoldRepetition?: boolean;
};

export function applyMove(input: ApplyMoveInput): ApplyMoveResult {
  try {
    const chess = new Chess(input.fen);

    const result = chess.move({
      from: input.move.from,
      to: input.move.to,
      promotion: input.move.promotion || "q",
    });

    if (!result) {
      return { ok: false, error: "Illegal move" };
    }

    return {
      ok: true,
      fen: chess.fen(),
      san: result.san,
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      isStalemate: chess.isStalemate(),
      isInsufficientMaterial: chess.isInsufficientMaterial(),
      isThreefoldRepetition: chess.isThreefoldRepetition(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown chess error",
    };
  }
}

export function getTurnFromFen(fen: string): PlayerColor {
  const chess = new Chess(fen);
  return chess.turn() === "w" ? "white" : "black";
}

export function getLegalMoves(fen: string, square?: string) {
  const chess = new Chess(fen);
  if (square) {
    return chess.moves({ square: square as any, verbose: true });
  }
  return chess.moves({ verbose: true });
}
