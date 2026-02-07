import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Save, Download, Trash2, Armchair } from 'lucide-react';
import FurnitureItem from './FurnitureItem';
import GroupSelectionOverlay from './GroupSelectionOverlay';
import ViewportNavigator from './ViewportNavigator';
import type { FurnitureItem as FurnitureItemType, FurnitureTemplate } from '../types/furniture';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatLabel } from '../lib/labelFormat';
import { computeRowSeatPositions } from '../lib/arcGeometry';

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

const norm180Axis = (deg: number) => {
  let a = norm360(deg);
  if (a > 180) a -= 180;
  return a;
};

const closestEquivalentToTarget = (snappedAxis: number, targetDeg: number) => {
  const t = norm360(targetDeg);
  const cand1 = norm360(snappedAxis);
  const cand2 = norm360(snappedAxis + 180);
  const dist = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, 360 - d);
  };
  return dist(cand1, t) <= dist(cand2, t) ? cand1 : cand2;
};

const snapAxisToGrid = (targetDeg: number, threshold = 3) => {
  const axis = norm180Axis(targetDeg);
  const snaps = [0, 45, 90, 135, 180];
  let best = axis;
  let bestDist = Infinity;
  for (const s of snaps) {
    const d = Math.abs(axis - s);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  const snappedAxis = bestDist <= threshold ? best : axis;
  const snappedAbs = closestEquivalentToTarget(snappedAxis, targetDeg);
  return { snappedAbs, snappedAxis, isSnapped: bestDist <= threshold };
};

interface GridCanvasProps {
  width: number;
  height: number;
  refreshKey?: number;
  floorPlanId: string;
  draggedTemplate: FurnitureTemplate | null;
  onTemplatePlaced: () => void;
  placementMode: 'none' | 'single' | 'row' | 'custom-row' | 'multi-row' | 'marquee';
  rowChairCount: number | null;
  onDeactivatePlacementMode: () => void;
  onSelectionChange?: (selectedItem: FurnitureItemType | null, groupItems: FurnitureItemType[], selectedId: string | null, selectedIndividualId: string | null) => void;
  onMultiSelectionChange?: (rowItems: FurnitureItemType[], allItems: FurnitureItemType[]) => void;
  selectedId: string | null;
  selectedIndividualId: string | null;
  onClearSelection: () => void;
}

export default function GridCanvas({
  width,
  height,
  refreshKey,
  floorPlanId,
  draggedTemplate,
  onTemplatePlaced,
  placementMode,
  rowChairCount,
  onDeactivatePlacementMode,
  onSelectionChange,
  onMultiSelectionChange,
  selectedId: externalSelectedId,
  selectedIndividualId: externalSelectedIndividualId,
  onClearSelection
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [furniture, setFurniture] = useState<FurnitureItemType[]>([]);
  const [localIdCounter, setLocalIdCounter] = useState(1);
  const [draggedItem, setDraggedItem] = useState<FurnitureItemType | null>(null);
  const [scale, setScale] = useState(50);

  // Camera state
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartScreen = useRef<{ x: number; y: number } | null>(null);
  const lastPanScreen = useRef<{ x: number; y: number } | null>(null);
  const panMoved = useRef(false);
  const PAN_THRESHOLD = 5;

  // Use external selection state from parent
  const selectedId = externalSelectedId;
  const selectedIndividualId = externalSelectedIndividualId;
  const [isSaving, setIsSaving] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [customRowStart, setCustomRowStart] = useState<{ x: number; y: number } | null>(null);
  const [customRowChairCount, setCustomRowChairCount] = useState<number>(1);
  const [multiRowStart, setMultiRowStart] = useState<{ x: number; y: number } | null>(null);
  const [multiRowEnd, setMultiRowEnd] = useState<{ x: number; y: number } | null>(null);
  const [multiRowCount, setMultiRowCount] = useState<number>(1);
  const [isRotatingGroup, setIsRotatingGroup] = useState(false);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const initialTableCenter = useRef<{ x: number; y: number } | null>(null);
  const dragStartCursor = useRef<{ x: number; y: number } | null>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const mouseMoved = useRef(false);
  const lastMouseUpWasClick = useRef(false);
  const isEndingDrag = useRef(false);
  const selectedIndividualIdRef = useRef<string | null>(null);
  const CLICK_TOLERANCE_PX = 3;

  const marqueeStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const isMarqueeRef = useRef(false);
  const marqueeRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeViewStateRef = useRef({ scale: 50, cameraX: 0, cameraY: 0 });
  const [marqueeRect, setMarqueeRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isMarqueeDragging, setIsMarqueeDragging] = useState(false);
  const marqueeSelectionModeRef = useRef<'individual' | 'row-expand'>('individual');
  const furnitureRef = useRef(furniture);

  const [isMultiRotating, setIsMultiRotating] = useState(false);
  const [multiRotationDelta, setMultiRotationDelta] = useState(0);
  const [multiRotationInitial, setMultiRotationInitial] = useState(0);
  const multiRotationCleanupRef = useRef<(() => void) | null>(null);
  const multiRotationBaseRef = useRef<{
    pivot: { x: number; y: number };
    items: Array<{
      id: string;
      localX: number;
      localY: number;
      width: number;
      height: number;
    }>;
  } | null>(null);

  const [multiExtendSide, setMultiExtendSide] = useState<'left' | 'right' | null>(null);
  const multiExtendStartRef = useRef<{ x: number; y: number } | null>(null);
  const multiExtendCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const multiExtendCleanupRef = useRef<(() => void) | null>(null);
  const [, setMultiExtendTick] = useState(0);

  const gridSize = 0.5;
  const pixelGridSize = gridSize * scale;
  const MIN_SCALE = 4;
  const MAX_SCALE = 100;
  const ZOOM_STEP = 6;

  const fitToViewport = () => {
    if (!viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const margin = 40;
    const scaleX = (vw - margin) / width;
    const scaleY = (vh - margin) / height;
    const nextScale = Math.min(scaleX, scaleY);
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    setScale(clamped);
    setCameraX((vw - width * clamped) / 2);
    setCameraY((vh - height * clamped) / 2);
  };

  const handleNavigatorPan = useCallback((dx: number, dy: number) => {
    setCameraX(prev => prev + dx);
    setCameraY(prev => prev + dy);
  }, []);

  const handleNavigatorZoomIn = useCallback(() => {
    setScale(prev => Math.min(MAX_SCALE, prev + ZOOM_STEP));
  }, []);

  const handleNavigatorZoomOut = useCallback(() => {
    setScale(prev => Math.max(MIN_SCALE, prev - ZOOM_STEP));
  }, []);

  // Coordinate conversion utilities
  const screenToWorld = (screenX: number, screenY: number): { x: number; y: number } => {
    return {
      x: (screenX - cameraX) / scale,
      y: (screenY - cameraY) / scale
    };
  };

  const worldToScreen = (worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * scale + cameraX,
      y: worldY * scale + cameraY
    };
  };

  const generateLocalId = () => {
    const id = `local-${localIdCounter}`;
    setLocalIdCounter(prev => prev + 1);
    return id;
  };

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
    if (refreshKey !== undefined && refreshKey > 0) {
      loadFurniture();
    }
  }, [refreshKey]);

  useEffect(() => {
    fitToViewport();
  }, [width, height]);

  // Initialize camera on mount before paint
  useLayoutEffect(() => {
    if (viewportRef.current) {
      fitToViewport();
    }
  }, []);

  useEffect(() => {
    const handleResize = () => fitToViewport();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  useEffect(() => {
    if (!draggedItem) return;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      updateDragFromClient(e.clientX, e.clientY);
    };

    const onUp = async () => {
      if (!draggedItem || isEndingDrag.current) return;

      isEndingDrag.current = true;

      const itemsToUpdate = draggedItem.group_id
        ? furniture.filter((f) => f.group_id === draggedItem.group_id)
        : furniture.filter((f) => f.id === draggedItem.id);

      if (isSupabaseConfigured) {
        for (const item of itemsToUpdate) {
          await supabase
            .from('furniture_items')
            .update({ x: item.x, y: item.y })
            .eq('id', item.id);
        }
      }

      dragStartPositions.current.clear();
      initialTableCenter.current = null;
      dragStartCursor.current = null;
      setDraggedItem(null);
      mouseDownPos.current = null;
      mouseMoved.current = false;
      isEndingDrag.current = false;
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggedItem, furniture, scale, width, height]);

  useEffect(() => {
    if (placementMode === 'none') {
      setCursorPosition(null);
      setCustomRowStart(null);
      setCustomRowChairCount(1);
      setMultiRowStart(null);
      setMultiRowEnd(null);
      setMultiRowCount(1);
    } else if (placementMode !== 'custom-row') {
      setCustomRowStart(null);
      setCustomRowChairCount(1);
    }
    if (placementMode !== 'multi-row') {
      setMultiRowStart(null);
      setMultiRowEnd(null);
      setMultiRowCount(1);
    }
  }, [placementMode]);

  useEffect(() => {
    if (!onSelectionChange) return;
    if (selectedItemIds.length > 0) return;

    const activeSelectionId = selectedIndividualId || selectedId;

    if (activeSelectionId) {
      const selectedItem = furniture.find(f => f.id === activeSelectionId);

      if (selectedItem) {
        if (selectedItem.group_id) {
          const groupItems = furniture.filter(f => f.group_id === selectedItem.group_id);
          const rowOrTable = groupItems.find(f => f.type === 'row' || f.type === 'table');
          if (rowOrTable) {
            onSelectionChange(rowOrTable, groupItems, selectedId, selectedIndividualId);
            return;
          }
        }

        if (selectedItem.type === 'table') {
          onSelectionChange(selectedItem, [selectedItem], selectedId, selectedIndividualId);
          return;
        }

        onSelectionChange(null, [], selectedId, selectedIndividualId);
      } else {
        onSelectionChange(null, [], selectedId, selectedIndividualId);
      }
    } else {
      onSelectionChange(null, [], null, null);
    }
  }, [selectedIndividualId, selectedId, furniture, onSelectionChange, selectedItemIds.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spacePressed) {
        setSpacePressed(true);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemIds.length > 0) {
          e.preventDefault();
          handleDeleteMultiSelection();
        } else if (selectedId) {
          e.preventDefault();
          handleDelete(selectedId);
        } else if (selectedIndividualId) {
          e.preventDefault();
          handleDelete(selectedIndividualId);
        }
      }
      if (e.key === 'Escape' && placementMode !== 'none') {
        e.preventDefault();
        onDeactivatePlacementMode();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpacePressed(false);
        if (isPanning) {
          setIsPanning(false);
          panStartScreen.current = null;
          lastPanScreen.current = null;
          panMoved.current = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, selectedItemIds, placementMode, spacePressed, isPanning]);

  // Global mouse capture for panning
  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!lastPanScreen.current) return;

      const deltaX = e.clientX - lastPanScreen.current.x;
      const deltaY = e.clientY - lastPanScreen.current.y;

      setCameraX(prev => prev + deltaX);
      setCameraY(prev => prev + deltaY);

      lastPanScreen.current = { x: e.clientX, y: e.clientY };

      if (panStartScreen.current) {
        const totalDx = e.clientX - panStartScreen.current.x;
        const totalDy = e.clientY - panStartScreen.current.y;
        if (Math.abs(totalDx) > PAN_THRESHOLD || Math.abs(totalDy) > PAN_THRESHOLD) {
          panMoved.current = true;
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      panStartScreen.current = null;
      lastPanScreen.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  useEffect(() => { furnitureRef.current = furniture; }, [furniture]);

  useEffect(() => {
    if (!isMarqueeDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!viewportRef.current || !marqueeStartScreenRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (!isMarqueeRef.current) {
        const dx = screenX - marqueeStartScreenRef.current.x;
        const dy = screenY - marqueeStartScreenRef.current.y;
        if (Math.abs(dx) > CLICK_TOLERANCE_PX || Math.abs(dy) > CLICK_TOLERANCE_PX) {
          isMarqueeRef.current = true;
        }
      }

      if (isMarqueeRef.current) {
        const newRect = {
          x1: marqueeStartScreenRef.current.x,
          y1: marqueeStartScreenRef.current.y,
          x2: screenX,
          y2: screenY,
        };
        marqueeRectRef.current = newRect;
        setMarqueeRect(newRect);
      }
    };

    const handleGlobalMouseUp = () => {
      if (!marqueeStartScreenRef.current) return;

      if (isMarqueeRef.current && marqueeRectRef.current) {
        const mr = marqueeRectRef.current;
        const vs = marqueeViewStateRef.current;

        const worldX1 = (mr.x1 - vs.cameraX) / vs.scale;
        const worldY1 = (mr.y1 - vs.cameraY) / vs.scale;
        const worldX2 = (mr.x2 - vs.cameraX) / vs.scale;
        const worldY2 = (mr.y2 - vs.cameraY) / vs.scale;

        const minX = Math.min(worldX1, worldX2);
        const maxX = Math.max(worldX1, worldX2);
        const minY = Math.min(worldY1, worldY2);
        const maxY = Math.max(worldY1, worldY2);

        const items = furnitureRef.current;
        const hitIds: string[] = [];

        items.forEach(item => {
          if (item.type === 'row') return;
          const right = item.x + item.width;
          const bottom = item.y + item.height;
          if (item.x < maxX && right > minX && item.y < maxY && bottom > minY) {
            hitIds.push(item.id);
          }
        });

        if (hitIds.length > 0) {
          onClearSelection();
          if (marqueeSelectionModeRef.current === 'row-expand') {
            const hitItems = items.filter(i => hitIds.includes(i.id));
            const groupIds = new Set<string>();
            hitItems.forEach(i => { if (i.group_id) groupIds.add(i.group_id); });
            const expandedItems = items.filter(i => (hitIds.includes(i.id) || (i.group_id && groupIds.has(i.group_id))) && i.type !== 'row');
            const expandedIds = expandedItems.map(i => i.id);
            setSelectedItemIds(expandedIds);
            const rowItems = items.filter(i => i.type === 'row' && i.group_id && groupIds.has(i.group_id));
            if (rowItems.length > 0 && onMultiSelectionChange) {
              onMultiSelectionChange(rowItems, expandedItems);
            }
          } else {
            setSelectedItemIds(hitIds);
            const hitItems = items.filter(i => hitIds.includes(i.id));
            const groupIds = new Set<string>();
            hitItems.forEach(i => { if (i.group_id) groupIds.add(i.group_id); });
            const rowItems = items.filter(i => i.type === 'row' && i.group_id && groupIds.has(i.group_id));
            if (rowItems.length > 0 && onMultiSelectionChange) {
              const allGroupItems = items.filter(i => i.type !== 'row' && i.group_id && groupIds.has(i.group_id));
              onMultiSelectionChange(rowItems, allGroupItems);
            }
          }
        } else {
          setSelectedItemIds([]);
          onClearSelection();
        }
      } else {
        onClearSelection();
        setSelectedItemIds([]);
      }

      marqueeStartScreenRef.current = null;
      isMarqueeRef.current = false;
      marqueeRectRef.current = null;
      setMarqueeRect(null);
      setIsMarqueeDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove, true);
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
    };
  }, [isMarqueeDragging]);

  const loadFurniture = async () => {
    if (!isSupabaseConfigured) {
      setFurniture([]);
      return;
    }

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

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!viewportRef.current || !draggedTemplate) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const x = snapToGrid(worldPos.x);
    const y = snapToGrid(worldPos.y);

    const newFurniture: FurnitureItemType[] = [];

    if (draggedTemplate.type === 'row') {
      const chairSize = 1.67;
      const numChairs = draggedTemplate.chairs || 3;
      const groupId = crypto.randomUUID();

      // Create the row item first
      const rowItem = {
        floor_plan_id: floorPlanId,
        type: 'row' as const,
        x: Math.max(0, Math.min(x - chairSize / 2, width - chairSize)),
        y: Math.max(0, Math.min(y - chairSize / 2, height - chairSize)),
        width: chairSize * numChairs,
        height: chairSize,
        rotation: 0,
        group_id: groupId,
      };

      if (isSupabaseConfigured) {
        const { data: rowData, error: rowError } = await supabase
          .from('furniture_items')
          .insert(rowItem)
          .select()
          .single();

        if (rowError) {
          console.error('Error adding row item:', rowError);
          return;
        }

        if (rowData) {
          newFurniture.push(rowData as FurnitureItemType);
        }
      } else {
        newFurniture.push({ ...rowItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType);
      }

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
          group_id: groupId,
        });
      }

      if (isSupabaseConfigured) {
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
        newFurniture.push(...chairItems.map(item => ({ ...item, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType)));
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

      let itemData: FurnitureItemType;

      if (isSupabaseConfigured) {
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
          itemData = data as FurnitureItemType;
          newFurniture.push(itemData);
        } else {
          return;
        }
      } else {
        itemData = { ...newItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
        newFurniture.push(itemData);
      }

      if (isCircularTable) {
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

        if (isSupabaseConfigured) {
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
        } else {
          newFurniture.push(...chairItems.map(item => ({ ...item, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType)));
        }
      }
    }

    setFurniture((prev) => [...prev, ...newFurniture]);
    onTemplatePlaced();
  };

  const updateDragFromClient = (clientX: number, clientY: number) => {
    if (!viewportRef.current) return;
    if (!draggedItem) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const worldPos = screenToWorld(clientX - rect.left, clientY - rect.top);
    const cursorX = snapToGrid(worldPos.x);
    const cursorY = snapToGrid(worldPos.y);

    if (!dragStartCursor.current) return;

    const deltaX = cursorX - dragStartCursor.current.x;
    const deltaY = cursorY - dragStartCursor.current.y;

    setFurniture((prevFurniture) =>
      prevFurniture.map((item) => {
        const itemStartPos = dragStartPositions.current.get(item.id);
        if (!itemStartPos) return item;

        return {
          ...item,
          x: Math.max(0, Math.min(itemStartPos.x + deltaX, width - item.width)),
          y: Math.max(0, Math.min(itemStartPos.y + deltaY, height - item.height)),
        };
      })
    );
  };

  const handleDragStart = (item: FurnitureItemType, clientX: number, clientY: number) => {
    if (!viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const worldPos = screenToWorld(clientX - rect.left, clientY - rect.top);
    const cursorX = snapToGrid(worldPos.x);
    const cursorY = snapToGrid(worldPos.y);

    dragStartPositions.current.clear();
    initialTableCenter.current = null;
    dragStartCursor.current = null;
    isEndingDrag.current = false;

    dragStartCursor.current = { x: cursorX, y: cursorY };

    const isItemMultiSelected = selectedItemIds.length > 0 && selectedItemIds.includes(item.id);

    if (isItemMultiSelected) {
      const selectedSet = new Set(selectedItemIds);
      const groupIds = new Set<string>();
      furniture.forEach(f => {
        if (selectedSet.has(f.id) && f.group_id) {
          groupIds.add(f.group_id);
        }
      });

      furniture.forEach(f => {
        if (selectedSet.has(f.id) || (f.group_id && groupIds.has(f.group_id))) {
          dragStartPositions.current.set(f.id, { x: f.x, y: f.y });
        }
      });
    } else if (selectedIndividualIdRef.current === item.id) {
      dragStartPositions.current.set(item.id, { x: item.x, y: item.y });
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      initialTableCenter.current = { x: centerX, y: centerY };
    } else if (item.group_id) {
      const groupItems = furniture.filter((f) => f.group_id === item.group_id);
      groupItems.forEach((groupItem) => {
        dragStartPositions.current.set(groupItem.id, { x: groupItem.x, y: groupItem.y });
      });

      const table = groupItems.find((f) => f.type === 'table');
      if (table) {
        const centerX = table.x + table.width / 2;
        const centerY = table.y + table.height / 2;
        initialTableCenter.current = { x: centerX, y: centerY };
      } else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        groupItems.forEach((groupItem) => {
          minX = Math.min(minX, groupItem.x);
          minY = Math.min(minY, groupItem.y);
          maxX = Math.max(maxX, groupItem.x + groupItem.width);
          maxY = Math.max(maxY, groupItem.y + groupItem.height);
        });
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        initialTableCenter.current = { x: centerX, y: centerY };
      }
    } else {
      dragStartPositions.current.set(item.id, { x: item.x, y: item.y });
    }

    setDraggedItem(item);
  };

  const handleDragEnd = async () => {
    if (!draggedItem || isEndingDrag.current) return;

    isEndingDrag.current = true;

    const draggedIds = new Set(dragStartPositions.current.keys());
    const itemsToUpdate = furniture.filter(f => draggedIds.has(f.id));

    setDraggedItem(null);
    dragStartPositions.current.clear();
    initialTableCenter.current = null;
    dragStartCursor.current = null;

    if (isSupabaseConfigured) {
      for (const item of itemsToUpdate) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y })
          .eq('id', item.id);
      }
    }

    isEndingDrag.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Panning is handled by global listeners, skip here
    if (isPanning) {
      return;
    }

    if (isMarqueeDragging) {
      return;
    }

    // If we're not pressing the mouse button but draggedItem is set, clear it
    if (draggedItem && e.buttons === 0) {
      handleDragEnd();
      return;
    }

    if (mouseDownPos.current) {
      const dx = screenX - mouseDownPos.current.x;
      const dy = screenY - mouseDownPos.current.y;
      if (Math.abs(dx) > CLICK_TOLERANCE_PX || Math.abs(dy) > CLICK_TOLERANCE_PX) {
        mouseMoved.current = true;
      }
    }

    const worldPos = screenToWorld(screenX, screenY);
    const cursorX = snapToGrid(worldPos.x);
    const cursorY = snapToGrid(worldPos.y);

    if (placementMode !== 'none') {
      setCursorPosition({ x: cursorX, y: cursorY });

      // Calculate dynamic chair count for custom row
      if (placementMode === 'custom-row' && customRowStart) {
        const chairSize = 1.67;
        const dx = cursorX - customRowStart.x;
        const dy = cursorY - customRowStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const count = Math.max(1, Math.round(distance / chairSize) + 1);
        setCustomRowChairCount(count);
      }

      // Calculate multi-row count based on perpendicular distance
      if (placementMode === 'multi-row' && multiRowStart && multiRowEnd) {
        const chairSize = 1.67;
        const rowSpacing = 2.5; // Space between rows

        // Calculate the perpendicular distance from cursor to the row
        const rowDx = multiRowEnd.x - multiRowStart.x;
        const rowDy = multiRowEnd.y - multiRowStart.y;
        const rowLength = Math.sqrt(rowDx * rowDx + rowDy * rowDy);

        if (rowLength > 0) {
          // Perpendicular vector to the row
          const perpX = -rowDy / rowLength;
          const perpY = rowDx / rowLength;

          // Distance from cursor to the first row line
          const cursorToCenterDx = cursorX - multiRowStart.x;
          const cursorToCenterDy = cursorY - multiRowStart.y;
          const perpDistance = Math.abs(cursorToCenterDx * perpX + cursorToCenterDy * perpY);

          // Calculate number of rows based on perpendicular distance
          const rowCount = Math.max(1, Math.round(perpDistance / rowSpacing) + 1);
          setMultiRowCount(rowCount);
        }
      }
    } else {
      setCursorPosition(null);
    }

    if (draggedItem) {
      updateDragFromClient(e.clientX, e.clientY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Check if clicking on empty canvas (not a furniture item)
    const target = e.target as HTMLElement;
    const isFurnitureItem = target.closest('[data-furniture-item]');
    const isCanvasClick = target.hasAttribute('data-canvas') || target.closest('[data-canvas]');

    if (spacePressed) {
      setIsPanning(true);
      panStartScreen.current = { x: e.clientX, y: e.clientY };
      lastPanScreen.current = { x: e.clientX, y: e.clientY };
      panMoved.current = false;
      e.preventDefault();
      return;
    }

    if (!isFurnitureItem && isCanvasClick && (placementMode === 'marquee' || placementMode === 'none')) {
      marqueeStartScreenRef.current = { x: screenX, y: screenY };
      isMarqueeRef.current = false;
      marqueeRectRef.current = null;
      marqueeViewStateRef.current = { scale, cameraX, cameraY };
      marqueeSelectionModeRef.current = placementMode === 'none' ? 'row-expand' : 'individual';
      lastMouseUpWasClick.current = false;
      setIsMarqueeDragging(true);
      e.preventDefault();
      return;
    }

    mouseDownPos.current = { x: screenX, y: screenY };
    mouseMoved.current = false;
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    // End panning
    if (isPanning) {
      // If we didn't move much, treat it as a click for selection clearing
      if (!panMoved.current && placementMode === 'none') {
        const target = e.target as HTMLElement;
        const isFurnitureItem = target.closest('[data-furniture-item]');
        if (!isFurnitureItem) {
          onClearSelection();
        }
      }
      setIsPanning(false);
      panStartScreen.current = null;
      lastPanScreen.current = null;
      panMoved.current = false;
      return;
    }

    // Only set lastMouseUpWasClick if we actually tracked a mouseDown on the canvas
    // (furniture items stop propagation, so mouseDownPos would be null)
    if (mouseDownPos.current) {
      lastMouseUpWasClick.current = !mouseMoved.current;
    }

    if (draggedItem) {
      await handleDragEnd();
    }

    mouseDownPos.current = null;
    mouseMoved.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    if (!spacePressed) {
      return;
    }

    e.preventDefault();

    // Update camera position
    setCameraX(prev => prev - e.deltaX);
    setCameraY(prev => prev - e.deltaY);
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = furniture.find((item) => item.id === id);
    if (!itemToDelete) return;

    // If individual selection is active, delete only that item
    if (selectedIndividualId === id) {
      if (isSupabaseConfigured) {
        await supabase.from('furniture_items').delete().eq('id', id);
      }
      setFurniture(furniture.filter((item) => item.id !== id));
    } else if (itemToDelete.group_id) {
      // Otherwise, delete the entire group
      if (isSupabaseConfigured) {
        await supabase
          .from('furniture_items')
          .delete()
          .eq('group_id', itemToDelete.group_id);
      }
      setFurniture(furniture.filter((item) => item.group_id !== itemToDelete.group_id));
    } else {
      if (isSupabaseConfigured) {
        await supabase.from('furniture_items').delete().eq('id', id);
      }
      setFurniture(furniture.filter((item) => item.id !== id));
    }

    onClearSelection();
  };

  const handleDeleteMultiSelection = async () => {
    if (selectedItemIds.length === 0) return;

    if (isSupabaseConfigured) {
      await supabase.from('furniture_items').delete().in('id', selectedItemIds);
    }

    const idSet = new Set(selectedItemIds);
    setFurniture(prev => prev.filter(item => !idSet.has(item.id)));
    setSelectedItemIds([]);
    onClearSelection();
  };

  const handleSingleClick = (id: string) => {
    setSelectedItemIds([]);
    selectedIndividualIdRef.current = null;
    if (onSelectionChange) {
      const selectedItem = furniture.find(f => f.id === id);
      if (selectedItem) {
        if (selectedItem.group_id) {
          const groupItems = furniture.filter(f => f.group_id === selectedItem.group_id);
          const rowOrTable = groupItems.find(f => f.type === 'row' || f.type === 'table');
          if (rowOrTable) {
            onSelectionChange(rowOrTable, groupItems, id, null);
            return;
          }
        }
        if (selectedItem.type === 'table') {
          onSelectionChange(selectedItem, [selectedItem], id, null);
          return;
        }
      }
      onSelectionChange(null, [], id, null);
    }
  };

  const handleDoubleClick = (id: string) => {
    setSelectedItemIds([]);
    selectedIndividualIdRef.current = id;
    if (onSelectionChange) {
      const selectedItem = furniture.find(f => f.id === id);
      if (selectedItem) {
        if (selectedItem.group_id) {
          const groupItems = furniture.filter(f => f.group_id === selectedItem.group_id);
          const rowOrTable = groupItems.find(f => f.type === 'row' || f.type === 'table');
          if (rowOrTable) {
            onSelectionChange(rowOrTable, groupItems, null, id);
            return;
          }
        }
        if (selectedItem.type === 'table') {
          onSelectionChange(selectedItem, [selectedItem], null, id);
          return;
        }
      }
      onSelectionChange(null, [], null, id);
    }
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

      // Use stored rotation angle from the first chair (preserves the creation angle)
      const storedRotation = groupItems[0].rotation || 0;
      const rowAngleRad = (storedRotation * Math.PI) / 180;

      // row-aligned frame = unrotate by stored angle
      const cosBase = Math.cos(-rowAngleRad);
      const sinBase = Math.sin(-rowAngleRad);

      rotationBaseRef.current = {
        groupId,
        center: { x: centerX, y: centerY },
        baseAngle: storedRotation,
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
        x: newX,
        y: newY,
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
    if (isSupabaseConfigured) {
      for (const item of groupItems) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y, rotation: item.rotation })
          .eq('id', item.id);
      }
    }

    // Clear rotation base
    rotationBaseRef.current = null;
  };

  const handleMultiRotatePreview = (groupIds: string[], targetRotation: number) => {
    if (!multiRotationBaseRef.current) {
      const groupIdSet = new Set(groupIds);
      const allItems = furniture.filter(item => groupIdSet.has(item.group_id || ''));
      if (allItems.length === 0) return;

      const baseRotation = allItems[0].rotation || 0;
      const baseRad = (baseRotation * Math.PI) / 180;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      allItems.forEach(item => {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
      });
      const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

      const cosUn = Math.cos(-baseRad);
      const sinUn = Math.sin(-baseRad);

      multiRotationBaseRef.current = {
        pivot,
        items: allItems.map(item => {
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          const dx = cx - pivot.x;
          const dy = cy - pivot.y;
          return {
            id: item.id,
            localX: dx * cosUn - dy * sinUn,
            localY: dx * sinUn + dy * cosUn,
            width: item.width,
            height: item.height,
          };
        }),
      };
    }

    const base = multiRotationBaseRef.current;
    if (!base) return;

    const angleRad = (targetRotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const itemMap = new Map(base.items.map(i => [i.id, i]));

    setFurniture(prev => prev.map(item => {
      const orig = itemMap.get(item.id);
      if (!orig) return item;
      const rx = orig.localX * cosA - orig.localY * sinA;
      const ry = orig.localX * sinA + orig.localY * cosA;
      return {
        ...item,
        x: base.pivot.x + rx - orig.width / 2,
        y: base.pivot.y + ry - orig.height / 2,
        rotation: targetRotation,
      };
    }));
  };

  const handleMultiRotateCommit = async (groupIds: string[]) => {
    if (isSupabaseConfigured) {
      const groupIdSet = new Set(groupIds);
      const affectedItems = furniture.filter(item => groupIdSet.has(item.group_id || ''));
      for (const item of affectedItems) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y, rotation: item.rotation })
          .eq('id', item.id);
      }
    }
    multiRotationBaseRef.current = null;
  };

  const handleMultiRotationPointerDown = (e: React.PointerEvent, centerScreenX: number, centerScreenY: number) => {
    e.stopPropagation();
    e.preventDefault();
    multiRotationCleanupRef.current?.();

    const handleEl = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    try { handleEl.setPointerCapture(pointerId); } catch (_) { /* noop */ }

    const initialMouseAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

    const selectedIds = [...selectedItemIds];
    const currentFurniture = furnitureRef.current;
    const selectedItems = currentFurniture.filter(f => selectedIds.includes(f.id));
    const selGroupIds = new Set(selectedItems.map(f => f.group_id).filter(Boolean));
    const rowItems = currentFurniture.filter(f => f.type === 'row' && selGroupIds.has(f.group_id || ''));
    const groupIds = [...new Set(rowItems.map(r => r.group_id).filter(Boolean))] as string[];
    const storedRotation = norm360(rowItems[0]?.rotation || 0);

    setMultiRotationInitial(storedRotation);
    setMultiRotationDelta(0);
    setIsMultiRotating(true);
    setIsRotatingGroup(true);

    let currentDelta = 0;
    let ended = false;

    const onMove = (ev: PointerEvent) => {
      const currentMouseAngle = Math.atan2(ev.clientY - centerScreenY, ev.clientX - centerScreenX) * (180 / Math.PI);
      const mouseDelta = currentMouseAngle - initialMouseAngle;
      let targetRotation = storedRotation + mouseDelta;
      targetRotation = norm360(targetRotation);

      const { snappedAbs } = snapAxisToGrid(targetRotation, 3);
      const signedDelta = (() => {
        const a = norm360(snappedAbs);
        const b = norm360(storedRotation);
        let d = a - b;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d;
      })();

      currentDelta = signedDelta;
      setMultiRotationDelta(signedDelta);

      handleMultiRotatePreview(groupIds, norm360(storedRotation + signedDelta));
    };

    const detachAll = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endRotation);
      window.removeEventListener('pointercancel', endRotation);
      window.removeEventListener('blur', endRotation);
      multiRotationCleanupRef.current = null;
      try { handleEl.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
    };

    const endRotation = () => {
      if (ended) return;
      ended = true;
      detachAll();

      handleMultiRotateCommit(groupIds);

      setIsMultiRotating(false);
      setMultiRotationDelta(0);
      setMultiRotationInitial(0);
      setIsRotatingGroup(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endRotation);
    window.addEventListener('pointercancel', endRotation);
    window.addEventListener('blur', endRotation);
    multiRotationCleanupRef.current = detachAll;
  };

  const handleExtendRow = async (groupId: string, side: 'left' | 'right', count: number) => {
    const groupItems = furniture.filter((item) => item.group_id === groupId);
    if (groupItems.length === 0) return;

    // Get the row's rotation from the first chair
    const rowRotation = groupItems[0].rotation || 0;

    let maxDist = 0;
    let endpointA = groupItems[0];
    let endpointB = groupItems[groupItems.length - 1];

    for (let i = 0; i < groupItems.length; i++) {
      for (let j = i + 1; j < groupItems.length; j++) {
        const ai = groupItems[i];
        const aj = groupItems[j];
        const d = Math.sqrt(
          Math.pow((aj.x + aj.width / 2) - (ai.x + ai.width / 2), 2) +
          Math.pow((aj.y + aj.height / 2) - (ai.y + ai.height / 2), 2)
        );
        if (d > maxDist) {
          maxDist = d;
          endpointA = ai;
          endpointB = aj;
        }
      }
    }

    const aCx = endpointA.x + endpointA.width / 2;
    const aCy = endpointA.y + endpointA.height / 2;
    const bCx = endpointB.x + endpointB.width / 2;
    const bCy = endpointB.y + endpointB.height / 2;
    const firstChair = (aCx < bCx || (aCx === bCx && aCy < bCy)) ? endpointA : endpointB;
    const lastChair = firstChair === endpointA ? endpointB : endpointA;

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
          x: newX,
          y: newY,
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
          x: newX,
          y: newY,
          width: chairSize,
          height: chairSize,
          rotation: rowRotation,
          group_id: groupId,
        });
      }
    }

    if (isSupabaseConfigured) {
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
    } else {
      const newItems = newChairs.map(item => ({ ...item, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType));
      setFurniture((prev) => [...prev, ...newItems]);
    }
  };

  const handleExtendMultiRows = async (side: 'left' | 'right', count: number) => {
    const selected = furniture.filter(f => selectedItemIds.includes(f.id));
    const groupIds = new Set<string>();
    selected.forEach(i => { if (i.group_id) groupIds.add(i.group_id); });

    const chairSize = 1.67;
    const allNewChairs: Array<{
      floor_plan_id: string;
      type: 'chair';
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      group_id: string;
    }> = [];

    for (const groupId of groupIds) {
      const groupItems = furniture.filter(i => i.group_id === groupId);
      if (groupItems.length === 0) continue;

      const rowRotation = groupItems[0].rotation || 0;

      let maxDist = 0;
      let endpointA = groupItems[0];
      let endpointB = groupItems[groupItems.length - 1];

      for (let i = 0; i < groupItems.length; i++) {
        for (let j = i + 1; j < groupItems.length; j++) {
          const ai = groupItems[i];
          const aj = groupItems[j];
          const d = Math.sqrt(
            Math.pow((aj.x + aj.width / 2) - (ai.x + ai.width / 2), 2) +
            Math.pow((aj.y + aj.height / 2) - (ai.y + ai.height / 2), 2)
          );
          if (d > maxDist) { maxDist = d; endpointA = ai; endpointB = aj; }
        }
      }

      const aCx = endpointA.x + endpointA.width / 2;
      const aCy = endpointA.y + endpointA.height / 2;
      const bCx = endpointB.x + endpointB.width / 2;
      const bCy = endpointB.y + endpointB.height / 2;
      const firstChair = (aCx < bCx || (aCx === bCx && aCy < bCy)) ? endpointA : endpointB;
      const lastChair = firstChair === endpointA ? endpointB : endpointA;

      const firstCX = firstChair.x + firstChair.width / 2;
      const firstCY = firstChair.y + firstChair.height / 2;
      const lastCX = lastChair.x + lastChair.width / 2;
      const lastCY = lastChair.y + lastChair.height / 2;

      const dx = lastCX - firstCX;
      const dy = lastCY - firstCY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) continue;

      const dirX = dx / dist;
      const dirY = dy / dist;

      if (side === 'left') {
        for (let i = 1; i <= count; i++) {
          allNewChairs.push({
            floor_plan_id: floorPlanId,
            type: 'chair',
            x: firstCX - dirX * chairSize * i - chairSize / 2,
            y: firstCY - dirY * chairSize * i - chairSize / 2,
            width: chairSize,
            height: chairSize,
            rotation: rowRotation,
            group_id: groupId,
          });
        }
      } else {
        for (let i = 1; i <= count; i++) {
          allNewChairs.push({
            floor_plan_id: floorPlanId,
            type: 'chair',
            x: lastCX + dirX * chairSize * i - chairSize / 2,
            y: lastCY + dirY * chairSize * i - chairSize / 2,
            width: chairSize,
            height: chairSize,
            rotation: rowRotation,
            group_id: groupId,
          });
        }
      }
    }

    if (allNewChairs.length === 0) return;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('furniture_items')
        .insert(allNewChairs)
        .select();

      if (error) {
        console.error('Error extending multi rows:', error);
        return;
      }

      if (data) {
        const newItems = data as FurnitureItemType[];
        setFurniture(prev => [...prev, ...newItems]);
        setSelectedItemIds(prev => [...prev, ...newItems.map(d => d.id)]);
        if (onMultiSelectionChange) {
          const updatedFurniture = [...furniture, ...newItems];
          const updatedSelected = [...selected, ...newItems];
          const updatedGroupIds = new Set(groupIds);
          const rowItems = updatedFurniture.filter(i => i.type === 'row' && i.group_id && updatedGroupIds.has(i.group_id));
          const allItems = updatedSelected.filter(i => i.type !== 'row');
          onMultiSelectionChange(rowItems, allItems);
        }
      }
    } else {
      const newItems = allNewChairs.map(item => ({
        ...item,
        id: generateLocalId(),
        created_at: new Date().toISOString(),
      } as FurnitureItemType));
      setFurniture(prev => [...prev, ...newItems]);
      setSelectedItemIds(prev => [...prev, ...newItems.map(d => d.id)]);
    }
  };

  const handleMultiExtendMouseDown = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    multiExtendCleanupRef.current?.();

    multiExtendStartRef.current = { x: e.clientX, y: e.clientY };
    multiExtendCurrentRef.current = { x: e.clientX, y: e.clientY };
    setMultiExtendSide(side);

    const onMove = (ev: MouseEvent) => {
      if (!multiExtendStartRef.current) return;
      multiExtendCurrentRef.current = { x: ev.clientX, y: ev.clientY };
      setMultiExtendTick(t => t + 1);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      multiExtendCleanupRef.current = null;

      const start = multiExtendStartRef.current;
      const current = multiExtendCurrentRef.current;

      if (start && current) {
        const dx = (current.x - start.x) / scale;
        const dy = (current.y - start.y) / scale;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const chairSize = 1.67;

        if (distance >= chairSize * 0.0625) {
          const seatsToAdd = Math.floor(distance / chairSize + 0.9375);
          if (seatsToAdd > 0) {
            handleExtendMultiRows(side, seatsToAdd);
          }
        }
      }

      multiExtendStartRef.current = null;
      multiExtendCurrentRef.current = null;
      setMultiExtendSide(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    multiExtendCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  };

  const handlePlacementClick = async (e: React.MouseEvent) => {
    if (!viewportRef.current) return;

    const target = e.target as HTMLElement;
    const isFurnitureItem = target.closest('[data-furniture-item]');

    if (isFurnitureItem) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const x = snapToGrid(worldPos.x);
    const y = snapToGrid(worldPos.y);

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

      if (isSupabaseConfigured) {
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
      } else {
        const newItem = { ...newChair, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
        setFurniture((prev) => [...prev, newItem]);
      }
    } else if (placementMode === 'custom-row') {
      if (!customRowStart) {
        // First click: set start position
        setCustomRowStart({ x, y });
        setCustomRowChairCount(1);
      } else {
        // Second click: place the chairs
        const groupId = crypto.randomUUID();
        const dx = x - customRowStart.x;
        const dy = y - customRowStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
          // Create row item
          const rowItem = {
            floor_plan_id: floorPlanId,
            type: 'row' as const,
            x: Math.max(0, Math.min(customRowStart.x - chairSize / 2, width - chairSize)),
            y: Math.max(0, Math.min(customRowStart.y - chairSize / 2, height - chairSize)),
            width: chairSize,
            height: chairSize,
            rotation: 0,
            group_id: groupId,
          };

          if (isSupabaseConfigured) {
            const { data: rowData, error: rowError } = await supabase
              .from('furniture_items')
              .insert(rowItem)
              .select()
              .single();

            if (rowError) {
              console.error('Error placing row item:', rowError);
              return;
            }

            if (rowData) {
              setFurniture((prev) => [...prev, rowData as FurnitureItemType]);
            }
          } else {
            const newItem = { ...rowItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
            setFurniture((prev) => [...prev, newItem]);
          }

          // Place single chair if no distance
          const newChair = {
            floor_plan_id: floorPlanId,
            type: 'chair' as const,
            x: Math.max(0, Math.min(customRowStart.x - chairSize / 2, width - chairSize)),
            y: Math.max(0, Math.min(customRowStart.y - chairSize / 2, height - chairSize)),
            width: chairSize,
            height: chairSize,
            rotation: 0,
            group_id: groupId,
          };

          if (isSupabaseConfigured) {
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
          } else {
            const newItem = { ...newChair, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
            setFurniture((prev) => [...prev, newItem]);
          }
        } else {
          const dirX = dx / distance;
          const dirY = dy / distance;

          // Calculate the initial rotation angle based on the direction
          const initialRotation = Math.atan2(dy, dx) * (180 / Math.PI);

          // Create row item
          const rowLength = chairSize * customRowChairCount;
          const rowItem = {
            floor_plan_id: floorPlanId,
            type: 'row' as const,
            x: Math.max(0, Math.min(customRowStart.x - chairSize / 2, width - rowLength)),
            y: Math.max(0, Math.min(customRowStart.y - chairSize / 2, height - chairSize)),
            width: rowLength,
            height: chairSize,
            rotation: initialRotation,
            group_id: groupId,
          };

          if (isSupabaseConfigured) {
            const { data: rowData, error: rowError } = await supabase
              .from('furniture_items')
              .insert(rowItem)
              .select()
              .single();

            if (rowError) {
              console.error('Error placing row item:', rowError);
              return;
            }

            if (rowData) {
              setFurniture((prev) => [...prev, rowData as FurnitureItemType]);
            }
          } else {
            const newItem = { ...rowItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
            setFurniture((prev) => [...prev, newItem]);
          }

          const chairItems = [];
          for (let i = 0; i < customRowChairCount; i++) {
            const offsetX = dirX * chairSize * i;
            const offsetY = dirY * chairSize * i;
            chairItems.push({
              floor_plan_id: floorPlanId,
              type: 'chair' as const,
              x: Math.max(0, Math.min(customRowStart.x + offsetX - chairSize / 2, width - chairSize)),
              y: Math.max(0, Math.min(customRowStart.y + offsetY - chairSize / 2, height - chairSize)),
              width: chairSize,
              height: chairSize,
              rotation: initialRotation,
              group_id: groupId,
            });
          }

          const { data, error } = await supabase
            .from('furniture_items')
            .insert(chairItems)
            .select();

          if (error) {
            console.error('Error placing custom row:', error);
            return;
          }

          if (data) {
            setFurniture((prev) => [...prev, ...(data as FurnitureItemType[])]);
          }
        }

        // Reset custom row state
        setCustomRowStart(null);
        setCustomRowChairCount(1);
      }
    } else if (placementMode === 'row' && rowChairCount) {
      const groupId = crypto.randomUUID();

      // Create row item first
      const rowItem = {
        floor_plan_id: floorPlanId,
        type: 'row' as const,
        x: Math.max(0, Math.min(x - (chairSize * rowChairCount) / 2, width - chairSize * rowChairCount)),
        y: Math.max(0, Math.min(y - chairSize / 2, height - chairSize)),
        width: chairSize * rowChairCount,
        height: chairSize,
        rotation: 0,
        group_id: groupId,
      };

      if (isSupabaseConfigured) {
        const { data: rowData, error: rowError } = await supabase
          .from('furniture_items')
          .insert(rowItem)
          .select()
          .single();

        if (rowError) {
          console.error('Error placing row item:', rowError);
          return;
        }

        if (rowData) {
          setFurniture((prev) => [...prev, rowData as FurnitureItemType]);
        }
      } else {
        const newItem = { ...rowItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
        setFurniture((prev) => [...prev, newItem]);
      }

      const seatsToPlace: { x: number; y: number }[] = [];

      for (let i = 0; i < rowChairCount; i++) {
        const offsetX = (i - (rowChairCount - 1) / 2) * chairSize;
        seatsToPlace.push({
          x: x + offsetX,
          y: y,
        });
      }

      const chairItems = seatsToPlace.map((seat) => ({
        floor_plan_id: floorPlanId,
        type: 'chair' as const,
        x: Math.max(0, Math.min(seat.x - chairSize / 2, width - chairSize)),
        y: Math.max(0, Math.min(seat.y - chairSize / 2, height - chairSize)),
        width: chairSize,
        height: chairSize,
        rotation: 0,
        group_id: groupId,
      }));

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
    } else if (placementMode === 'multi-row') {
      if (!multiRowStart) {
        // Phase 1: First click - set start position
        setMultiRowStart({ x, y });
      } else if (!multiRowEnd) {
        // Phase 2: Second click - set end position and place first row
        const groupId = crypto.randomUUID();
        const dx = x - multiRowStart.x;
        const dy = y - multiRowStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
          // Create row item
          const rowItem = {
            floor_plan_id: floorPlanId,
            type: 'row' as const,
            x: Math.max(0, Math.min(multiRowStart.x - chairSize / 2, width - chairSize)),
            y: Math.max(0, Math.min(multiRowStart.y - chairSize / 2, height - chairSize)),
            width: chairSize,
            height: chairSize,
            rotation: 0,
            group_id: groupId,
          };

          if (isSupabaseConfigured) {
            const { data: rowData, error: rowError } = await supabase
              .from('furniture_items')
              .insert(rowItem)
              .select()
              .single();

            if (rowError) {
              console.error('Error placing row item:', rowError);
              return;
            }

            if (rowData) {
              setFurniture((prev) => [...prev, rowData as FurnitureItemType]);
            }
          } else {
            const newItem = { ...rowItem, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
            setFurniture((prev) => [...prev, newItem]);
          }

          // Place single chair if no distance
          const newChair = {
            floor_plan_id: floorPlanId,
            type: 'chair' as const,
            x: Math.max(0, Math.min(multiRowStart.x - chairSize / 2, width - chairSize)),
            y: Math.max(0, Math.min(multiRowStart.y - chairSize / 2, height - chairSize)),
            width: chairSize,
            height: chairSize,
            rotation: 0,
            group_id: groupId,
          };

          if (isSupabaseConfigured) {
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
          } else {
            const newItem = { ...newChair, id: generateLocalId(), created_at: new Date().toISOString() } as FurnitureItemType;
            setFurniture((prev) => [...prev, newItem]);
          }

          // Reset for next placement
          setMultiRowStart(null);
          setMultiRowEnd(null);
          setMultiRowCount(1);
          onDeactivatePlacementMode();
        } else {
          // Store the end position for phase 3
          setMultiRowEnd({ x, y });
        }
      } else {
        // Phase 3: Third click - place all rows
        const chairSize = 1.67;
        const rowSpacing = 2.5;

        // Calculate row direction
        const rowDx = multiRowEnd.x - multiRowStart.x;
        const rowDy = multiRowEnd.y - multiRowStart.y;
        const rowLength = Math.sqrt(rowDx * rowDx + rowDy * rowDy);

        if (!rowLength || rowLength < 0.0001) {
          console.error('Phase 3: invalid row length', { multiRowStart, multiRowEnd });
          return;
        }

        const dirX = rowDx / rowLength;
        const dirY = rowDy / rowLength;

        // Calculate number of chairs in first row
        const chairCount = Math.max(1, Math.round(rowLength / chairSize) + 1);

        // Calculate initial rotation angle
        const initialRotation = Math.atan2(rowDy, rowDx) * (180 / Math.PI);

        // Calculate perpendicular direction
        const perpX = -rowDy / rowLength;
        const perpY = rowDx / rowLength;

        // Determine which side of the row to place additional rows
        const cursorToCenterDx = x - multiRowStart.x;
        const cursorToCenterDy = y - multiRowStart.y;
        const perpDot = cursorToCenterDx * perpX + cursorToCenterDy * perpY;
        const perpSign = perpDot >= 0 ? 1 : -1;

        const allItems = [];

        // Create all rows
        for (let row = 0; row < multiRowCount; row++) {
          const groupId = crypto.randomUUID();
          const rowOffsetX = perpX * rowSpacing * row * perpSign;
          const rowOffsetY = perpY * rowSpacing * row * perpSign;

          // Create row item for this row
          const rowLength = chairSize * chairCount;
          allItems.push({
            floor_plan_id: floorPlanId,
            type: 'row' as const,
            x: Math.max(0, Math.min(multiRowStart.x + rowOffsetX - chairSize / 2, width - rowLength)),
            y: Math.max(0, Math.min(multiRowStart.y + rowOffsetY - chairSize / 2, height - chairSize)),
            width: rowLength,
            height: chairSize,
            rotation: initialRotation,
            group_id: groupId,
          });

          // Create chairs for this row
          for (let i = 0; i < chairCount; i++) {
            const offsetX = dirX * chairSize * i;
            const offsetY = dirY * chairSize * i;

            allItems.push({
              floor_plan_id: floorPlanId,
              type: 'chair' as const,
              x: Math.max(0, Math.min(multiRowStart.x + offsetX + rowOffsetX - chairSize / 2, width - chairSize)),
              y: Math.max(0, Math.min(multiRowStart.y + offsetY + rowOffsetY - chairSize / 2, height - chairSize)),
              width: chairSize,
              height: chairSize,
              rotation: initialRotation,
              group_id: groupId,
            });
          }
        }

        try {
          const { data, error } = await supabase
            .from('furniture_items')
            .insert(allItems)
            .select();

          if (error) {
            console.error('Error placing multi-row:', error);
            return;
          }

          if (data) {
            setFurniture((prev) => [...prev, ...(data as FurnitureItemType[])]);
          }
        } finally {
          // Reset for next placement
          setMultiRowStart(null);
          setMultiRowEnd(null);
          setMultiRowCount(1);
          onDeactivatePlacementMode();
        }
      }
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    // Ignore clicks that were actually drags
    if (!lastMouseUpWasClick.current) {
      return;
    }
    lastMouseUpWasClick.current = false;

    // Check if the click was on a furniture item
    const target = e.target as HTMLElement;
    const isFurnitureItem = target.closest('[data-furniture-item]');

    if (placementMode === 'none') {
      // Only clear selection if clicking on empty canvas, not on furniture
      if (!isFurnitureItem) {
        onClearSelection();
      }
      return;
    }

    // In placement mode, use click to place/confirm
    await handlePlacementClick(e);
  };

  const handleClearAll = async () => {
    if (furniture.length === 0) return;

    if (confirm(`Are you sure you want to delete all ${furniture.length} furniture items? This cannot be undone.`)) {
      if (isSupabaseConfigured) {
        await supabase.from('furniture_items').delete().eq('floor_plan_id', floorPlanId);
      }
      setFurniture([]);
      setSelectedItemIds([]);
      onClearSelection();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (isSupabaseConfigured) {
      await supabase
        .from('floor_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', floorPlanId);
    }
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

  const seatLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    const rows = furniture.filter(f => f.type === 'row' && f.seat_label_enabled);
    for (const row of rows) {
      if (!row.group_id) continue;
      const chairs = furniture.filter(f => f.type === 'chair' && f.group_id === row.group_id);
      if (chairs.length === 0) continue;

      const rowCenterX = row.x + row.width / 2;
      const rowCenterY = row.y + row.height / 2;
      const rowRad = ((row.rotation || 0) * Math.PI) / 180;
      const cosR = Math.cos(-rowRad);
      const sinR = Math.sin(-rowRad);

      const dir = row.seat_label_dir || 'ltr';
      const sortDir = dir === 'rtl' ? -1 : 1;

      const sorted = [...chairs].sort((a, b) => {
        const aRx = (a.x + a.width / 2) - rowCenterX;
        const aRy = (a.y + a.height / 2) - rowCenterY;
        const bRx = (b.x + b.width / 2) - rowCenterX;
        const bRy = (b.y + b.height / 2) - rowCenterY;
        const aAlong = aRx * cosR - aRy * sinR;
        const bAlong = bRx * cosR - bRy * sinR;
        return (aAlong - bAlong) * sortDir;
      });

      const fmt = row.seat_label_format || 'numbers';
      const startAt = row.seat_label_start_at ?? 1;

      sorted.forEach((chair, i) => {
        map.set(chair.id, formatLabel(startAt + i, fmt));
      });
    }
    return map;
  }, [furniture]);

  const rowLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    const rows = furniture.filter(f => f.type === 'row' && f.row_label_enabled);
    if (rows.length === 0) return map;

    const fmt = rows[0].row_label_format || 'LETTERS';
    const startAt = rows[0].row_label_start_at ?? 1;
    const dir = rows[0].row_label_direction || 'ltr';

    const sorted = [...rows].sort((a, b) => {
      const ay = a.y + a.height / 2;
      const by = b.y + b.height / 2;
      const diff = ay - by;
      if (Math.abs(diff) > 0.5) return diff;
      return (a.x + a.width / 2) - (b.x + b.width / 2);
    });

    if (dir === 'rtl') sorted.reverse();

    sorted.forEach((row, i) => {
      map.set(row.id, formatLabel(startAt + i, fmt));
    });

    return map;
  }, [furniture]);

  return (
    <div className="h-full flex flex-col bg-gray-100 min-h-0">
      <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-4 flex-shrink-0 overflow-x-auto">
        <h2 className="text-base font-bold text-gray-800 whitespace-nowrap">
          {formatDimension(width)} × {formatDimension(height)}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            disabled={furniture.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={canvasRef}
          data-canvas="true"
          className="absolute bg-white border-2 border-gray-300 shadow-lg"
          style={{
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            transform: `translate(${cameraX}px, ${cameraY}px)`,
            transformOrigin: '0 0',
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${pixelGridSize}px ${pixelGridSize}px`,
            backgroundPosition: '0 0',
            cursor: isPanning ? 'grabbing' : (spacePressed ? 'grab' : (placementMode === 'none' ? 'default' : (placementMode === 'marquee' ? 'crosshair' : 'crosshair'))),
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseMove}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setCursorPosition(null)}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
        >
          {furniture.map((item) => {
            const selectedItem = furniture.find((f) => f.id === selectedId);
            const isIndividuallySelected = selectedIndividualId === item.id;
            const isMultiSelected = selectedItemIds.length > 0 && selectedItemIds.includes(item.id);
            const isSelected =
              isMultiSelected ||
              isIndividuallySelected ||
              selectedId === item.id ||
              (selectedItem?.group_id && item.group_id === selectedItem.group_id);

            // Show individual selection indicator when:
            // 1. Item is individually selected (double-clicked)
            // 2. Item is selected but has no group
            const showIndividualSelection =
              isIndividuallySelected ||
              (selectedId === item.id && !item.group_id);

            return (
              <FurnitureItem
                key={item.id}
                item={item}
                scale={scale}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDelete={handleDelete}
                isSelected={isSelected}
                showIndividualSelection={showIndividualSelection}
                isIndividuallySelected={isIndividuallySelected}
                isMultiSelected={isMultiSelected}
                onSelect={handleSingleClick}
                onDoubleClick={handleDoubleClick}
                isRotatingGroup={isRotatingGroup}
                seatLabel={seatLabelMap.get(item.id)}
              />
            );
          })}
          {furniture.filter(f => f.type === 'row' && f.row_label_enabled).map(rowItem => {
            const pos = rowItem.row_label_position || 'both';
            if (pos === 'none') return null;
            const label = rowLabelMap.get(rowItem.id) || '';
            const chairs = furniture.filter(f => f.type === 'chair' && f.group_id === rowItem.group_id);
            if (chairs.length === 0) return null;

            const actualSeatCount = chairs.length;
            let actualSpacing = rowItem.seat_spacing || 1.67;
            if (actualSeatCount >= 2 && !rowItem.seat_count) {
              const sorted = [...chairs].sort((a, b) => {
                const d = (a.x + a.width / 2) - (b.x + b.width / 2);
                return Math.abs(d) > 0.01 ? d : (a.y + a.height / 2) - (b.y + b.height / 2);
              });
              let total = 0;
              for (let i = 1; i < sorted.length; i++) {
                const dx = (sorted[i].x + sorted[i].width / 2) - (sorted[i - 1].x + sorted[i - 1].width / 2);
                const dy = (sorted[i].y + sorted[i].height / 2) - (sorted[i - 1].y + sorted[i - 1].height / 2);
                total += Math.sqrt(dx * dx + dy * dy);
              }
              actualSpacing = total / (sorted.length - 1);
            }

            const effectiveRow = {
              ...rowItem,
              seat_count: rowItem.seat_count || actualSeatCount,
              seat_spacing: rowItem.seat_count ? (rowItem.seat_spacing || 1.67) : actualSpacing,
            };
            const seatPositions = computeRowSeatPositions(effectiveRow);
            const rowCenterX = rowItem.x + rowItem.width / 2;
            const rowCenterY = rowItem.y + rowItem.height / 2;
            const rowRad = ((rowItem.rotation || 0) * Math.PI) / 180;
            const cosR = Math.cos(rowRad);
            const sinR = Math.sin(rowRad);
            const fontSize = Math.max(8, Math.min(14, scale * 0.7));
            const labelOffset = 1.4;

            const toWorld = (lx: number, ly: number) => ({
              x: rowCenterX + lx * cosR - ly * sinR,
              y: rowCenterY + lx * sinR + ly * cosR,
            });

            const labels: { key: string; x: number; y: number }[] = [];

            if (seatPositions.length >= 2) {
              const first = seatPositions[0];
              const second = seatPositions[1];
              const last = seatPositions[seatPositions.length - 1];
              const secondLast = seatPositions[seatPositions.length - 2];

              const leftDx = first.x - second.x;
              const leftDy = first.y - second.y;
              const leftLen = Math.sqrt(leftDx * leftDx + leftDy * leftDy) || 1;
              const leftPt = toWorld(
                first.x + (leftDx / leftLen) * labelOffset,
                first.y + (leftDy / leftLen) * labelOffset
              );

              const rightDx = last.x - secondLast.x;
              const rightDy = last.y - secondLast.y;
              const rightLen = Math.sqrt(rightDx * rightDx + rightDy * rightDy) || 1;
              const rightPt = toWorld(
                last.x + (rightDx / rightLen) * labelOffset,
                last.y + (rightDy / rightLen) * labelOffset
              );

              if (pos === 'left' || pos === 'both') {
                labels.push({ key: `${rowItem.id}-left`, ...leftPt });
              }
              if (pos === 'right' || pos === 'both') {
                labels.push({ key: `${rowItem.id}-right`, ...rightPt });
              }
            } else if (seatPositions.length === 1) {
              const pt = toWorld(seatPositions[0].x, seatPositions[0].y);
              if (pos === 'left' || pos === 'both') {
                labels.push({ key: `${rowItem.id}-left`, x: pt.x - cosR * labelOffset, y: pt.y - sinR * labelOffset });
              }
              if (pos === 'right' || pos === 'both') {
                labels.push({ key: `${rowItem.id}-right`, x: pt.x + cosR * labelOffset, y: pt.y + sinR * labelOffset });
              }
            }

            return labels.map(l => (
              <div
                key={l.key}
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${l.x * scale}px`,
                  top: `${l.y * scale}px`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${fontSize}px`,
                  fontWeight: 600,
                  color: '#6b7280',
                  lineHeight: 1,
                  zIndex: 5,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                {label}
              </div>
            ));
          })}
          {selectedId && !selectedIndividualId && (() => {
            const selectedItem = furniture.find((f) => f.id === selectedId);
            if (selectedItem?.group_id) {
              const groupItems = furniture.filter((f) => f.group_id === selectedItem.group_id);
              return <GroupSelectionOverlay items={groupItems} scale={scale} onDelete={handleDelete} onExtendRow={handleExtendRow} onRotateRow={handleRotateRow} onRotatePreview={handleRotatePreview} onRotationStart={() => setIsRotatingGroup(true)} onRotationEnd={() => setIsRotatingGroup(false)} />;
            }
            return null;
          })()}
          {selectedItemIds.length > 0 && !selectedId && (() => {
            const selected = furniture.filter(f => selectedItemIds.includes(f.id));
            if (selected.length === 0) return null;

            const selectedGroupIds = new Set(selected.map(f => f.group_id).filter(Boolean));
            const hasRows = furniture.some(f => f.type === 'row' && selectedGroupIds.has(f.group_id || ''));

            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
            selected.forEach(gi => {
              gMinX = Math.min(gMinX, gi.x);
              gMinY = Math.min(gMinY, gi.y);
              gMaxX = Math.max(gMaxX, gi.x + gi.width);
              gMaxY = Math.max(gMaxY, gi.y + gi.height);
            });
            const p = 0.1;
            const boxLeft = (gMinX - p) * scale;
            const boxTop = (gMinY - p) * scale;
            const boxWidth = (gMaxX - gMinX + p * 2) * scale;
            const boxHeight = (gMaxY - gMinY + p * 2) * scale;
            const boxCenterX = boxLeft + boxWidth / 2;
            const boxCenterY = boxTop + boxHeight / 2;

            const currentRotation = isMultiRotating
              ? norm360(multiRotationInitial + multiRotationDelta)
              : 0;

            const mHandleSize = 10;
            const mLeftHandleX = boxLeft;
            const mLeftHandleY = boxTop + boxHeight / 2;
            const mRightHandleX = boxLeft + boxWidth;
            const mRightHandleY = boxTop + boxHeight / 2;

            const mChairSize = 1.67;
            let mPreviewSeats: Array<{ x: number; y: number }> = [];
            let mTotalSeats = selected.filter(i => i.type === 'chair').length;

            if (hasRows && multiExtendSide && multiExtendStartRef.current && multiExtendCurrentRef.current) {
              const edx = (multiExtendCurrentRef.current.x - multiExtendStartRef.current.x) / scale;
              const edy = (multiExtendCurrentRef.current.y - multiExtendStartRef.current.y) / scale;
              const eDist = Math.sqrt(edx * edx + edy * edy);

              if (eDist >= mChairSize * 0.0625) {
                const seatsToAdd = Math.floor(eDist / mChairSize + 0.9375);

                for (const gid of Array.from(selectedGroupIds)) {
                  const gItems = furniture.filter(i => i.group_id === gid);
                  if (gItems.length < 2) continue;

                  let md = 0;
                  let eA = gItems[0], eB = gItems[1];
                  for (let i = 0; i < gItems.length; i++) {
                    for (let j = i + 1; j < gItems.length; j++) {
                      const d = Math.sqrt(
                        Math.pow((gItems[j].x + gItems[j].width / 2) - (gItems[i].x + gItems[i].width / 2), 2) +
                        Math.pow((gItems[j].y + gItems[j].height / 2) - (gItems[i].y + gItems[i].height / 2), 2)
                      );
                      if (d > md) { md = d; eA = gItems[i]; eB = gItems[j]; }
                    }
                  }

                  const ax = eA.x + eA.width / 2, ay = eA.y + eA.height / 2;
                  const bx = eB.x + eB.width / 2, by = eB.y + eB.height / 2;
                  const fc = (ax < bx || (ax === bx && ay < by)) ? eA : eB;
                  const lc = fc === eA ? eB : eA;

                  const rdx = lc.x - fc.x, rdy = lc.y - fc.y;
                  const rl = Math.sqrt(rdx * rdx + rdy * rdy);
                  if (rl === 0) continue;
                  const dX = rdx / rl, dY = rdy / rl;

                  for (let i = 1; i <= seatsToAdd; i++) {
                    if (multiExtendSide === 'left') {
                      mPreviewSeats.push({ x: fc.x - dX * mChairSize * i, y: fc.y - dY * mChairSize * i });
                    } else {
                      mPreviewSeats.push({ x: lc.x + dX * mChairSize * i, y: lc.y + dY * mChairSize * i });
                    }
                  }
                }

                mTotalSeats += seatsToAdd * selectedGroupIds.size;
              }
            }

            return (
              <>
                <div
                  key="multi-select-box"
                  className="absolute border-2 border-blue-500 bg-blue-50/30 pointer-events-none rounded-lg"
                  style={{
                    left: `${boxLeft}px`,
                    top: `${boxTop}px`,
                    width: `${boxWidth}px`,
                    height: `${boxHeight}px`,
                  }}
                />

                {hasRows && (
                  <>
                    <div
                      className="absolute bg-blue-500 rounded-full pointer-events-none"
                      style={{
                        left: `${boxCenterX - 4}px`,
                        top: `${boxTop - 16}px`,
                        width: '8px',
                        height: '8px',
                      }}
                    />

                    <div
                      onPointerDown={(e) => {
                        const canvas = document.querySelector('[data-canvas="true"]');
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const centerSX = (gMinX + gMaxX) / 2 * scale + rect.left;
                        const centerSY = (gMinY + gMaxY) / 2 * scale + rect.top;
                        handleMultiRotationPointerDown(e, centerSX, centerSY);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bg-green-500 border-2 border-white rounded-full cursor-grab active:cursor-grabbing hover:bg-green-400 flex items-center justify-center shadow-lg"
                      style={{
                        left: `${boxCenterX - 12}px`,
                        top: `${boxTop - 40}px`,
                        width: '24px',
                        height: '24px',
                        zIndex: 30,
                        touchAction: 'none',
                      }}
                      title="Rotate rows"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </div>

                    <div
                      onMouseDown={(e) => handleMultiExtendMouseDown(e, 'left')}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bg-yellow-400 border-2 border-gray-700 cursor-ew-resize hover:bg-yellow-300"
                      style={{
                        left: `${mLeftHandleX - mHandleSize / 2}px`,
                        top: `${mLeftHandleY - mHandleSize / 2}px`,
                        width: `${mHandleSize}px`,
                        height: `${mHandleSize}px`,
                        zIndex: 30,
                      }}
                    />

                    <div
                      onMouseDown={(e) => handleMultiExtendMouseDown(e, 'right')}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bg-yellow-400 border-2 border-gray-700 cursor-ew-resize hover:bg-yellow-300"
                      style={{
                        left: `${mRightHandleX - mHandleSize / 2}px`,
                        top: `${mRightHandleY - mHandleSize / 2}px`,
                        width: `${mHandleSize}px`,
                        height: `${mHandleSize}px`,
                        zIndex: 30,
                      }}
                    />
                  </>
                )}

                {mPreviewSeats.map((seat, idx) => (
                  <div
                    key={`multi-preview-${idx}`}
                    className="absolute rounded-full border-2 border-dashed border-blue-400 bg-blue-100/50 pointer-events-none"
                    style={{
                      left: `${seat.x * scale}px`,
                      top: `${seat.y * scale}px`,
                      width: `${mChairSize * scale}px`,
                      height: `${mChairSize * scale}px`,
                    }}
                  />
                ))}

                {multiExtendSide && mPreviewSeats.length > 0 && (
                  <div
                    className="absolute bg-gray-800 text-white px-3 py-1 rounded font-semibold text-sm pointer-events-none z-30"
                    style={{
                      left: `${boxCenterX}px`,
                      top: `${boxCenterY}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {mTotalSeats}
                  </div>
                )}

                {isMultiRotating && (() => {
                  const { isSnapped } = snapAxisToGrid(currentRotation, 3);
                  return (
                    <>
                      <div
                        className={`absolute rounded-full pointer-events-none z-30 transition-colors ${isSnapped ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{
                          left: `${boxCenterX - 6}px`,
                          top: `${boxCenterY - 6}px`,
                          width: '12px',
                          height: '12px',
                        }}
                      />
                      <div
                        className={`absolute text-white px-3 py-1 rounded font-semibold text-sm pointer-events-none z-30 shadow-lg transition-colors ${isSnapped ? 'bg-blue-600' : 'bg-green-600'}`}
                        style={{
                          left: `${boxCenterX}px`,
                          top: `${boxCenterY}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {Math.round(norm180Axis(currentRotation))}° {isSnapped && '\u2713'}
                      </div>
                      {[0, 45, 90, 135].map((angle) => {
                        const angleRad = (angle * Math.PI) / 180;
                        const lineLength = Math.max(boxWidth, boxHeight) / 2 + 10;
                        const x1 = boxCenterX;
                        const y1 = boxCenterY;
                        const x2 = x1 + Math.cos(angleRad) * lineLength;
                        const y2 = y1 + Math.sin(angleRad) * lineLength;
                        const curNorm = norm360(currentRotation);
                        const dist = Math.abs(curNorm - angle);
                        const wDist = Math.abs(curNorm - (angle + 360));
                        const isThisSnap = Math.min(dist, wDist) <= 3;
                        return (
                          <svg key={angle} className="absolute pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isThisSnap ? '#3b82f6' : '#d1d5db'} strokeWidth={isThisSnap ? '2' : '1'} strokeDasharray="4,4" opacity={isThisSnap ? '0.8' : '0.3'} />
                          </svg>
                        );
                      })}
                    </>
                  );
                })()}
              </>
            );
          })()}
          {placementMode !== 'none' && cursorPosition && (
            <>
              {placementMode === 'multi-row' && multiRowStart && !multiRowEnd ? (
                // Multi-row Phase 1: Show preview from start to cursor (first row)
                (() => {
                  const chairSize = 1.67;
                  const dx = cursorPosition.x - multiRowStart.x;
                  const dy = cursorPosition.y - multiRowStart.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const chairCount = Math.max(1, Math.round(distance / chairSize) + 1);

                  return Array.from({ length: chairCount }).map((_, index) => {
                    let offsetX = 0;
                    let offsetY = 0;

                    if (distance > 0) {
                      const dirX = dx / distance;
                      const dirY = dy / distance;
                      offsetX = dirX * chairSize * index;
                      offsetY = dirY * chairSize * index;
                    }

                    return (
                      <div
                        key={`multi-row-preview-${index}`}
                        className="absolute pointer-events-none"
                        style={{
                          left: `${(multiRowStart.x + offsetX) * scale}px`,
                          top: `${(multiRowStart.y + offsetY) * scale}px`,
                          width: `${chairSize * scale}px`,
                          height: `${chairSize * scale}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="w-full h-full rounded-full border-2 border-purple-500 bg-purple-100 opacity-60 flex items-center justify-center pointer-events-none">
                          <Armchair className="w-1/2 h-1/2 text-purple-700 pointer-events-none" />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : placementMode === 'multi-row' && multiRowStart && multiRowEnd ? (
                // Multi-row Phase 2: Show multiple rows based on cursor perpendicular distance
                (() => {
                  const chairSize = 1.67;
                  const rowSpacing = 2.5;

                  // Calculate row direction
                  const rowDx = multiRowEnd.x - multiRowStart.x;
                  const rowDy = multiRowEnd.y - multiRowStart.y;
                  const rowLength = Math.sqrt(rowDx * rowDx + rowDy * rowDy);
                  const dirX = rowDx / rowLength;
                  const dirY = rowDy / rowLength;

                  // Calculate number of chairs in row
                  const chairCount = Math.max(1, Math.round(rowLength / chairSize) + 1);

                  // Calculate perpendicular direction
                  const perpX = -rowDy / rowLength;
                  const perpY = rowDx / rowLength;

                  // Determine which side of the row to place additional rows
                  const cursorToCenterDx = cursorPosition.x - multiRowStart.x;
                  const cursorToCenterDy = cursorPosition.y - multiRowStart.y;
                  const perpDot = cursorToCenterDx * perpX + cursorToCenterDy * perpY;
                  const perpSign = perpDot >= 0 ? 1 : -1;

                  const allSeats = [];

                  // Create preview for all rows
                  for (let row = 0; row < multiRowCount; row++) {
                    const rowOffsetX = perpX * rowSpacing * row * perpSign;
                    const rowOffsetY = perpY * rowSpacing * row * perpSign;

                    for (let i = 0; i < chairCount; i++) {
                      const offsetX = dirX * chairSize * i;
                      const offsetY = dirY * chairSize * i;

                      allSeats.push({
                        x: multiRowStart.x + offsetX + rowOffsetX,
                        y: multiRowStart.y + offsetY + rowOffsetY,
                        key: `multi-row-preview-${row}-${i}`,
                      });
                    }
                  }

                  return (
                    <>
                      {allSeats.map((seat) => (
                        <div
                          key={seat.key}
                          className="absolute pointer-events-none"
                          style={{
                            left: `${seat.x * scale}px`,
                            top: `${seat.y * scale}px`,
                            width: `${chairSize * scale}px`,
                            height: `${chairSize * scale}px`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div className="w-full h-full rounded-full border-2 border-purple-500 bg-purple-100 opacity-60 flex items-center justify-center pointer-events-none">
                            <Armchair className="w-1/2 h-1/2 text-purple-700 pointer-events-none" />
                          </div>
                        </div>
                      ))}
                      {/* Show seat counter */}
                      <div
                        className="absolute bg-purple-800 text-white px-3 py-1 rounded font-semibold text-sm pointer-events-none z-30"
                        style={{
                          left: `${cursorPosition.x * scale}px`,
                          top: `${cursorPosition.y * scale}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {multiRowCount} × {chairCount}
                      </div>
                    </>
                  );
                })()
              ) : placementMode === 'custom-row' && customRowStart ? (
                // Custom row: show dynamic line from start to cursor
                Array.from({ length: customRowChairCount }).map((_, index) => {
                  const chairSize = 1.67;
                  const dx = cursorPosition.x - customRowStart.x;
                  const dy = cursorPosition.y - customRowStart.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  let offsetX = 0;
                  let offsetY = 0;

                  if (distance > 0) {
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    offsetX = dirX * chairSize * index;
                    offsetY = dirY * chairSize * index;
                  }

                  return (
                    <div
                      key={`custom-row-preview-${index}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(customRowStart.x + offsetX) * scale}px`,
                        top: `${(customRowStart.y + offsetY) * scale}px`,
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
              ) : placementMode === 'row' && rowChairCount ? (
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
                    placementMode === 'custom-row' ? 'border-emerald-500 bg-emerald-100' :
                    placementMode === 'multi-row' ? 'border-purple-500 bg-purple-100' :
                    'border-sky-500 bg-sky-100'
                  }`}>
                    <Armchair className={`w-1/2 h-1/2 pointer-events-none ${
                      placementMode === 'custom-row' ? 'text-emerald-700' :
                      placementMode === 'multi-row' ? 'text-purple-700' :
                      'text-sky-700'
                    }`} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {marqueeRect && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: Math.min(marqueeRect.x1, marqueeRect.x2),
              top: Math.min(marqueeRect.y1, marqueeRect.y2),
              width: Math.abs(marqueeRect.x2 - marqueeRect.x1),
              height: Math.abs(marqueeRect.y2 - marqueeRect.y1),
              backgroundColor: 'rgba(156, 163, 175, 0.2)',
              border: '1px solid rgba(156, 163, 175, 0.5)',
            }}
          />
        )}
        <ViewportNavigator
          onPan={handleNavigatorPan}
          onZoomIn={handleNavigatorZoomIn}
          onZoomOut={handleNavigatorZoomOut}
          scale={scale}
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
        />
      </div>
    </div>
  );
}

