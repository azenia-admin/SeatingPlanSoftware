import { useState, useEffect } from 'react';
import GridCanvas from './components/GridCanvas';
import FurniturePalette from './components/FurniturePalette';
import type { FurnitureTemplate } from './types/furniture';
import { supabase } from './lib/supabase';

function App() {
  const [floorPlan, setFloorPlan] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  const [draggedTemplate, setDraggedTemplate] = useState<FurnitureTemplate | null>(null);

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

  if (!floorPlan) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <FurniturePalette onDragStart={handleFurnitureDragStart} />
      <GridCanvas
        width={floorPlan.width}
        height={floorPlan.height}
        floorPlanId={floorPlan.id}
        draggedTemplate={draggedTemplate}
        onTemplatePlaced={() => setDraggedTemplate(null)}
      />
    </div>
  );
}

export default App;
