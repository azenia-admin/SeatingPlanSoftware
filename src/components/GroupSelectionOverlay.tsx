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
  const [rotationStart, setRotationStart] = useState<{ angle: number; centerX: number; centerY: number; initialRotation: number } | null>(null);
  const [rotationDelta, setRotationDelta] = useState(0);

  // Calculate bounding box and row geometry first (needed for rotation calculation)
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

  // Find the two furthest apart points to determine row endpoints
  let maxDistance = 0;
  let firstChair = items[0];
  let lastChair = items[items.length - 1];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemI = items[i];
      const itemJ = items[j];
      const centerIX = itemI.x + itemI.width / 2;
      const centerIY = itemI.y + itemI.height / 2;
      const centerJX = itemJ.x + itemJ.width / 2;
      const centerJY = itemJ.y + itemJ.height / 2;

      const distance = Math.sqrt(
        Math.pow(centerJX - centerIX, 2) + Math.pow(centerJY - centerIY, 2)
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        firstChair = itemI;
        lastChair = itemJ;
      }
    }
  }

  // Always calculate the live geometric angle from actual positions
  const firstCenterX = firstChair.x + firstChair.width / 2;
  const firstCenterY = firstChair.y + firstChair.height / 2;
  const lastCenterX = lastChair.x + lastChair.width / 2;
  const lastCenterY = lastChair.y + lastChair.height / 2;

  const liveGeometricAngle = Math.atan2(
    lastCenterY - firstCenterY,
    lastCenterX - firstCenterX
  ) * (180 / Math.PI);

  // During rotation, currentRotation is the target absolute angle (initial + delta)
  // When not rotating, it's just the live geometric angle
  const currentRotation = isRotating && rotationStart
    ? rotationStart.initialRotation + rotationDelta
    : liveGeometricAngle;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const padding = 0.1;
  const boxLeft = (minX - padding) * scale;
  const boxTop = (minY - padding) * scale;
  const boxWidth = (maxX - minX + padding * 2) * scale;
  const boxHeight = (maxY - minY + padding * 2) * scale;

  const firstCenterScreenX = (firstChair.x + firstChair.width / 2) * scale;
  const firstCenterScreenY = (firstChair.y + firstChair.height / 2) * scale;
  const lastCenterScreenX = (lastChair.x + lastChair.width / 2) * scale;
  const lastCenterScreenY = (lastChair.y + lastChair.height / 2) * scale;

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

    // Calculate initial mouse angle from center to mouse
    const initialMouseAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

    setRotationStart({
      angle: initialMouseAngle,
      centerX: centerScreenX,
      centerY: centerScreenY,
      initialRotation: liveGeometricAngle
    });
    setRotationDelta(0);
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
      // Calculate current mouse angle from center to mouse
      const currentMouseAngle = Math.atan2(
        e.clientY - rotationStart.centerY,
        e.clientX - rotationStart.centerX
      ) * (180 / Math.PI);

      // Calculate how much the mouse has rotated
      const mouseDelta = currentMouseAngle - rotationStart.angle;

      // Calculate the target rotation (initial geometric angle + mouse delta)
      let targetRotation = rotationStart.initialRotation + mouseDelta;

      // Snap to 45-degree increments
      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
      const snapThreshold = 3; // degrees

      // Find the closest snap angle occurrence to targetRotation
      let closestSnapValue = targetRotation;
      let minDistance = Infinity;

      for (const snapAngle of snapAngles) {
        // Find the closest occurrence of this snap angle to targetRotation
        // by finding which multiple of 360 to add
        const k = Math.round((targetRotation - snapAngle) / 360);
        const snapOccurrence = snapAngle + k * 360;
        const distance = Math.abs(targetRotation - snapOccurrence);

        if (distance < minDistance) {
          minDistance = distance;
          closestSnapValue = snapOccurrence;
        }
      }

      // Apply snap if within threshold
      const snappedRotation = minDistance <= snapThreshold ? closestSnapValue : targetRotation;

      // Update the delta (difference from INITIAL geometric angle, not current)
      setRotationDelta(snappedRotation - rotationStart.initialRotation);

      // Update preview
      if (onRotatePreview && items[0].group_id) {
        onRotatePreview(items[0].group_id, snappedRotation);
      }
    };

    const handleMouseUp = () => {
      if (onRotateRow && items[0].group_id && rotationStart) {
        const finalRotation = rotationStart.initialRotation + rotationDelta;
        onRotateRow(items[0].group_id, finalRotation);
      }
      setIsRotating(false);
      setRotationStart(null);
      setRotationDelta(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRotating, rotationStart, liveGeometricAngle, rotationDelta, onRotateRow, onRotatePreview, items]);

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
        // Use currentRotation for display (target angle we're rotating to)
        const displayRotation = currentRotation;
        // Check snap status based on currentRotation (target angle) within snap threshold
        const normalizedTargetAngle = ((currentRotation % 360) + 360) % 360;
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        const snapThreshold = 3;
        const isSnapped = snapAngles.some(angle => {
          const distance = Math.abs(normalizedTargetAngle - angle);
          const wrappedDistance = Math.abs(normalizedTargetAngle - (angle + 360));
          return Math.min(distance, wrappedDistance) <= snapThreshold;
        });

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
              {(() => {
                // Normalize to 0-180 range for display (since a line at angle X is the same as angle X+180)
                let normalizedDisplay = ((displayRotation % 360) + 360) % 360;
                if (normalizedDisplay > 180) {
                  normalizedDisplay = normalizedDisplay - 180;
                }
                return Math.round(normalizedDisplay);
              })()}° {isSnapped && '✓'}
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
              const snapThreshold = 3;
              const distance = Math.abs(currentNormalized - angle);
              const wrappedDistance = Math.abs(currentNormalized - (angle + 360));
              const isThisSnap = Math.min(distance, wrappedDistance) <= snapThreshold;

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
