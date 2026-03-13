'use client';

import { useEffect, useState } from 'react';
import { formatTime } from '@/lib/timeControl';

interface GameTimerProps {
  initialSeconds: number;
  isActive: boolean;
  playerName: string;
  color: 'white' | 'black';
  timedOut?: boolean;
}

export default function GameTimer({
  initialSeconds,
  isActive,
  playerName,
  color,
  timedOut = false,
}: GameTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive || timedOut) return;

    const interval = setInterval(() => {
      setSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timedOut]);

  const isLowTime = seconds < 3600;
  const isCriticalTime = seconds < 600;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
        isActive
          ? 'border-accl-red bg-accl-charcoal'
          : 'border-accl-gray bg-accl-black'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            color === 'white' ? 'bg-gray-200' : 'bg-gray-700'
          }`}
        />
        <span className="font-semibold">{playerName}</span>
      </div>
      <div
        className={`font-mono text-xl font-bold ${
          timedOut
            ? 'text-red-500'
            : isCriticalTime
            ? 'text-red-400'
            : isLowTime
            ? 'text-yellow-400'
            : 'text-gray-200'
        }`}
      >
        {timedOut ? 'Time Out' : formatTime(seconds)}
      </div>
    </div>
  );
}
