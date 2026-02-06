import { useRef, useCallback, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

interface ViewportNavigatorProps {
  onPan: (dx: number, dy: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
  minScale: number;
  maxScale: number;
}

const PAN_STEP = 60;
const PAN_INTERVAL = 50;

export default function ViewportNavigator({
  onPan,
  onZoomIn,
  onZoomOut,
  scale,
  minScale,
  maxScale,
}: ViewportNavigatorProps) {
  const panIntervalRef = useRef<number | null>(null);
  const jogOriginRef = useRef<{ x: number; y: number } | null>(null);
  const jogAnimRef = useRef<number | null>(null);

  const stopContinuousPan = useCallback(() => {
    if (panIntervalRef.current !== null) {
      clearInterval(panIntervalRef.current);
      panIntervalRef.current = null;
    }
  }, []);

  const startContinuousPan = useCallback(
    (dx: number, dy: number) => {
      onPan(dx, dy);
      panIntervalRef.current = window.setInterval(() => {
        onPan(dx, dy);
      }, PAN_INTERVAL);
    },
    [onPan]
  );

  useEffect(() => {
    const handleUp = () => {
      stopContinuousPan();
      if (jogOriginRef.current) {
        jogOriginRef.current = null;
      }
      if (jogAnimRef.current !== null) {
        cancelAnimationFrame(jogAnimRef.current);
        jogAnimRef.current = null;
      }
    };
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      stopContinuousPan();
      if (jogAnimRef.current !== null) {
        cancelAnimationFrame(jogAnimRef.current);
      }
    };
  }, [stopContinuousPan]);

  const handleJogStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    jogOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    const runJog = () => {
      jogAnimRef.current = requestAnimationFrame(runJog);
    };
    jogAnimRef.current = requestAnimationFrame(runJog);
  };

  const handleJogMove = useCallback(
    (e: React.MouseEvent) => {
      if (!jogOriginRef.current) return;
      const dx = e.clientX - jogOriginRef.current.x;
      const dy = e.clientY - jogOriginRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        const factor = dist * 0.15;
        onPan((dx / dist) * factor, (dy / dist) * factor);
      }
    },
    [onPan]
  );

  const zoomPercent = Math.round(((scale - minScale) / (maxScale - minScale)) * 100);

  return (
    <div
      className="absolute bottom-4 right-4 z-40 select-none"
      onMouseMove={handleJogMove}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-[120px] h-[120px]">
          <div className="absolute inset-0 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200" />

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startContinuousPan(0, PAN_STEP);
            }}
            onMouseUp={stopContinuousPan}
            className="absolute top-0.5 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors"
          >
            <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startContinuousPan(0, -PAN_STEP);
            }}
            onMouseUp={stopContinuousPan}
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors"
          >
            <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startContinuousPan(PAN_STEP, 0);
            }}
            onMouseUp={stopContinuousPan}
            className="absolute left-0.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startContinuousPan(-PAN_STEP, 0);
            }}
            onMouseUp={stopContinuousPan}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <div
            onMouseDown={handleJogStart}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 shadow-inner cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 px-1 py-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoomOut();
            }}
            disabled={scale <= minScale}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <div className="w-10 text-center text-[10px] font-medium text-gray-500 tabular-nums">
            {zoomPercent}%
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoomIn();
            }}
            disabled={scale >= maxScale}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
