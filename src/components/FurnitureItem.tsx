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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id);
    onDragStart(item);
  };

  return (
    <div
      className={`absolute cursor-move group ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
        transform: `rotate(${item.rotation}deg)`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`w-full h-full rounded-lg border-2 flex items-center justify-center text-xs font-medium transition ${
          item.type === 'table'
            ? 'bg-amber-100 border-amber-400 text-amber-800'
            : 'bg-sky-100 border-sky-400 text-sky-800'
        }`}
      >
        {item.type === 'table' ? 'Table' : 'Chair'}
      </div>
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
