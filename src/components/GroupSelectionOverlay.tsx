import { Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { FurnitureItem } from '../types/furniture';

interface GroupSelectionOverlayProps {
  items: FurnitureItem[];
  scale: number;
  onDelete: (id: string) => void;
  onExtendRow?: (groupId: string, side: 'left' | 'right', count: number) => void;
}

export default function GroupSelectionOverlay({ items, scale, onDelete, onExtendRow }: GroupSelectionOverlayProps) {
  if (items.length === 0) return null;

  const tableItem = items.find((item) => item.type === 'table');

  if (tableItem) {
    const tableCenterX = tableItem.x + tableItem.width / 2;
    const tableCenterY = tableItem.y + tableItem.height / 2;

    let maxDistanceFromCenter = 0;
    items.forEach((item) => {
      const itemCenterX = item.x + item.width / 2;
      const itemCenterY = item.y + item.height / 2;
      const distanceToItemCenter = Math.sqrt(
        Math.pow(itemCenterX - tableCenterX, 2) + Math.pow(itemCenterY - tableCenterY, 2)
      );
      const itemRadius = item.width / 2;
      maxDistanceFromCenter = Math.max(maxDistanceFromCenter, distanceToItemCenter + itemRadius);
    });

    const circleRadius = maxDistanceFromCenter;

    const squareLeft = tableCenterX - circleRadius;
    const squareTop = tableCenterY - circleRadius;
    const squareSize = circleRadius * 2;

    const pixelCenterX = tableCenterX * scale;
    const pixelCenterY = tableCenterY * scale;
    const pixelCircleRadius = circleRadius * scale;
    const pixelSquareLeft = squareLeft * scale;
    const pixelSquareTop = squareTop * scale;
    const pixelSquareSize = squareSize * scale;

    return (
      <>
        <div
          className="absolute border-2 border-blue-500 pointer-events-none"
          style={{
            left: `${pixelSquareLeft}px`,
            top: `${pixelSquareTop}px`,
            width: `${pixelSquareSize}px`,
            height: `${pixelSquareSize}px`,
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
            top: `${pixelSquareTop - 16}px`,
            width: '8px',
            height: '8px',
          }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tableItem.id);
          }}
          className="absolute bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-lg z-10"
          style={{
            left: `${pixelSquareLeft + pixelSquareSize + 8}px`,
            top: `${pixelSquareTop - 8}px`,
          }}
          title="Delete Group (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    );
  }

  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const dragCurrentPos = useRef<{ x: number; y: number } | null>(null);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach((item) => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  const padding = 0.1;
  const boxLeft = (minX - padding) * scale;
  const boxTop = (minY - padding) * scale;
  const boxWidth = (maxX - minX + padding * 2) * scale;
  const boxHeight = (maxY - minY + padding * 2) * scale;

  // Calculate row direction and endpoints
  const sortedItems = [...items].sort((a, b) => {
    const distA = Math.sqrt(a.x * a.x + a.y * a.y);
    const distB = Math.sqrt(b.x * b.x + b.y * b.y);
    return distA - distB;
  });

  const firstChair = sortedItems[0];
  const lastChair = sortedItems[sortedItems.length - 1];

  const firstCenterX = (firstChair.x + firstChair.width / 2) * scale;
  const firstCenterY = (firstChair.y + firstChair.height / 2) * scale;
  const lastCenterX = (lastChair.x + lastChair.width / 2) * scale;
  const lastCenterY = (lastChair.y + lastChair.height / 2) * scale;

  const chairSize = 1.67;

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    setDragSide(side);
    setDragStart({ x: e.clientX, y: e.clientY });
    dragCurrentPos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!dragSide) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart) return;
      dragCurrentPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStart || !dragCurrentPos.current || !onExtendRow) {
        setDragSide(null);
        setDragStart(null);
        dragCurrentPos.current = null;
        return;
      }

      const dx = (dragCurrentPos.current.x - dragStart.x) / scale;
      const dy = (dragCurrentPos.current.y - dragStart.y) / scale;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= chairSize * 0.8) {
        const seatsToAdd = Math.floor(distance / chairSize);
        if (seatsToAdd > 0 && items[0].group_id) {
          onExtendRow(items[0].group_id, dragSide, seatsToAdd);
        }
      }

      setDragSide(null);
      setDragStart(null);
      dragCurrentPos.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragSide, dragStart, scale, onExtendRow, items, chairSize]);

  const handleSize = 10;

  return (
    <>
      <div
        className="absolute border-2 border-blue-500 bg-blue-100/40 pointer-events-none rounded-lg"
        style={{
          left: `${boxLeft}px`,
          top: `${boxTop}px`,
          width: `${boxWidth}px`,
          height: `${boxHeight}px`,
        }}
      />
      <div
        className="absolute bg-blue-500 rounded-full pointer-events-none"
        style={{
          left: `${boxLeft + boxWidth / 2 - 4}px`,
          top: `${boxTop - 16}px`,
          width: '8px',
          height: '8px',
        }}
      />

      {/* Left resize handle */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'left')}
        className="absolute bg-white border-2 border-blue-500 cursor-ew-resize hover:bg-blue-50 z-20"
        style={{
          left: `${firstCenterX - handleSize / 2}px`,
          top: `${firstCenterY - handleSize / 2}px`,
          width: `${handleSize}px`,
          height: `${handleSize}px`,
        }}
      />

      {/* Right resize handle */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        className="absolute bg-white border-2 border-blue-500 cursor-ew-resize hover:bg-blue-50 z-20"
        style={{
          left: `${lastCenterX - handleSize / 2}px`,
          top: `${lastCenterY - handleSize / 2}px`,
          width: `${handleSize}px`,
          height: `${handleSize}px`,
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(items[0].id);
        }}
        className="absolute bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-lg z-10"
        style={{
          left: `${boxLeft + boxWidth + 8}px`,
          top: `${boxTop - 8}px`,
        }}
        title="Delete Row (Del)"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
