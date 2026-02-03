import { useRef, useState, useEffect } from 'react';
import { Save, Download, Trash2 } from 'lucide-react';
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
}

export default function GridCanvas({
  width,
  height,
  floorPlanId,
  draggedTemplate,
  onTemplatePlaced
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [furniture, setFurniture] = useState<FurnitureItemType[]>([]);
  const [draggedItem, setDraggedItem] = useState<FurnitureItemType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const initialTableCenter = useRef<{ x: number; y: number } | null>(null);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

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

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !draggedTemplate) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid((e.clientX - rect.left) / scale);
    const y = snapToGrid((e.clientY - rect.top) / scale);

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

    const newFurniture: FurnitureItemType[] = [];
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

    setFurniture([...furniture, ...newFurniture]);
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
      }
    } else {
      dragStartPositions.current.set(item.id, { x: item.x, y: item.y });
    }

    setDraggedItem(item);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedItem || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = snapToGrid((e.clientX - rect.left) / scale);
    const cursorY = snapToGrid((e.clientY - rect.top) / scale);

    let deltaX: number;
    let deltaY: number;

    // If dragging a group, cursor position represents the table center
    if (initialTableCenter.current) {
      deltaX = cursorX - initialTableCenter.current.x;
      deltaY = cursorY - initialTableCenter.current.y;
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

  const handleMouseUp = async () => {
    if (draggedItem) {
      const itemsToUpdate = draggedItem.group_id
        ? furniture.filter((f) => f.group_id === draggedItem.group_id)
        : furniture.filter((f) => f.id === draggedItem.id);

      for (const item of itemsToUpdate) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y })
          .eq('id', item.id);
      }

      dragStartPositions.current.clear();
      initialTableCenter.current = null;
      setDraggedItem(null);
    }
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
          className="relative bg-white border-2 border-gray-300 shadow-lg mx-auto"
          style={{
            width: `${width * scale}px`,
            height: `${height * scale}px`,
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${pixelGridSize}px ${pixelGridSize}px`,
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedId(null)}
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
              return <GroupSelectionOverlay items={groupItems} scale={scale} onDelete={handleDelete} />;
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
}

