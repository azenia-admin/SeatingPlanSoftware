import { useRef, useState, useEffect } from 'react';
import { Save, Download, Upload } from 'lucide-react';
import FurnitureItem from './FurnitureItem';
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

    const newItem = {
      floor_plan_id: floorPlanId,
      type: draggedTemplate.type,
      x: Math.max(0, Math.min(x, width - draggedTemplate.width)),
      y: Math.max(0, Math.min(y, height - draggedTemplate.height)),
      width: draggedTemplate.width,
      height: draggedTemplate.height,
      rotation: 0,
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
      setFurniture([...furniture, data as FurnitureItemType]);
    }

    onTemplatePlaced();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedItem || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid((e.clientX - rect.left) / scale);
    const y = snapToGrid((e.clientY - rect.top) / scale);

    setFurniture(
      furniture.map((item) =>
        item.id === draggedItem.id
          ? {
              ...item,
              x: Math.max(0, Math.min(x, width - item.width)),
              y: Math.max(0, Math.min(y, height - item.height)),
            }
          : item
      )
    );
  };

  const handleMouseUp = async () => {
    if (draggedItem) {
      const item = furniture.find((f) => f.id === draggedItem.id);
      if (item) {
        await supabase
          .from('furniture_items')
          .update({ x: item.x, y: item.y })
          .eq('id', item.id);
      }
      setDraggedItem(null);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('furniture_items').delete().eq('id', id);
    setFurniture(furniture.filter((item) => item.id !== id));
    setSelectedId(null);
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
          {furniture.map((item) => (
            <FurnitureItem
              key={item.id}
              item={item}
              scale={scale}
              onDragStart={setDraggedItem}
              onDelete={handleDelete}
              isSelected={selectedId === item.id}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

