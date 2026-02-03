import { useRef, useState, useEffect } from 'react';
import { Save, Download, Trash2, Armchair } from 'lucide-react';
import FurnitureItem from './FurnitureItem';
import GroupSelectionOverlay from './GroupSelectionOverlay';
import type { FurnitureItem as FurnitureItemType, FurnitureTemplate } from '../types/furniture';
import { supabase } from '../lib/supabase';

interface GridCanvasProps {
  width: number;
  height: number;
  floorPlanId: string;
  draggedTemplate: FurnitureTemplate | null;
  onTemplatePlaced: () => void;
  placementMode: 'none' | 'single' | 'row';
  rowChairCount: number | null;
  onDeactivatePlacementMode: () => void;
}

export default function GridCanvas({
  width,
  height,
  floorPlanId,
  draggedTemplate,
  onTemplatePlaced,
  placementMode,
  rowChairCount,
  onDeactivatePlacementMode
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [furniture, setFurniture] = useState<FurnitureItemType[]>([]);
  const [draggedItem, setDraggedItem] = useState<FurnitureItemType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [rowAnchor, setRowAnchor] = useState<{ x: number; y: number } | null>(null);
  const [previewSeats, setPreviewSeats] = useState<Array<{ x: number; y: number }>>([]);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const initialTableCenter = useRef<{ x: number; y: number } | null>(null);
  const dragStartCursor = useRef<{ x: number; y: number } | null>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const mouseMoved = useRef(false);
  const CLICK_TOLERANCE_PX = 3;

  const gridSize = 0.5;
  const pixelGridSize = gridSize * scale;

  const formatDimension = (feet: number): string => {
    const wholeF = Math.floor(feet);
    const inches = Math.round((feet - wholeF) * 12);
    if (inches === 0) {
      return `${wholeF}'`;
    }
    return `${wholeF}'${inches}"`;
  };

  useEffect(() => {
    loadFurniture();
  }, [floorPlanId]);

  useEffect(() => {
    if (placementMode === 'none') {
      setCursorPosition(null);
      setRowAnchor(null);
      setPreviewSeats([]);
    }
  }, [placementMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
      if (e.key === 'Escape' && placementMode !== 'none') {
        e.preventDefault();
        if (rowAnchor) {
          setRowAnchor(null);
          setPreviewSeats([]);
        } else {
          onDeactivatePlacementMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, placementMode, rowAnchor]);

  const loadFurniture = async () => {
    const { data, error } = await supabase
      .from('furniture_items')
      .select('*')
      .eq('floor_plan_id', floorPlanId);

    if (error) {
      console.error('Error loading furniture:', error);
      return;
    }

    if (data) {
      setFurniture(data as FurnitureItemType[]);
    }
  };

  const snapToGrid = (value: number): number => {
    return Math.round(value / gridSize) * gridSize;
  };

  const calculateRowSeats = (anchorX: number, anchorY: number, cursorX: number, cursorY: number, fixedCount?: number | null): Array<{ x: number; y: number }> => {
    const chairSize = 1.67;
    const deltaX = cursorX - anchorX;
    const deltaY = cursorY - anchorY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < chairSize * 0.5 && !fixedCount) {
      return [{ x: anchorX, y: anchorY }];
    }

    const numSeats = fixedCount ?? (Math.floor(distance / chairSize) + 1);
    const seats: Array<{ x: number; y: number }> = [];

    const dirX = deltaX / distance;
    const dirY = deltaY / distance;

    for (let i = 0; i < numSeats; i++) {
      const x = anchorX + dirX * chairSize * i;
      const y = anchorY + dirY * chairSize * i;
      seats.push({ x, y });
    }

    return seats;
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !draggedTemplate) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid((e.clientX - rect.left) / scale);
    const y = snapToGrid((e.clientY - rect.top) / scale);

    const newFurniture: FurnitureItemType[] = [];

    if (draggedTemplate.type === 'row') {
      const chairSize = 1.67;
      const numChairs = draggedTemplate.chairs || 3;

      const chairItems = [];
      for (let i = 0; i < numChairs; i++) {
        const chairX = x + i * chairSize;
        chairItems.push({
          floor_plan_id: floorPlanId,
          type: 'chair' as const,
          x: Math.max(0, Math.min(chairX - chairSize / 2, width - chairSize)),
          y: Math.max(0, Math.min(y - chairSize / 2, height - chairSize)),
          width: chairSize,
          height: chairSize,
          rotation: 0,
          group_id: null,
        });
      }

      const { data: chairsData, error: chairsError } = await supabase
        .from('furniture_items')
        .insert(chairItems)
        .select();

      if (chairsError) {
        console.error('Error adding row:', chairsError);
        return;
      }

      if (chairsData) {
        newFurniture.push(...(chairsData as FurnitureItemType[]));
      }
    } else {
      const isCircularTable = draggedTemplate.type === 'table' && draggedTemplate.width === draggedTemplate.height;
      const groupId = isCircularTable ? crypto.randomUUID() : null;

      const newItem = {
        floor_plan_id: floorPlanId,
        type: draggedTemplate.type,
        x: Math.max(0, Math.min(x, width - draggedTemplate.width)),
        y: Math.max(0, Math.min(y, height - draggedTemplate.height)),
        width: draggedTemplate.width,
        height: draggedTemplate.height,
        rotation: 0,
        group_id: groupId,
      };

      const { data, error } = await supabase
        .from('furniture_items')
        .insert(newItem)
        .select()
        .single();

      if (error) {
        console.error('Error adding furniture:', error);
        return;
      }

      if (data) {
        newFurniture.push(data as FurnitureItemType);
      }

      if (isCircularTable && data) {
        const chairSize = 1.67;
        const tableRadius = draggedTemplate.width / 2;
        const chairOffset = tableRadius + chairSize * 0.6;
        const tableCenterX = newItem.x + tableRadius;
        const tableCenterY = newItem.y + tableRadius;

        let numChairs = 4;
        if (draggedTemplate.width === 5) {
          numChairs = 8;
        } else if (draggedTemplate.width === 6) {
          numChairs = 10;
        }

        const chairPositions = [];
        for (let i = 0; i < numChairs; i++) {
          const angle = (i * 2 * Math.PI) / numChairs;
          const chairX = tableCenterX + chairOffset * Math.cos(angle) - chairSize / 2;
          const chairY = tableCenterY + chairOffset * Math.sin(angle) - chairSize / 2;
          chairPositions.push({ x: chairX, y: chairY });
        }

        const chairItems = chairPositions.map(pos => ({
          floor_plan_id: floorPlanId,
          type: 'chair' as const,
          x: Math.max(0, Math.min(pos.x, width - chairSize)),
          y: Math.max(0, Math.min(pos.y, height - chairSize)),
          width: chairSize,
          height: chairSize,
          rotation: 0,
          group_id: groupId,
        }));

        const { data: chairsData, error: chairsError } = await supabase
          .from('furniture_items')
          .insert(chairItems)
          .select();

        if (chairsError) {
          console.error('Error adding chairs:', chairsError);
        }

        if (chairsData) {
          newFurniture.push(...(chairsData as FurnitureItemType[]));
        }
      }
    }

    setFurniture((prev) => [...prev, ...newFurniture]);
    onTemplatePlaced();
  };

  const handleDragStart = (item: FurnitureItemType) => {
    dragStartPositions.current.clear();
    initialTableCenter.current = null;

    if (item.group_id) {
      const groupItems = furniture.filter((f) => f.group_id === item.group_id);
      groupItems.forEach((groupItem) => {
        dragStartPositions.current.set(groupItem.id, { x: groupItem.x, y: groupItem.y });
      });

      // Find the table in the group and store its center
      const table = groupItems.find((f) => f.type === 'table');
      if (table) {
        initialTableCenter.current = {
          x: table.x + table.width / 2,
          y: table.y + table.height / 2
        };
      } else {
        // For rows (no table), calculate the center of all items
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        groupItems.forEach((groupItem) => {
          minX = Math.min(minX, groupItem.x);
          minY = Math.min(minY, groupItem.y);
          maxX = Math.max(maxX, groupItem.x + groupItem.width);
          maxY = Math.max(maxY, groupItem.y + groupItem.height);
        });
        initialTableCenter.current = {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2
        };
      }
    } else {
      dragStartPositions.current.set(item.id, { x: item.x, y: item.y });
    }

    setDraggedItem(item);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    if (mouseDownPos.current) {
      const dx = (e.clientX - rect.left) - mouseDownPos.current.x;
      const dy = (e.clientY - rect.top) - mouseDownPos.current.y;
      if (Math.abs(dx) > CLICK_TOLERANCE_PX || Math.abs(dy) > CLICK_TOLERANCE_PX) {
        mouseMoved.current = true;
      }
    }

    const cursorX = snapToGrid((e.clientX - rect.left) / scale);
    const cursorY = snapToGrid((e.clientY - rect.top) / scale);

    if (placementMode !== 'none') {
      setCursorPosition({ x: cursorX, y: cursorY });

      if (placementMode === 'row' && rowAnchor) {
        const seats = calculateRowSeats(rowAnchor.x, rowAnchor.y, cursorX, cursorY, rowChairCount);
        setPreviewSeats(seats);
      } else {
        setPreviewSeats([]);
      }
    } else {
      setCursorPosition(null);
      setPreviewSeats([]);
    }

    if (!draggedItem) return;

    // Capture cursor position when dragging first starts
    if (!dragStartCursor.current) {
      dragStartCursor.current = { x: cursorX, y: cursorY };
    }

    let deltaX: number;
    let deltaY: number;

    // If dragging a group, cursor position represents the table/row center
    if (initialTableCenter.current && dragStartCursor.current) {
      deltaX = cursorX - dragStartCursor.current.x;
      deltaY = cursorY - dragStartCursor.current.y;
    } else {
      // Single item - cursor position represents the item position
      const dragStartPos = dragStartPositions.current.get(draggedItem.id);
      if (!dragStartPos) return;
      deltaX = cursorX - dragStartPos.x;
      deltaY = cursorY - dragStartPos.y;
    }

    setFurniture((prevFurniture) =>
      prevFurniture.map((item) => {
        const itemStartPos = dragStartPositions.current.get(item.id);
        if (!itemStartPos) return item;

        if (item.id === draggedItem.id) {
          return {
            ...item,
            x: Math.max(0, Math.min(itemStartPos.x + deltaX, width - item.width)),
            y: Math.max(0, Math.min(itemStartPos.y + deltaY, height - item.height)),
          };
        }

        if (draggedItem.group_id && item.group_id === draggedItem.group_id) {
          return {
            ...item,
            x: Math.max(0, Math.min(itemStartPos.x + deltaX, width - item.width)),
            y: Math.max(0, Math.min(itemStartPos.y + deltaY, height - item.height)),
          };
        }

        return item;
      })
    );
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    mouseDownPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mouseMoved.current = false;
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (draggedItem) {
      const itemsToUpdate = draggedItem.group_id
        ? furniture.filter((f) => f.group_id === draggedItem.group_id)
        : furniture.filter((f) => f.id === draggedItem.id);

      // Stop dragging immediately to prevent further position updates
      setDraggedItem(null);
      dragStartPositions.current.clear();
      initialTableCenter.current = null;
      dragStartCursor.current = null;

      // Save positions to database
      for (const item of itemsToUpdate) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y })
          .eq('id', item.id);
      }
    }

    mouseDownPos.current = null;
    mouseMoved.current = false;
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = furniture.find((item) => item.id === id);
    if (!itemToDelete) return;

    if (itemToDelete.group_id) {
      await supabase
        .from('furniture_items')
        .delete()
        .eq('group_id', itemToDelete.group_id);
      setFurniture(furniture.filter((item) => item.group_id !== itemToDelete.group_id));
    } else {
      await supabase.from('furniture_items').delete().eq('id', id);
      setFurniture(furniture.filter((item) => item.id !== id));
    }

    setSelectedId(null);
  };

  const rotationBaseRef = useRef<{
    groupId: string;
    center: { x: number; y: number };
    items: Array<{ id: string; relX: number; relY: number; baseRotation: number }>;
  } | null>(null);

  const getRowAngleDeg = (items: FurnitureItemType[]) => {
    // find furthest pair
    let maxDist = -1;
    let a = items[0], b = items[items.length - 1];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const iCx = items[i].x + items[i].width / 2;
        const iCy = items[i].y + items[i].height / 2;
        const jCx = items[j].x + items[j].width / 2;
        const jCy = items[j].y + items[j].height / 2;
        const d = Math.hypot(jCx - iCx, jCy - iCy);
        if (d > maxDist) {
          maxDist = d;
          a = items[i];
          b = items[j];
        }
      }
    }

    const aCx = a.x + a.width / 2;
    const aCy = a.y + a.height / 2;
    const bCx = b.x + b.width / 2;
    const bCy = b.y + b.height / 2;

    const deg = Math.atan2(bCy - aCy, bCx - aCx) * (180 / Math.PI);
    return ((deg % 360) + 360) % 360; // normalize to 0..360
  };

  const handleRotatePreview = (groupId: string, rotation: number) => {
    // Initialize rotation base on first call
    if (!rotationBaseRef.current || rotationBaseRef.current.groupId !== groupId) {
      const groupItems = furniture.filter((item) => item.group_id === groupId);
      if (groupItems.length === 0) return;

      // Calculate the center of the row
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      groupItems.forEach((item) => {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Capture base in row-aligned frame using geometric angle
      const rowAngle = getRowAngleDeg(groupItems);
      const rowAngleRad = (rowAngle * Math.PI) / 180;

      // row-aligned frame = unrotate by rowAngle
      const cosBase = Math.cos(-rowAngleRad);
      const sinBase = Math.sin(-rowAngleRad);

      rotationBaseRef.current = {
        groupId,
        center: { x: centerX, y: centerY },
        baseAngle: rowAngle,
        items: groupItems.map((item) => {
          const itemCenterX = item.x + item.width / 2;
          const itemCenterY = item.y + item.height / 2;

          const relX = itemCenterX - centerX;
          const relY = itemCenterY - centerY;

          const alignedRelX = relX * cosBase - relY * sinBase;
          const alignedRelY = relX * sinBase + relY * cosBase;

          return { id: item.id, relX: alignedRelX, relY: alignedRelY };
        }),
      };
    }

    const base = rotationBaseRef.current;
    if (!base) return;

    const groupItems = furniture.filter((item) => item.group_id === groupId);

    // Calculate new positions after rotation
    const angleRad = (rotation * Math.PI) / 180;
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    const updatedItems = groupItems.map((item) => {
      const original = base.items.find((p) => p.id === item.id);
      if (!original) return item;

      // Rotate the original relative position
      const newRelX = original.relX * cosAngle - original.relY * sinAngle;
      const newRelY = original.relX * sinAngle + original.relY * cosAngle;

      // Convert back to absolute position
      const newX = base.center.x + newRelX - item.width / 2;
      const newY = base.center.y + newRelY - item.height / 2;

      return {
        ...item,
        x: Math.max(0, Math.min(newX, width - item.width)),
        y: Math.max(0, Math.min(newY, height - item.height)),
        rotation: rotation,
      };
    });

    // Update state only (no database save)
    setFurniture((prev) =>
      prev.map((item) => {
        const updated = updatedItems.find((u) => u.id === item.id);
        return updated || item;
      })
    );
  };

  const handleRotateRow = async (groupId: string, rotation: number) => {
    // The furniture state should already be updated by the preview
    // Just save to database and clear the rotation base
    const groupItems = furniture.filter((item) => item.group_id === groupId);
    if (groupItems.length === 0) return;

    // Update database
    for (const item of groupItems) {
      await supabase
        .from('furniture_items')
        .update({ x: item.x, y: item.y, rotation: item.rotation })
        .eq('id', item.id);
    }

    // Clear rotation base
    rotationBaseRef.current = null;
  };

  const handleExtendRow = async (groupId: string, side: 'left' | 'right', count: number) => {
    const groupItems = furniture.filter((item) => item.group_id === groupId);
    if (groupItems.length === 0) return;

    // Get the row's rotation from the first chair
    const rowRotation = groupItems[0].rotation || 0;

    // Sort items to find the direction and endpoints
    const sortedItems = [...groupItems].sort((a, b) => {
      const distA = Math.sqrt(a.x * a.x + a.y * a.y);
      const distB = Math.sqrt(b.x * b.x + b.y * b.y);
      return distA - distB;
    });

    const firstChair = sortedItems[0];
    const lastChair = sortedItems[sortedItems.length - 1];

    // Calculate direction vector
    const firstCenterX = firstChair.x + firstChair.width / 2;
    const firstCenterY = firstChair.y + firstChair.height / 2;
    const lastCenterX = lastChair.x + lastChair.width / 2;
    const lastCenterY = lastChair.y + lastChair.height / 2;

    const dx = lastCenterX - firstCenterX;
    const dy = lastCenterY - firstCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const dirX = dx / distance;
    const dirY = dy / distance;

    const chairSize = 1.67;
    const newChairs: Array<{
      floor_plan_id: string;
      type: 'chair';
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      group_id: string;
    }> = [];

    if (side === 'left') {
      // Add chairs before the first chair
      for (let i = 1; i <= count; i++) {
        const newX = firstCenterX - dirX * chairSize * i - chairSize / 2;
        const newY = firstCenterY - dirY * chairSize * i - chairSize / 2;
        newChairs.push({
          floor_plan_id: floorPlanId,
          type: 'chair',
          x: Math.max(0, Math.min(newX, width - chairSize)),
          y: Math.max(0, Math.min(newY, height - chairSize)),
          width: chairSize,
          height: chairSize,
          rotation: rowRotation,
          group_id: groupId,
        });
      }
    } else {
      // Add chairs after the last chair
      for (let i = 1; i <= count; i++) {
        const newX = lastCenterX + dirX * chairSize * i - chairSize / 2;
        const newY = lastCenterY + dirY * chairSize * i - chairSize / 2;
        newChairs.push({
          floor_plan_id: floorPlanId,
          type: 'chair',
          x: Math.max(0, Math.min(newX, width - chairSize)),
          y: Math.max(0, Math.min(newY, height - chairSize)),
          width: chairSize,
          height: chairSize,
          rotation: rowRotation,
          group_id: groupId,
        });
      }
    }

    const { data, error } = await supabase
      .from('furniture_items')
      .insert(newChairs)
      .select();

    if (error) {
      console.error('Error extending row:', error);
      return;
    }

    if (data) {
      setFurniture((prev) => [...prev, ...(data as FurnitureItemType[])]);
    }
  };

  const handlePlacementClick = async (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const target = e.target as HTMLElement;
    const isFurnitureItem = target.closest('[data-furniture-item]');

    if (isFurnitureItem) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid((e.clientX - rect.left) / scale);
    const y = snapToGrid((e.clientY - rect.top) / scale);

    const chairSize = 1.67;

    if (placementMode === 'single') {
      const newChair = {
        floor_plan_id: floorPlanId,
        type: 'chair' as const,
        x: Math.max(0, Math.min(x - chairSize / 2, width - chairSize)),
        y: Math.max(0, Math.min(y - chairSize / 2, height - chairSize)),
        width: chairSize,
        height: chairSize,
        rotation: 0,
        group_id: null,
      };

      const { data, error } = await supabase
        .from('furniture_items')
        .insert(newChair)
        .select()
        .single();

      if (error) {
        console.error('Error placing chair:', error);
        return;
      }

      if (data) {
        setFurniture((prev) => [...prev, data as FurnitureItemType]);
      }
    } else if (placementMode === 'row') {
      if (!rowAnchor) {
        setRowAnchor({ x, y });
        setPreviewSeats([{ x, y }]);
      } else {
        const seatsToPlace = calculateRowSeats(rowAnchor.x, rowAnchor.y, x, y, rowChairCount);
        if (seatsToPlace.length === 0) return;

        const groupId = crypto.randomUUID();

        // Calculate row angle from anchor to end point
        const dx = x - rowAnchor.x;
        const dy = y - rowAnchor.y;
        const rowAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const rowRotation = ((rowAngleDeg % 360) + 360) % 360;

        const chairItems = seatsToPlace.map((seat) => ({
          floor_plan_id: floorPlanId,
          type: 'chair' as const,
          x: Math.max(0, Math.min(seat.x - chairSize / 2, width - chairSize)),
          y: Math.max(0, Math.min(seat.y - chairSize / 2, height - chairSize)),
          width: chairSize,
          height: chairSize,
          rotation: rowRotation,
          group_id: groupId,
        }));

        try {
          const { data, error } = await supabase
            .from('furniture_items')
            .insert(chairItems)
            .select();

          if (error) {
            console.error('Error placing row:', error);
            return;
          }

          if (data) {
            setFurniture((prev) => [...prev, ...(data as FurnitureItemType[])]);
          }
        } finally {
          setRowAnchor(null);
          setPreviewSeats([]);
          onDeactivatePlacementMode();
        }
      }
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (placementMode === 'none') {
      setSelectedId(null);
      return;
    }

    // In placement mode, use click to place/confirm
    await handlePlacementClick(e);
  };

  const handleClearAll = async () => {
    if (furniture.length === 0) return;

    if (confirm(`Are you sure you want to delete all ${furniture.length} furniture items? This cannot be undone.`)) {
      await supabase.from('furniture_items').delete().eq('floor_plan_id', floorPlanId);
      setFurniture([]);
      setSelectedId(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await supabase
      .from('floor_plans')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', floorPlanId);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleExport = () => {
    const data = {
      floorPlan: { width, height },
      furniture: furniture.map(({ id, floor_plan_id, created_at, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floor-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800">
            Floor Plan: {formatDimension(width)} × {formatDimension(height)}
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Zoom:</label>
            <input
              type="range"
              min="30"
              max="100"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-gray-600 w-12">{scale}px/m</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            disabled={furniture.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div
          ref={canvasRef}
          data-canvas="true"
          className="relative bg-white border-2 border-gray-300 shadow-lg mx-auto"
          style={{
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${pixelGridSize}px ${pixelGridSize}px`,
            cursor: placementMode !== 'none' ? 'crosshair' : 'default',
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseMove}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setCursorPosition(null);
          }}
          onClick={handleCanvasClick}
        >
          {furniture.map((item) => {
            const selectedItem = furniture.find((f) => f.id === selectedId);
            const isSelected =
              selectedId === item.id ||
              (selectedItem?.group_id && item.group_id === selectedItem.group_id);

            return (
              <FurnitureItem
                key={item.id}
                item={item}
                scale={scale}
                onDragStart={handleDragStart}
                onDelete={handleDelete}
                isSelected={isSelected}
                onSelect={setSelectedId}
              />
            );
          })}
          {selectedId && (() => {
            const selectedItem = furniture.find((f) => f.id === selectedId);
            if (selectedItem?.group_id) {
              const groupItems = furniture.filter((f) => f.group_id === selectedItem.group_id);
              return <GroupSelectionOverlay items={groupItems} scale={scale} onDelete={handleDelete} onExtendRow={handleExtendRow} onRotateRow={handleRotateRow} onRotatePreview={handleRotatePreview} />;
            }
            return null;
          })()}
          {placementMode === 'row' && previewSeats.length > 0 && previewSeats.map((seat, index) => (
            <div
              key={`preview-${index}`}
              className="absolute pointer-events-none"
              style={{
                left: `${seat.x * scale}px`,
                top: `${seat.y * scale}px`,
                width: `${1.67 * scale}px`,
                height: `${1.67 * scale}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-full h-full rounded-full border-2 border-emerald-500 bg-emerald-100 opacity-60 flex items-center justify-center pointer-events-none">
                <Armchair className="w-1/2 h-1/2 text-emerald-700 pointer-events-none" />
              </div>
              {index === 0 && previewSeats.length > 1 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded pointer-events-none">
                  {previewSeats.length}
                </div>
              )}
            </div>
          ))}
          {placementMode !== 'none' && cursorPosition && !rowAnchor && previewSeats.length === 0 && (
            <>
              {placementMode === 'row' && rowChairCount ? (
                Array.from({ length: rowChairCount }).map((_, index) => {
                  const chairSize = 1.67;
                  const offsetX = (index - (rowChairCount - 1) / 2) * chairSize;
                  return (
                    <div
                      key={`fixed-preview-${index}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(cursorPosition.x + offsetX) * scale}px`,
                        top: `${cursorPosition.y * scale}px`,
                        width: `${chairSize * scale}px`,
                        height: `${chairSize * scale}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="w-full h-full rounded-full border-2 border-emerald-500 bg-emerald-100 opacity-60 flex items-center justify-center pointer-events-none">
                        <Armchair className="w-1/2 h-1/2 text-emerald-700 pointer-events-none" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${cursorPosition.x * scale}px`,
                    top: `${cursorPosition.y * scale}px`,
                    width: `${1.67 * scale}px`,
                    height: `${1.67 * scale}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className={`w-full h-full rounded-full border-2 opacity-60 flex items-center justify-center pointer-events-none ${
                    placementMode === 'row' ? 'border-emerald-500 bg-emerald-100' : 'border-sky-500 bg-sky-100'
                  }`}>
                    <Armchair className={`w-1/2 h-1/2 pointer-events-none ${
                      placementMode === 'row' ? 'text-emerald-700' : 'text-sky-700'
                    }`} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

