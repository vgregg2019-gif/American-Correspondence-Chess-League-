'use client';

import { useState } from 'react';
import { Chessboard } from 'react-chessboard';

interface ChessBoardProps {
  position: string;
  onMoveMade: (from: string, to: string, promotion?: string) => Promise<boolean>;
  playerColor: 'white' | 'black' | null;
  currentTurn: 'white' | 'black';
  disabled?: boolean;
}

export default function ChessBoard({
  position,
  onMoveMade,
  playerColor,
  currentTurn,
  disabled = false,
}: ChessBoardProps) {
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, any>>({});
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});

  const canMove = !disabled && playerColor === currentTurn;

  function onSquareClick(square: string) {
    if (!canMove) return;

    if (!moveFrom) {
      setMoveFrom(square);
      return;
    }

    (async () => {
      const success = await onMoveMade(moveFrom, square);

      setMoveFrom(null);
      setOptionSquares({});
    })();
  }

  function onSquareRightClick(square: string) {
    const color = 'rgba(139, 0, 0, 0.4)';
    setRightClickedSquares((prev) => {
      const newSquares = { ...prev };
      if (newSquares[square]) {
        delete newSquares[square];
      } else {
        newSquares[square] = { backgroundColor: color };
      }
      return newSquares;
    });
  }

  function onPieceDragBegin(piece: string, sourceSquare: string) {
    if (!canMove) return false;
    setMoveFrom(sourceSquare);
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (!canMove) return false;

    (async () => {
      await onMoveMade(sourceSquare, targetSquare);
      setMoveFrom(null);
      setOptionSquares({});
    })();

    return true;
  }

  return (
    <div className="w-full max-w-2xl">
      <Chessboard
        position={position}
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDrop={onPieceDrop}
        customSquareStyles={{
          ...optionSquares,
          ...rightClickedSquares,
        }}
        boardOrientation={playerColor || 'white'}
        arePiecesDraggable={canMove}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#2a2a2a' }}
        customLightSquareStyle={{ backgroundColor: '#4a4a4a' }}
      />
    </div>
  );
}
