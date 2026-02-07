import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { FurnitureItem as FurnitureItemType } from '../types/furniture';

interface FurnitureItemProps {
  item: FurnitureItemType;
  scale: number;
  onDragStart: (item: FurnitureItemType, cursorX: number, cursorY: number) => void;
  onDragEnd: () => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  showIndividualSelection: boolean;
  isIndividuallySelected: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  isRotatingGroup?: boolean;
  seatLabel?: string;
}

export default function FurnitureItem({
  item,
  scale,
  onDragStart,
  onDragEnd,
  onDelete,
  isSelected,
  showIndividualSelection,
  isIndividuallySelected,
  isMultiSelected,
  onSelect,
  onDoubleClick,
  isRotatingGroup = false,
  seatLabel,
}: FurnitureItemProps) {
  const pixelWidth = item.width * scale;
  const pixelHeight = item.height * scale;
  const pixelX = item.x * scale;
  const pixelY = item.y * scale;

  const isCircular = (item.type === 'table' && item.width === item.height) || item.type === 'chair';

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const lastClickTime = useRef<number>(0);
  const DOUBLE_CLICK_DELAY = 300;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isRotatingGroup) return;

    e.preventDefault();
    e.stopPropagation();

    if (isMultiSelected) {
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTime.current;

    if (timeSinceLastClick < DOUBLE_CLICK_DELAY && onDoubleClick) {
      onDoubleClick(item.id);
      lastClickTime.current = 0;
    } else if (!isIndividuallySelected) {
      onSelect(item.id);
      lastClickTime.current = currentTime;
    } else {
      lastClickTime.current = currentTime;
    }

    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    if (isRotatingGroup) return;

    const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);

    if (!isDragging.current && (deltaX > 3 || deltaY > 3) && (isSelected || isMultiSelected)) {
      isDragging.current = true;
      onDragStart(item, e.clientX, e.clientY);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging.current) {
      onDragEnd();
    }
    mouseDownPos.current = null;
    isDragging.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (item.type === 'row') {
    return null;
  }

  return (
    <div
      data-furniture-item="true"
      className="absolute cursor-move group"
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
        transform: `rotate(${item.rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {isSelected && showIndividualSelection && (
        <>
          <div
            className="absolute inset-0 border-2 border-blue-500 pointer-events-none"
            style={{
              borderRadius: isCircular ? '50%' : '0.5rem',
              marginTop: '-2px',
              marginLeft: '-2px',
              width: 'calc(100% + 4px)',
              height: 'calc(100% + 4px)',
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-blue-500 rounded-full pointer-events-none"
            style={{
              width: '8px',
              height: '8px',
              top: '-16px',
            }}
          />
        </>
      )}
      <div
        className={`w-full h-full border-2 flex items-center justify-center text-xs font-medium transition ${
          isCircular ? 'rounded-full' : 'rounded-lg'
        } ${
          item.type === 'table'
            ? 'bg-amber-100 border-amber-400 text-amber-800'
            : 'bg-sky-100 border-sky-400 text-sky-800'
        }`}
      >
        {item.type === 'table' ? 'Table' : (seatLabel || '')}
      </div>
      {isSelected && showIndividualSelection && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-lg z-10"
          title="Delete (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
