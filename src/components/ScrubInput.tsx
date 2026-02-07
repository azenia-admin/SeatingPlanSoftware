import { useRef, useState, useCallback, useEffect } from 'react';

interface ScrubInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  suffix?: string;
  className?: string;
}

export default function ScrubInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision,
  label,
  suffix,
  className = '',
}: ScrubInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubState = useRef({
    startX: 0,
    startValue: 0,
    pointerId: -1,
  });

  const displayPrecision = precision ?? (step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0);

  const clamp = useCallback((v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    return parseFloat(clamped.toFixed(displayPrecision));
  }, [min, max, displayPrecision]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (isEditing) return;
    if (e.button !== 0) return;

    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    scrubState.current = {
      startX: e.clientX,
      startValue: value,
      pointerId: e.pointerId,
    };
    setIsScrubbing(true);
  }, [isEditing, value]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isScrubbing) return;

    const dx = e.clientX - scrubState.current.startX;
    let sensitivity = step;
    if (e.shiftKey) sensitivity = step * 0.1;
    if (e.altKey) sensitivity = step * 10;

    const delta = dx * sensitivity;
    const snapped = Math.round((scrubState.current.startValue + delta) / step) * step;
    onChange(clamp(snapped));
  }, [isScrubbing, step, clamp, onChange]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isScrubbing) return;

    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    setIsScrubbing(false);

    const dx = Math.abs(e.clientX - scrubState.current.startX);
    if (dx < 3) {
      setIsEditing(true);
      setEditValue(value.toFixed(displayPrecision));
    }
  }, [isScrubbing, value, displayPrecision]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
    setIsEditing(false);
  }, [editValue, clamp, onChange]);

  const onEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [commitEdit]);

  useEffect(() => {
    if (!isScrubbing) return;

    const style = document.createElement('style');
    style.textContent = '* { cursor: ew-resize !important; user-select: none !important; }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [isScrubbing]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {label && (
        <span
          className="text-sm text-gray-700 select-none"
          style={{ cursor: isEditing ? 'default' : 'ew-resize' }}
        >
          {label}
        </span>
      )}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative"
        style={{ cursor: isEditing ? 'text' : 'ew-resize', touchAction: 'none' }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onEditKeyDown}
            className="w-16 px-2 py-1 text-sm text-right border border-blue-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div
            className={`w-16 px-2 py-1 text-sm text-right border rounded select-none tabular-nums transition-colors ${
              isScrubbing
                ? 'border-blue-400 bg-blue-50 text-blue-800'
                : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {value.toFixed(displayPrecision)}
          </div>
        )}
      </div>
      {suffix && (
        <span className="text-xs text-gray-500 select-none">{suffix}</span>
      )}
    </div>
  );
}
