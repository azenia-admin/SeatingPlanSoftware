import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Save, Download, Trash2, Armchair } from 'lucide-react';
import FurnitureItem from './FurnitureItem';
import GroupSelectionOverlay from './GroupSelectionOverlay';
import type { FurnitureItem as FurnitureItemType, FurnitureTemplate } from '../types/furniture';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface GridCanvasProps {
  width: number;
  height: number;
  floorPlanId: string;
  draggedTemplate: FurnitureTemplate | null;
  onTemplatePlaced: () => void;
  placementMode: 'none' | 'single' | 'row' | 'custom-row' | 'multi-row';
  rowChairCount: number | null;
  onDeactivatePlacementMode: () => void;
  onSelectionChange?: (selectedItem: FurnitureItemType | null, groupItems: FurnitureItemType[], selectedId: string | null, selectedIndividualId: string | null) => void;
  selectedId: string | null;
  selectedIndividualId: string | null;
  onClearSelection: () => void;
}

export default function GridCanvas({
  width,
  height,
  floorPlanId,
  draggedTemplate,
  onTemplatePlaced,
  placementMode,
  rowChairCount,
  onDeactivatePlacementMode,
  onSelectionChange,
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

  const gridSize = 0.5;
  const pixelGridSize = gridSize * scale;

  // Auto-fit zoom to viewport
  const fitToViewport = () => {
    if (!viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const margin = 40;
    const scaleX = (vw - margin) / width;
    const scaleY = (vh - margin) / height;
    const nextScale = Math.min(scaleX, scaleY);
    const MIN_SCALE = 4;
    const MAX_SCALE = 100;
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    setScale(clamped);
    setCameraX((vw - width * clamped) / 2);
    setCameraY((vh - height * clamped) / 2);
  };

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

    // Priority: individual selection (double-click) over group selection (single-click)
    const activeSelectionId = selectedIndividualId || selectedId;

    if (activeSelectionId) {
      const selectedItem = furniture.find(f => f.id === activeSelectionId);

      if (selectedItem) {
        // If the selected item has a group_id, find the row or table in the group
        if (selectedItem.group_id) {
          const groupItems = furniture.filter(f => f.group_id === selectedItem.group_id);
          // Find the row or table in the group
          const rowOrTable = groupItems.find(f => f.type === 'row' || f.type === 'table');
          if (rowOrTable) {
            onSelectionChange(rowOrTable, groupItems, selectedId, selectedIndividualId);
            return;
          }
        }

        // If it's a standalone table (no group_id), show sidebar for it
        if (selectedItem.type === 'table') {
          onSelectionChange(selectedItem, [selectedItem], selectedId, selectedIndividualId);
          return;
        }

        // Otherwise, don't show the sidebar
        onSelectionChange(null, [], selectedId, selectedIndividualId);
      } else {
        onSelectionChange(null, [], selectedId, selectedIndividualId);
      }
    } else {
      onSelectionChange(null, [], null, null);
    }
  }, [selectedIndividualId, selectedId, furniture, onSelectionChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spacePressed) {
        setSpacePressed(true);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
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
  }, [selectedId, placementMode, spacePressed, isPanning]);

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

    // Set the initial cursor position
    dragStartCursor.current = { x: cursorX, y: cursorY };

    // If individual selection is active, only drag that item
    if (selectedIndividualIdRef.current === item.id) {
      dragStartPositions.current.set(item.id, { x: item.x, y: item.y });
      // Store the center of the individual item
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      initialTableCenter.current = { x: centerX, y: centerY };
    } else if (item.group_id) {
      const groupItems = furniture.filter((f) => f.group_id === item.group_id);
      groupItems.forEach((groupItem) => {
        dragStartPositions.current.set(groupItem.id, { x: groupItem.x, y: groupItem.y });
      });

      // Find the table in the group and store its center for rotation purposes
      const table = groupItems.find((f) => f.type === 'table');
      if (table) {
        const centerX = table.x + table.width / 2;
        const centerY = table.y + table.height / 2;
        initialTableCenter.current = { x: centerX, y: centerY };
      } else {
        // For rows (no table), calculate the center of all items
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

    const itemsToUpdate = draggedItem.group_id
      ? furniture.filter((f) => f.group_id === draggedItem.group_id)
      : furniture.filter((f) => f.id === draggedItem.id);

    // Stop dragging immediately to prevent further position updates
    setDraggedItem(null);
    dragStartPositions.current.clear();
    initialTableCenter.current = null;
    dragStartCursor.current = null;

    // Save positions to database
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

    // Start panning if:
    // 1. Space is pressed, OR
    // 2. Clicking empty canvas and not in placement mode
    if (spacePressed || (!isFurnitureItem && isCanvasClick && placementMode === 'none')) {
      setIsPanning(true);
      panStartScreen.current = { x: e.clientX, y: e.clientY };
      lastPanScreen.current = { x: e.clientX, y: e.clientY };
      panMoved.current = false;
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

  const handleSingleClick = (id: string) => {
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

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-0">
      <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-4 flex-shrink-0 overflow-x-auto">
        <h2 className="text-base font-bold text-gray-800 whitespace-nowrap">
          {formatDimension(width)} × {formatDimension(height)}
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Zoom:</label>
          <input
            type="range"
            min="8"
            max="100"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-gray-600 w-10">{scale}px/m</span>
        </div>
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
            cursor: isPanning ? 'grabbing' : (spacePressed || placementMode === 'none' ? 'grab' : (placementMode !== 'none' ? 'crosshair' : 'default')),
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
            const isSelected =
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
                onSelect={handleSingleClick}
                onDoubleClick={handleDoubleClick}
                isRotatingGroup={isRotatingGroup}
              />
            );
          })}
          {selectedId && !selectedIndividualId && (() => {
            const selectedItem = furniture.find((f) => f.id === selectedId);
            if (selectedItem?.group_id) {
              const groupItems = furniture.filter((f) => f.group_id === selectedItem.group_id);
              return <GroupSelectionOverlay items={groupItems} scale={scale} onDelete={handleDelete} onExtendRow={handleExtendRow} onRotateRow={handleRotateRow} onRotatePreview={handleRotatePreview} onRotationStart={() => setIsRotatingGroup(true)} onRotationEnd={() => setIsRotatingGroup(false)} />;
            }
            return null;
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
      </div>
    </div>
  );
}

