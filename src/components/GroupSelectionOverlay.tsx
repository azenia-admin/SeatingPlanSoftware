import { Trash2 } from 'lucide-react';
import type { FurnitureItem } from '../types/furniture';

interface GroupSelectionOverlayProps {
  items: FurnitureItem[];
  scale: number;
  onDelete: (id: string) => void;
}

export default function GroupSelectionOverlay({ items, scale, onDelete }: GroupSelectionOverlayProps) {
  if (items.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach((item) => {
    const itemMinX = item.x;
    const itemMinY = item.y;
    const itemMaxX = item.x + item.width;
    const itemMaxY = item.y + item.height;

    minX = Math.min(minX, itemMinX);
    minY = Math.min(minY, itemMinY);
    maxX = Math.max(maxX, itemMaxX);
    maxY = Math.max(maxY, itemMaxY);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let maxDistanceFromCenter = 0;
  items.forEach((item) => {
    const itemCenterX = item.x + item.width / 2;
    const itemCenterY = item.y + item.height / 2;
    const distance = Math.sqrt(
      Math.pow(itemCenterX - centerX, 2) + Math.pow(itemCenterY - centerY, 2)
    );
    const itemRadius = Math.sqrt(Math.pow(item.width / 2, 2) + Math.pow(item.height / 2, 2));
    maxDistanceFromCenter = Math.max(maxDistanceFromCenter, distance + itemRadius);
  });

  const boundingWidth = maxX - minX;
  const boundingHeight = maxY - minY;
  const circleRadius = maxDistanceFromCenter;

  const pixelMinX = minX * scale;
  const pixelMinY = minY * scale;
  const pixelBoundingWidth = boundingWidth * scale;
  const pixelBoundingHeight = boundingHeight * scale;
  const pixelCenterX = centerX * scale;
  const pixelCenterY = centerY * scale;
  const pixelCircleRadius = circleRadius * scale;

  const tableItem = items.find((item) => item.type === 'table');

  return (
    <>
      <div
        className="absolute border-2 border-blue-500 pointer-events-none"
        style={{
          left: `${pixelMinX}px`,
          top: `${pixelMinY}px`,
          width: `${pixelBoundingWidth}px`,
          height: `${pixelBoundingHeight}px`,
        }}
      />
      <div
        className="absolute border-2 border-blue-500 rounded-full pointer-events-none"
        style={{
          left: `${pixelCenterX - pixelCircleRadius}px`,
          top: `${pixelCenterY - pixelCircleRadius}px`,
          width: `${pixelCircleRadius * 2}px`,
          height: `${pixelCircleRadius * 2}px`,
        }}
      />
      <div
        className="absolute bg-blue-500 rounded-full pointer-events-none"
        style={{
          left: `${pixelCenterX - 4}px`,
          top: `${pixelMinY - 16}px`,
          width: '8px',
          height: '8px',
        }}
      />
      {tableItem && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tableItem.id);
          }}
          className="absolute bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-lg z-10"
          style={{
            left: `${pixelMinX + pixelBoundingWidth + 8}px`,
            top: `${pixelMinY - 8}px`,
          }}
          title="Delete Group (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </>
  );
}
