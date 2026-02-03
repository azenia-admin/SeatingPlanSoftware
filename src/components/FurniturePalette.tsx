import { Armchair, RectangleHorizontal } from 'lucide-react';
import type { FurnitureTemplate } from '../types/furniture';

interface FurniturePaletteProps {
  onDragStart: (template: FurnitureTemplate) => void;
}

const formatDimension = (feet: number): string => {
  const wholeF = Math.floor(feet);
  const inches = Math.round((feet - wholeF) * 12);
  if (inches === 0) {
    return `${wholeF}'`;
  }
  return `${wholeF}'${inches}"`;
};

const furnitureTemplates: FurnitureTemplate[] = [
  { type: 'table', width: 4, height: 2.67, label: 'Small Table (4\' × 2\'8")' },
  { type: 'table', width: 6, height: 3, label: 'Medium Table (6\' × 3\')' },
  { type: 'table', width: 8, height: 4, label: 'Large Table (8\' × 4\')' },
  { type: 'table', width: 4, height: 4, label: 'Square Table (4\' × 4\')' },
  { type: 'chair', width: 1.67, height: 1.67, label: 'Chair (1\'8" × 1\'8")' },
];

export default function FurniturePalette({ onDragStart }: FurniturePaletteProps) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Furniture</h2>
      <div className="space-y-2">
        {furnitureTemplates.map((template, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => onDragStart(template)}
            className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 cursor-move hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <div className="flex items-center gap-3">
              {template.type === 'table' ? (
                <RectangleHorizontal className="w-6 h-6 text-gray-700" />
              ) : (
                <Armchair className="w-6 h-6 text-gray-700" />
              )}
              <div>
                <div className="font-medium text-gray-800">{template.label}</div>
                <div className="text-xs text-gray-500">
                  {formatDimension(template.width)} × {formatDimension(template.height)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
