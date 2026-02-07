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

  // Update row's seat_count and seat_spacing to match actual chair configuration if needed
  let updatedRow = { ...row };
  let needsUpdate = false;

  if ((row.seat_count || 0) !== chairs.length) {
    updatedRow.seat_count = chairs.length;
    needsUpdate = true;
  }

  // Set default seat_spacing if not present (based on chair size)
  if (!row.seat_spacing || row.seat_spacing === 0) {
    updatedRow.seat_spacing = CHAIR_SIZE;
    needsUpdate = true;
  }

  if (needsUpdate && isSupabaseConfigured) {
    await supabase
      .from('furniture_items')
      .update({
        seat_count: updatedRow.seat_count,
        seat_spacing: updatedRow.seat_spacing
      })
      .eq('id', row.id);
  }

  row = updatedRow;

  // Compute new positions based on arc geometry
  console.log('Computing arc positions:', {
    curve: row.curve,
    seatCount: row.seat_count,
    seatSpacing: row.seat_spacing,
    rotation: row.rotation
  });

  const seatPositions = computeRowSeatPositions(row);

  console.log('Generated seat positions:', seatPositions.length, 'positions for', chairs.length, 'chairs');

  if (seatPositions.length !== chairs.length) {
    console.warn('Seat count mismatch', seatPositions.length, chairs.length);
    return;
  }

  // Sort chairs by position along the row axis to maintain left-to-right order
  const rowCenterX = row.x + row.width / 2;
  const rowCenterY = row.y + row.height / 2;
  const rowRotationRad = ((row.rotation || 0) * Math.PI) / 180;

  // Project each chair position onto the row axis
  const sortedChairs = [...chairs].sort((a, b) => {
    const aCenterX = a.x + a.width / 2;
    const aCenterY = a.y + a.height / 2;
    const bCenterX = b.x + b.width / 2;
    const bCenterY = b.y + b.height / 2;

    // Vector from row center to chair
    const aRelX = aCenterX - rowCenterX;
    const aRelY = aCenterY - rowCenterY;
    const bRelX = bCenterX - rowCenterX;
    const bRelY = bCenterY - rowCenterY;

    // Project onto row axis (unrotate to get position along row)
    const cosR = Math.cos(-rowRotationRad);
    const sinR = Math.sin(-rowRotationRad);
    const aAlongAxis = aRelX * cosR - aRelY * sinR;
    const bAlongAxis = bRelX * cosR - bRelY * sinR;

    return aAlongAxis - bAlongAxis;
  });

  // Transform seat positions from row-local space to world space
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
    const chairRotation = (row.rotation || 0) + (seatPos.angle * 180) / Math.PI;

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

    // Sort chairs by position along the row axis
    const rowCenterX = row.x + row.width / 2;
    const rowCenterY = row.y + row.height / 2;
    const rowRotationRad = ((row.rotation || 0) * Math.PI) / 180;

    const sortedChairs = [...rowChairs].sort((a, b) => {
      const aCenterX = a.x + a.width / 2;
      const aCenterY = a.y + a.height / 2;
      const bCenterX = b.x + b.width / 2;
      const bCenterY = b.y + b.height / 2;

      const aRelX = aCenterX - rowCenterX;
      const aRelY = aCenterY - rowCenterY;
      const bRelX = bCenterX - rowCenterX;
      const bRelY = bCenterY - rowCenterY;

      const cosR = Math.cos(-rowRotationRad);
      const sinR = Math.sin(-rowRotationRad);
      const aAlongAxis = aRelX * cosR - aRelY * sinR;
      const bAlongAxis = bRelX * cosR - bRelY * sinR;

      return aAlongAxis - bAlongAxis;
    });

    // Transform seat positions from row-local space to world space
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
      const chairRotation = (row.rotation || 0) + (seatPos.angle * 180) / Math.PI;

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
