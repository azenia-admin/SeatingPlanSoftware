import { FurnitureItem } from '../types/furniture';

/**
 * Seat position along an arc, relative to row center
 */
export interface SeatPosition {
  x: number;
  y: number;
  angle: number; // Rotation angle in radians for the seat
}

/**
 * Arc geometry for a curved row
 */
export interface ArcGeometry {
  radius: number;        // Arc radius
  totalAngle: number;    // Total arc angle in radians
  centerX: number;       // Arc center X (in row space, before rotation)
  centerY: number;       // Arc center Y (in row space, before rotation)
}

/**
 * Compute arc geometry from row properties
 *
 * Math explanation:
 * - curve = 0: straight line (infinite radius)
 * - curve > 0: circular arc
 * - radius is derived from: straightLength / curve
 * - This makes curve represent "curvature per unit length"
 * - totalAngle = arcLength / radius = straightLength / radius
 */
function computeArcGeometry(
  seatCount: number,
  seatSpacing: number,
  curve: number
): ArcGeometry | null {
  if (curve <= 0 || seatCount < 2) {
    return null; // Straight line or invalid
  }

  // Total straight-line length occupied by seats
  const straightLength = (seatCount - 1) * seatSpacing;

  const normalizedCurve = curve * 0.1;
  const radius = straightLength / normalizedCurve;

  // Total arc angle (in radians)
  const totalAngle = straightLength / radius;

  // Arc center is offset perpendicular to the row
  // For an upward-curving arc (concave up), center is below the row
  // In screen coordinates (Y increases downward), positive Y moves down
  const centerX = 0;
  const centerY = radius;

  return {
    radius,
    totalAngle,
    centerX,
    centerY
  };
}

/**
 * Compute seat positions for a row
 *
 * For straight rows (curve = 0):
 * - Seats are positioned linearly along X axis
 * - Centered around origin
 *
 * For curved rows (curve > 0):
 * - Seats are positioned along circular arc
 * - Arc is symmetric around row center
 * - Each seat maintains perpendicular orientation to arc
 */
export function computeRowSeatPositions(row: FurnitureItem): SeatPosition[] {
  const seatCount = row.seat_count || 0;
  const seatSpacing = row.seat_spacing || 1.67;
  const curve = row.curve || 0;

  if (seatCount < 1) {
    return [];
  }

  const positions: SeatPosition[] = [];

  if (curve <= 0 || seatCount < 2) {
    // Straight line: seats along X axis
    const totalWidth = (seatCount - 1) * seatSpacing;
    const startX = -totalWidth / 2;

    for (let i = 0; i < seatCount; i++) {
      positions.push({
        x: startX + i * seatSpacing,
        y: 0,
        angle: 0 // No additional rotation for straight rows
      });
    }
  } else {
    // Curved arc: seats along circle
    const arc = computeArcGeometry(seatCount, seatSpacing, curve);

    if (!arc) {
      // Fallback to straight line
      const totalWidth = (seatCount - 1) * seatSpacing;
      const startX = -totalWidth / 2;

      for (let i = 0; i < seatCount; i++) {
        positions.push({
          x: startX + i * seatSpacing,
          y: 0,
          angle: 0
        });
      }
      return positions;
    }

    // Distribute seats evenly along arc
    const startAngle = -arc.totalAngle / 2;
    const angleStep = seatCount > 1 ? arc.totalAngle / (seatCount - 1) : 0;

    for (let i = 0; i < seatCount; i++) {
      const angle = startAngle + i * angleStep;

      // Position on circle (relative to arc center)
      // For upward-curving arc: center is below, so we subtract Y
      const x = arc.centerX + arc.radius * Math.sin(angle);
      const y = arc.centerY - arc.radius * Math.cos(angle);

      // Seat rotation: perpendicular to arc (tangent direction)
      // The seat should face "upward" toward the center of the viewing area
      const seatAngle = angle;

      positions.push({ x, y, angle: seatAngle });
    }
  }

  return positions;
}

/**
 * Apply curve value to a row and all rows in its group
 * Returns updated items with new curve value
 */
export function applyCurveToRowGroup(
  allItems: FurnitureItem[],
  targetRow: FurnitureItem,
  newCurve: number
): FurnitureItem[] {
  const groupId = targetRow.group_id;

  return allItems.map(item => {
    // Update all rows in the same group
    if (item.type === 'row' && item.group_id === groupId) {
      return {
        ...item,
        curve: newCurve
      };
    }
    return item;
  });
}

/**
 * Compute positions for multi-row seating (concentric arcs)
 * Each row has the same curvature but increasing radius
 */
export function computeMultiRowPositions(
  rows: FurnitureItem[],
  rowSpacing: number
): Map<string, SeatPosition[]> {
  const positions = new Map<string, SeatPosition[]>();

  // Sort rows by Y position to determine row order
  const sortedRows = [...rows].sort((a, b) => a.y - b.y);

  sortedRows.forEach((row, index) => {
    const seatCount = row.seat_count || 0;
    const seatSpacing = row.seat_spacing || 1.67;
    const curve = row.curve || 0;

    if (curve > 0 && seatCount >= 2) {
      // For curved multi-rows, adjust radius for each row
      const straightLength = (seatCount - 1) * seatSpacing;
      const normalizedCurve = curve * 0.1;
      const baseRadius = straightLength / normalizedCurve;

      // Each subsequent row increases radius by rowSpacing
      const adjustedRadius = baseRadius + index * rowSpacing;

      // Recalculate arc with adjusted radius
      const totalAngle = straightLength / adjustedRadius;
      const centerX = 0;
      const centerY = adjustedRadius;

      const rowPositions: SeatPosition[] = [];
      const startAngle = -totalAngle / 2;
      const angleStep = seatCount > 1 ? totalAngle / (seatCount - 1) : 0;

      for (let i = 0; i < seatCount; i++) {
        const angle = startAngle + i * angleStep;
        const x = centerX + adjustedRadius * Math.sin(angle);
        const y = centerY - adjustedRadius * Math.cos(angle);
        const seatAngle = angle;

        rowPositions.push({ x, y, angle: seatAngle });
      }

      positions.set(row.id, rowPositions);
    } else {
      // Straight row
      positions.set(row.id, computeRowSeatPositions(row));
    }
  });

  return positions;
}
