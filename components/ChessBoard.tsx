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

  const disabledReason = disabled
    ? 'Board disabled (game not active or move in progress)'
    : playerColor !== currentTurn
    ? `Not your turn (you: ${playerColor}, current: ${currentTurn})`
    : null;

  console.log('[ChessBoard] Move permissions:', {
    position,
    playerColor,
    currentTurn,
    disabled,
    canMove,
    disabledReason: disabledReason || 'Can move - pieces draggable',
  });

  function onSquareClick(square: string) {
    if (!canMove) {
      console.log('[ChessBoard] Click blocked on square:', square, 'canMove:', canMove);
      return;
    }

    console.log('[ChessBoard] Square clicked:', square, 'moveFrom:', moveFrom);

    if (!moveFrom) {
      setMoveFrom(square);
      return;
    }

    (async () => {
      console.log('[ChessBoard] Attempting move from', moveFrom, 'to', square);
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
    if (!canMove) {
      console.log('[ChessBoard] Drag blocked, piece:', piece, 'square:', sourceSquare, 'canMove:', canMove);
      return false;
    }
    console.log('[ChessBoard] Drag started, piece:', piece, 'square:', sourceSquare);
    setMoveFrom(sourceSquare);
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (!canMove) {
      console.log('[ChessBoard] Drop blocked from', sourceSquare, 'to', targetSquare, 'canMove:', canMove);
      return false;
    }

    console.log('[ChessBoard] Piece dropped from', sourceSquare, 'to', targetSquare);

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
