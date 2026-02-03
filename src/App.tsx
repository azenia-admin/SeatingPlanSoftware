import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import GridCanvas from './components/GridCanvas';
import FurniturePalette from './components/FurniturePalette';
import DimensionSettings from './components/DimensionSettings';
import type { FurnitureTemplate } from './types/furniture';
import { supabase } from './lib/supabase';

function App() {
  const [floorPlan, setFloorPlan] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  const [draggedTemplate, setDraggedTemplate] = useState<FurnitureTemplate | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [placementMode, setPlacementMode] = useState<'none' | 'single' | 'row'>('none');

  useEffect(() => {
    const createDefaultFloorPlan = async () => {
      const { data, error } = await supabase
        .from('floor_plans')
        .insert({
          width: 90,
          height: 90,
          name: "Floor Plan 90' × 90'",
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating floor plan:', error);
        return;
      }

      if (data) {
        setFloorPlan({
          id: data.id,
          width: data.width,
          height: data.height,
        });
      }
    };

    createDefaultFloorPlan();
  }, []);

  const handleFurnitureDragStart = (template: FurnitureTemplate) => {
    setDraggedTemplate(template);
  };

  const handleActivatePlacementMode = (mode: 'single' | 'row') => {
    setPlacementMode(mode);
  };

  const handleDeactivatePlacementMode = () => {
    setPlacementMode('none');
  };

  const handleDimensionUpdate = async (width: number, height: number) => {
    if (!floorPlan) return;

    const formatDimension = (feet: number): string => {
      const wholeF = Math.floor(feet);
      const inches = Math.round((feet - wholeF) * 12);
      if (inches === 0) {
        return `${wholeF}'`;
      }
      return `${wholeF}'${inches}"`;
    };

    const { error } = await supabase
      .from('floor_plans')
      .update({
        width,
        height,
        name: `Floor Plan ${formatDimension(width)} × ${formatDimension(height)}`,
      })
      .eq('id', floorPlan.id);

    if (error) {
      console.error('Error updating floor plan:', error);
      return;
    }

    const { data: furnitureItems } = await supabase
      .from('furniture_items')
      .select('*')
      .eq('floor_plan_id', floorPlan.id);

    if (furnitureItems) {
      for (const item of furnitureItems) {
        const newX = Math.max(0, Math.min(item.x, width - item.width));
        const newY = Math.max(0, Math.min(item.y, height - item.height));

        if (newX !== item.x || newY !== item.y) {
          await supabase
            .from('furniture_items')
            .update({ x: newX, y: newY })
            .eq('id', item.id);
        }
      }
    }

    setFloorPlan({
      ...floorPlan,
      width,
      height,
    });
  };

  if (!floorPlan) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Floor Plan Designer</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          <Settings className="w-4 h-4" />
          Dimensions
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <FurniturePalette
          onDragStart={handleFurnitureDragStart}
          onActivatePlacementMode={handleActivatePlacementMode}
          placementMode={placementMode}
        />
        <GridCanvas
          key={`${floorPlan.width}-${floorPlan.height}`}
          width={floorPlan.width}
          height={floorPlan.height}
          floorPlanId={floorPlan.id}
          draggedTemplate={draggedTemplate}
          onTemplatePlaced={() => setDraggedTemplate(null)}
          placementMode={placementMode}
          onDeactivatePlacementMode={handleDeactivatePlacementMode}
        />
      </div>
      {showSettings && (
        <DimensionSettings
          currentWidth={floorPlan.width}
          currentHeight={floorPlan.height}
          onUpdate={handleDimensionUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
