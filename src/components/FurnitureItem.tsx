import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { FurnitureItem as FurnitureItemType } from '../types/furniture';

interface FurnitureItemProps {
  item: FurnitureItemType;
  scale: number;
  onDragStart: (item: FurnitureItemType) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function FurnitureItem({
  item,
  scale,
  onDragStart,
  onDelete,
  isSelected,
  onSelect,
}: FurnitureItemProps) {
  const pixelWidth = item.width * scale;
  const pixelHeight = item.height * scale;
  const pixelX = item.x * scale;
  const pixelY = item.y * scale;

  const isCircular = (item.type === 'table' && item.width === item.height) || item.type === 'chair';

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id);
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;

    const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);

    if (!isDragging.current && (deltaX > 3 || deltaY > 3)) {
      isDragging.current = true;
      onDragStart(item);
    }
  };

  const handleMouseUp = () => {
    mouseDownPos.current = null;
    isDragging.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

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
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {isSelected && !item.group_id && (
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
        {item.type === 'table' ? 'Table' : 'Chair'}
      </div>
      {isSelected && !item.group_id && (
        <button
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
