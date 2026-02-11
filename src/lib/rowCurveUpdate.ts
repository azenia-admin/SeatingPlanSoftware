import { FurnitureItem } from '../types/furniture';
import { computeRowSeatPositions } from './arcGeometry';
import { supabase, isSupabaseConfigured } from './supabase';

const CHAIR_SIZE = 1.67;

function computeActualChairSpacing(chairs: FurnitureItem[]): number {
  if (chairs.length < 2) return CHAIR_SIZE;

  const sorted = [...chairs].sort((a, b) => {
    const aCx = a.x + a.width / 2;
    const bCx = b.x + b.width / 2;
    const aCy = a.y + a.height / 2;
    const bCy = b.y + b.height / 2;
    const diff = aCx - bCx;
    if (Math.abs(diff) > 0.01) return diff;
    return aCy - bCy;
  });

  let totalDist = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dx = (sorted[i].x + sorted[i].width / 2) - (sorted[i - 1].x + sorted[i - 1].width / 2);
    const dy = (sorted[i].y + sorted[i].height / 2) - (sorted[i - 1].y + sorted[i - 1].height / 2);
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }

  return totalDist / (sorted.length - 1);
}

function sortChairsAlongRowAxis(
  chairs: FurnitureItem[],
  rowCenterX: number,
  rowCenterY: number,
  rowRotationRad: number
): FurnitureItem[] {
  return [...chairs].sort((a, b) => {
    const aRelX = (a.x + a.width / 2) - rowCenterX;
    const aRelY = (a.y + a.height / 2) - rowCenterY;
    const bRelX = (b.x + b.width / 2) - rowCenterX;
    const bRelY = (b.y + b.height / 2) - rowCenterY;

    const cosR = Math.cos(-rowRotationRad);
    const sinR = Math.sin(-rowRotationRad);
    const aAlong = aRelX * cosR - aRelY * sinR;
    const bAlong = bRelX * cosR - bRelY * sinR;

    return aAlong - bAlong;
  });
}

export async function updateRowCurvePositions(
  row: FurnitureItem,
  allFurniture: FurnitureItem[]
): Promise<void> {
  if (row.type !== 'row' || !row.group_id) return;

  const chairs = allFurniture.filter(
    (item) => item.type === 'chair' && item.group_id === row.group_id
  );
  if (chairs.length === 0) return;

  const actualSpacing = computeActualChairSpacing(chairs);

  const computeRow: FurnitureItem = {
    ...row,
    seat_count: chairs.length,
    seat_spacing: actualSpacing,
  };

  if (isSupabaseConfigured) {
    await supabase
      .from('furniture_items')
      .update({ seat_count: chairs.length, seat_spacing: actualSpacing })
      .eq('id', row.id);
  }

  const seatPositions = computeRowSeatPositions(computeRow);
  if (seatPositions.length !== chairs.length) return;

  const rowCenterX = row.x + row.width / 2;
  const rowCenterY = row.y + row.height / 2;
  const rowRotationRad = ((row.rotation || 0) * Math.PI) / 180;

  const sortedChairs = sortChairsAlongRowAxis(chairs, rowCenterX, rowCenterY, rowRotationRad);

  const cosR = Math.cos(rowRotationRad);
  const sinR = Math.sin(rowRotationRad);

  const updates = sortedChairs.map((chair, index) => {
    const seatPos = seatPositions[index];
    const rotatedX = seatPos.x * cosR - seatPos.y * sinR;
    const rotatedY = seatPos.x * sinR + seatPos.y * cosR;

    return {
      id: chair.id,
      x: rowCenterX + rotatedX - CHAIR_SIZE / 2,
      y: rowCenterY + rotatedY - CHAIR_SIZE / 2,
      rotation: (row.rotation || 0) + (seatPos.angle * 180) / Math.PI,
    };
  });

  if (isSupabaseConfigured) {
    await Promise.all(updates.map(update =>
      supabase
        .from('furniture_items')
        .update({ x: update.x, y: update.y, rotation: update.rotation })
        .eq('id', update.id)
    ));
  }
}

export async function updateMultiRowCurvePositions(
  rows: FurnitureItem[],
  allFurniture: FurnitureItem[]
): Promise<void> {
  if (rows.length === 0) return;

  await Promise.all(rows.map(row => updateRowCurvePositions(row, allFurniture)));
}
