'use client';

interface Move {
  id: string;
  move: string;
  move_number: number;
  player_id: string;
}

interface MoveListProps {
  moves: Move[];
  whitePlayerId: string;
}

export default function MoveList({ moves, whitePlayerId }: MoveListProps) {
  if (!moves || !Array.isArray(moves)) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Move History</h3>
        <p className="text-gray-500 text-sm">No moves yet</p>
      </div>
    );
  }

  const sortedMoves = [...moves].sort((a, b) => a.move_number - b.move_number);

  const groupedMoves: Array<{ white?: string; black?: string; number: number }> = [];

  sortedMoves.forEach((move) => {
    const isWhite = move.player_id === whitePlayerId;
    const moveIndex = Math.floor(move.move_number / 2);

    if (!groupedMoves[moveIndex]) {
      groupedMoves[moveIndex] = { number: moveIndex + 1 };
    }

    if (isWhite) {
      groupedMoves[moveIndex].white = move.move;
    } else {
      groupedMoves[moveIndex].black = move.move;
    }
  });

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Move History</h3>
      <div className="max-h-96 overflow-y-auto">
        {groupedMoves.length === 0 ? (
          <p className="text-gray-500 text-sm">No moves yet</p>
        ) : (
          <div className="space-y-1">
            {groupedMoves.map((movePair, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[auto_1fr_1fr] gap-4 text-sm py-1 px-2 hover:bg-accl-gray rounded"
              >
                <span className="text-gray-500 font-mono">{movePair.number}.</span>
                <span className="font-mono">{movePair.white || '...'}</span>
                <span className="font-mono text-gray-400">
                  {movePair.black || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
