import { Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { FurnitureItem } from '../types/furniture';

interface GroupSelectionOverlayProps {
  items: FurnitureItem[];
  scale: number;
  onDelete: (id: string) => void;
  onExtendRow?: (groupId: string, side: 'left' | 'right', count: number) => void;
  onRotateRow?: (groupId: string, rotation: number) => void;
  onRotatePreview?: (groupId: string, rotation: number) => void;
}

export default function GroupSelectionOverlay({ items, scale, onDelete, onExtendRow, onRotateRow, onRotatePreview }: GroupSelectionOverlayProps) {
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
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStart, setRotationStart] = useState<{ angle: number; centerX: number; centerY: number } | null>(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  // Initialize rotation from items
  useEffect(() => {
    if (items.length > 0 && items[0].rotation !== undefined) {
      setCurrentRotation(items[0].rotation);
    }
  }, [items]);

  // Calculate bounding box
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

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

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

  // Position handles at the absolute ends of the bounding box
  const leftHandleX = boxLeft;
  const leftHandleY = boxTop + boxHeight / 2;
  const rightHandleX = boxLeft + boxWidth;
  const rightHandleY = boxTop + boxHeight / 2;

  const chairSize = 1.67;

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    setDragSide(side);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleRotationMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = document.querySelector('[data-canvas="true"]');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerScreenX = centerX * scale + rect.left;
    const centerScreenY = centerY * scale + rect.top;

    // Calculate initial angle from center to mouse
    const initialAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

    setRotationStart({
      angle: currentRotation - initialAngle,
      centerX: centerScreenX,
      centerY: centerScreenY
    });
    setIsRotating(true);
  };

  useEffect(() => {
    if (!dragSide) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart) return;
      setDragCurrentPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStart || !dragCurrentPos || !onExtendRow) {
        setDragSide(null);
        setDragStart(null);
        setDragCurrentPos(null);
        return;
      }

      const dx = (dragCurrentPos.x - dragStart.x) / scale;
      const dy = (dragCurrentPos.y - dragStart.y) / scale;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= chairSize * 0.25) {
        const seatsToAdd = Math.floor(distance / chairSize + 0.75);
        if (seatsToAdd > 0 && items[0].group_id) {
          onExtendRow(items[0].group_id, dragSide, seatsToAdd);
        }
      }

      setDragSide(null);
      setDragStart(null);
      setDragCurrentPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragSide, dragStart, scale, onExtendRow, items, chairSize, dragCurrentPos]);

  useEffect(() => {
    if (!isRotating || !rotationStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate current angle from center to mouse
      const currentAngle = Math.atan2(
        e.clientY - rotationStart.centerY,
        e.clientX - rotationStart.centerX
      ) * (180 / Math.PI);
      let newRotation = rotationStart.angle + currentAngle;

      // Snap to 45-degree increments
      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
      const snapThreshold = 8; // degrees

      // Normalize angle to 0-360 range
      let normalizedAngle = newRotation % 360;
      if (normalizedAngle < 0) normalizedAngle += 360;

      // Check if close to any snap angle
      let snappedAngle = newRotation;
      for (const snapAngle of snapAngles) {
        const distance = Math.abs(normalizedAngle - snapAngle);
        const wrappedDistance = Math.abs(normalizedAngle - (snapAngle + 360));
        const minDistance = Math.min(distance, wrappedDistance);

        if (minDistance <= snapThreshold) {
          // Snap to this angle
          const snapOffset = newRotation - normalizedAngle;
          snappedAngle = snapAngle + snapOffset;
          break;
        }
      }

      setCurrentRotation(snappedAngle);

      // Update preview
      if (onRotatePreview && items[0].group_id) {
        onRotatePreview(items[0].group_id, snappedAngle);
      }
    };

    const handleMouseUp = () => {
      if (onRotateRow && items[0].group_id && rotationStart) {
        onRotateRow(items[0].group_id, currentRotation);
      }
      setIsRotating(false);
      setRotationStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRotating, rotationStart, currentRotation, onRotateRow, onRotatePreview, items]);

  const handleSize = 10;

  // Calculate preview seats during drag
  let previewSeats: Array<{ x: number; y: number }> = [];
  let totalSeats = items.length;
  let rowCenterX = 0;
  let rowCenterY = 0;

  if (dragSide && dragStart && dragCurrentPos) {
    const dx = (dragCurrentPos.x - dragStart.x) / scale;
    const dy = (dragCurrentPos.y - dragStart.y) / scale;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= chairSize * 0.25) {
      const seatsToAdd = Math.floor(distance / chairSize + 0.75);

      // Calculate the direction vector for the row
      const rowDx = lastChair.x - firstChair.x;
      const rowDy = lastChair.y - firstChair.y;
      const rowLength = Math.sqrt(rowDx * rowDx + rowDy * rowDy);
      const dirX = rowDx / rowLength;
      const dirY = rowDy / rowLength;

      // Generate preview seat positions
      for (let i = 1; i <= seatsToAdd; i++) {
        if (dragSide === 'left') {
          const newX = firstChair.x - dirX * chairSize * i;
          const newY = firstChair.y - dirY * chairSize * i;
          previewSeats.push({ x: newX, y: newY });
        } else {
          const newX = lastChair.x + dirX * chairSize * i;
          const newY = lastChair.y + dirY * chairSize * i;
          previewSeats.push({ x: newX, y: newY });
        }
      }

      totalSeats = items.length + seatsToAdd;

      // Calculate the center of the prospective row
      if (dragSide === 'left' && previewSeats.length > 0) {
        const leftmostSeat = previewSeats[previewSeats.length - 1];
        rowCenterX = (leftmostSeat.x + chairSize / 2 + lastChair.x + chairSize / 2) / 2;
        rowCenterY = (leftmostSeat.y + chairSize / 2 + lastChair.y + chairSize / 2) / 2;
      } else if (dragSide === 'right' && previewSeats.length > 0) {
        const rightmostSeat = previewSeats[previewSeats.length - 1];
        rowCenterX = (firstChair.x + chairSize / 2 + rightmostSeat.x + chairSize / 2) / 2;
        rowCenterY = (firstChair.y + chairSize / 2 + rightmostSeat.y + chairSize / 2) / 2;
      }
    }
  }

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

      {/* Rotation handle */}
      <div
        onMouseDown={handleRotationMouseDown}
        className="absolute bg-green-500 border-2 border-white rounded-full cursor-grab active:cursor-grabbing hover:bg-green-400 z-20 flex items-center justify-center shadow-lg"
        style={{
          left: `${boxLeft + boxWidth / 2 - 12}px`,
          top: `${boxTop - 40}px`,
          width: '24px',
          height: '24px',
        }}
        title="Rotate row"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </div>

      {/* Left resize handle */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'left')}
        className="absolute bg-yellow-400 border-2 border-gray-700 cursor-ew-resize hover:bg-yellow-300 z-20"
        style={{
          left: `${leftHandleX - handleSize / 2}px`,
          top: `${leftHandleY - handleSize / 2}px`,
          width: `${handleSize}px`,
          height: `${handleSize}px`,
        }}
      />

      {/* Right resize handle */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        className="absolute bg-yellow-400 border-2 border-gray-700 cursor-ew-resize hover:bg-yellow-300 z-20"
        style={{
          left: `${rightHandleX - handleSize / 2}px`,
          top: `${rightHandleY - handleSize / 2}px`,
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

      {/* Preview seats during drag */}
      {previewSeats.map((seat, index) => (
        <div
          key={`preview-${index}`}
          className="absolute rounded-full border-2 border-dashed border-blue-400 bg-blue-100/50 pointer-events-none"
          style={{
            left: `${seat.x * scale}px`,
            top: `${seat.y * scale}px`,
            width: `${chairSize * scale}px`,
            height: `${chairSize * scale}px`,
          }}
        />
      ))}

      {/* Seat counter during drag */}
      {dragSide && previewSeats.length > 0 && (
        <div
          className="absolute bg-gray-800 text-white px-3 py-1 rounded font-semibold text-sm pointer-events-none z-30"
          style={{
            left: `${rowCenterX * scale}px`,
            top: `${rowCenterY * scale}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {totalSeats}
        </div>
      )}

      {/* Rotation angle indicator during rotation */}
      {isRotating && (() => {
        // Check if snapped to a snap angle
        const normalizedAngle = ((currentRotation % 360) + 360) % 360;
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        const isSnapped = snapAngles.some(angle => Math.abs(normalizedAngle - angle) < 1 || Math.abs(normalizedAngle - (angle + 360)) < 1);

        return (
          <>
            {/* Center point indicator */}
            <div
              className={`absolute rounded-full pointer-events-none z-30 transition-colors ${
                isSnapped ? 'bg-blue-500' : 'bg-green-500'
              }`}
              style={{
                left: `${boxLeft + boxWidth / 2 - 6}px`,
                top: `${boxTop + boxHeight / 2 - 6}px`,
                width: '12px',
                height: '12px',
              }}
            />

            {/* Rotation angle display */}
            <div
              className={`absolute text-white px-3 py-1 rounded font-semibold text-sm pointer-events-none z-30 shadow-lg transition-colors ${
                isSnapped ? 'bg-blue-600' : 'bg-green-600'
              }`}
              style={{
                left: `${boxLeft + boxWidth / 2}px`,
                top: `${boxTop + boxHeight / 2}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {Math.round(currentRotation)}° {isSnapped && '✓'}
            </div>

            {/* Snap angle guide lines */}
            {[0, 45, 90, 135].map((angle) => {
              const angleRad = (angle * Math.PI) / 180;
              const lineLength = Math.max(boxWidth, boxHeight) / 2 + 10;
              const x1 = boxLeft + boxWidth / 2;
              const y1 = boxTop + boxHeight / 2;
              const x2 = x1 + Math.cos(angleRad) * lineLength;
              const y2 = y1 + Math.sin(angleRad) * lineLength;

              const currentNormalized = ((currentRotation % 360) + 360) % 360;
              const isThisSnap = Math.abs(currentNormalized - angle) < 1 || Math.abs(currentNormalized - (angle + 360)) < 1;

              return (
                <svg
                  key={angle}
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'visible',
                  }}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isThisSnap ? '#3b82f6' : '#d1d5db'}
                    strokeWidth={isThisSnap ? '2' : '1'}
                    strokeDasharray="4,4"
                    opacity={isThisSnap ? '0.8' : '0.3'}
                  />
                </svg>
              );
            })}
          </>
        );
      })()}
    </>
  );
}
