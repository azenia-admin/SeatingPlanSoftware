import { useState } from 'react';
import DimensionInput from './components/DimensionInput';
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

  const handleDimensionSubmit = async (width: number, height: number) => {
    const formatDimension = (feet: number): string => {
      const wholeF = Math.floor(feet);
      const inches = Math.round((feet - wholeF) * 12);
      if (inches === 0) {
        return `${wholeF}'`;
      }
      return `${wholeF}'${inches}"`;
    };

    const { data, error } = await supabase
      .from('floor_plans')
      .insert({
        width,
        height,
        name: `Floor Plan ${formatDimension(width)} × ${formatDimension(height)}`,
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

  const handleFurnitureDragStart = (template: FurnitureTemplate) => {
    setDraggedTemplate(template);
  };

  if (!floorPlan) {
    return <DimensionInput onSubmit={handleDimensionSubmit} />;
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
