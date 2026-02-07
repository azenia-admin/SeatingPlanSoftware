import { FurnitureItem } from '../types/furniture';
import { computeRowSeatPositions, computeMultiRowPositions } from './arcGeometry';
import { supabase, isSupabaseConfigured } from './supabase';

const CHAIR_SIZE = 1.67;

/**
 * Update chair positions for a single row based on curve value
 */
export async function updateRowCurvePositions(
  row: FurnitureItem,
  allFurniture: FurnitureItem[]
): Promise<void> {
  if (row.type !== 'row' || !row.group_id) {
    return;
  }

  // Get all chairs in this row's group
  const chairs = allFurniture.filter(
    (item) => item.type === 'chair' && item.group_id === row.group_id
  );

  if (chairs.length === 0) {
    return;
  }

  // Compute new positions based on arc geometry
  const seatPositions = computeRowSeatPositions(row);

  if (seatPositions.length !== chairs.length) {
    console.warn('Seat count mismatch', seatPositions.length, chairs.length);
    return;
  }

  // Sort chairs by distance from row center to maintain order
  const rowCenterX = row.x + row.width / 2;
  const rowCenterY = row.y + row.height / 2;

  const sortedChairs = [...chairs].sort((a, b) => {
    const aDist = Math.sqrt(
      Math.pow(a.x + a.width / 2 - rowCenterX, 2) +
      Math.pow(a.y + a.height / 2 - rowCenterY, 2)
    );
    const bDist = Math.sqrt(
      Math.pow(b.x + b.width / 2 - rowCenterX, 2) +
      Math.pow(b.y + b.height / 2 - rowCenterY, 2)
    );
    return aDist - bDist;
  });

  // Transform seat positions from row-local space to world space
  const rowRotationRad = (row.rotation * Math.PI) / 180;
  const cosR = Math.cos(rowRotationRad);
  const sinR = Math.sin(rowRotationRad);

  const updates = sortedChairs.map((chair, index) => {
    const seatPos = seatPositions[index];

    // Rotate seat position by row's rotation
    const rotatedX = seatPos.x * cosR - seatPos.y * sinR;
    const rotatedY = seatPos.x * sinR + seatPos.y * cosR;

    // Translate to world position
    const worldX = rowCenterX + rotatedX - CHAIR_SIZE / 2;
    const worldY = rowCenterY + rotatedY - CHAIR_SIZE / 2;

    // Chair rotation = row rotation + seat's local rotation
    const chairRotation = row.rotation + (seatPos.angle * 180) / Math.PI;

    return {
      id: chair.id,
      x: worldX,
      y: worldY,
      rotation: chairRotation,
    };
  });

  // Update database
  if (isSupabaseConfigured) {
    for (const update of updates) {
      await supabase
        .from('furniture_items')
        .update({
          x: update.x,
          y: update.y,
          rotation: update.rotation,
        })
        .eq('id', update.id);
    }
  }
}

/**
 * Update chair positions for multiple rows (concentric arcs)
 */
export async function updateMultiRowCurvePositions(
  rows: FurnitureItem[],
  allFurniture: FurnitureItem[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  // All rows should share the same group and center
  const firstRow = rows[0];
  if (!firstRow.group_id) {
    return;
  }

  // Get all chairs for all rows
  const allChairs = allFurniture.filter(
    (item) => item.type === 'chair' && item.group_id === firstRow.group_id
  );

  if (allChairs.length === 0) {
    return;
  }

  // Compute multi-row positions
  const rowSpacing = firstRow.seat_spacing || 20;
  const multiRowPositions = computeMultiRowPositions(rows, rowSpacing);

  // Update each row's chairs
  for (const row of rows) {
    const seatPositions = multiRowPositions.get(row.id);
    if (!seatPositions) {
      continue;
    }

    // Get chairs for this specific row
    const rowChairs = allChairs.filter((chair) => {
      // Match chairs to rows based on proximity
      const chairCenterY = chair.y + chair.height / 2;
      const rowCenterY = row.y + row.height / 2;
      return Math.abs(chairCenterY - rowCenterY) < CHAIR_SIZE * 2;
    });

    if (rowChairs.length === 0) {
      continue;
    }

    // Sort chairs by X position
    const sortedChairs = [...rowChairs].sort(
      (a, b) => a.x + a.width / 2 - (b.x + b.width / 2)
    );

    // Transform seat positions from row-local space to world space
    const rowCenterX = row.x + row.width / 2;
    const rowCenterY = row.y + row.height / 2;
    const rowRotationRad = (row.rotation * Math.PI) / 180;
    const cosR = Math.cos(rowRotationRad);
    const sinR = Math.sin(rowRotationRad);

    const updates = sortedChairs.slice(0, seatPositions.length).map((chair, index) => {
      const seatPos = seatPositions[index];

      // Rotate seat position by row's rotation
      const rotatedX = seatPos.x * cosR - seatPos.y * sinR;
      const rotatedY = seatPos.x * sinR + seatPos.y * cosR;

      // Translate to world position
      const worldX = rowCenterX + rotatedX - CHAIR_SIZE / 2;
      const worldY = rowCenterY + rotatedY - CHAIR_SIZE / 2;

      // Chair rotation = row rotation + seat's local rotation
      const chairRotation = row.rotation + (seatPos.angle * 180) / Math.PI;

      return {
        id: chair.id,
        x: worldX,
        y: worldY,
        rotation: chairRotation,
      };
    });

    // Update database
    if (isSupabaseConfigured) {
      for (const update of updates) {
        await supabase
          .from('furniture_items')
          .update({
            x: update.x,
            y: update.y,
            rotation: update.rotation,
          })
          .eq('id', update.id);
      }
    }
  }
}
