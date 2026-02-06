import { useState } from 'react';
import {
  MousePointer2,
  LayoutGrid,
  RectangleHorizontal,
  Circle,
  Square,
  Triangle,
  Users,
  Type,
  Image,
  PenTool,
  ChevronRight,
  Armchair,
  BoxSelect
} from 'lucide-react';
import type { FurnitureTemplate } from '../types/furniture';

interface FurniturePaletteProps {
  onDragStart: (template: FurnitureTemplate) => void;
  onActivatePlacementMode: (mode: 'single' | 'row' | 'custom-row' | 'multi-row' | 'marquee', chairCount?: number) => void;
  onDeactivatePlacementMode: () => void;
  placementMode: 'none' | 'single' | 'row' | 'custom-row' | 'multi-row' | 'marquee';
  rowChairCount: number | null;
}

const formatDimension = (feet: number): string => {
  const wholeF = Math.floor(feet);
  const inches = Math.round((feet - wholeF) * 12);
  if (inches === 0) {
    return `${wholeF}'`;
  }
  return `${wholeF}'${inches}"`;
};

const rowTemplates: FurnitureTemplate[] = [
  { type: 'row', width: 5, height: 1.67, label: 'Row of 3', chairs: 3 },
  { type: 'row', width: 6.67, height: 1.67, label: 'Row of 4', chairs: 4 },
  { type: 'row', width: 8.33, height: 1.67, label: 'Row of 5', chairs: 5 },
  { type: 'row', width: 10, height: 1.67, label: 'Row of 6', chairs: 6 },
  { type: 'row', width: 13.33, height: 1.67, label: 'Row of 8', chairs: 8 },
  { type: 'row', width: 16.67, height: 1.67, label: 'Row of 10', chairs: 10 },
];

const rectangularTables: FurnitureTemplate[] = [
  { type: 'table', width: 4, height: 2.67, label: 'Small Rectangle' },
  { type: 'table', width: 6, height: 3, label: 'Medium Rectangle' },
  { type: 'table', width: 8, height: 4, label: 'Large Rectangle' },
  { type: 'table', width: 10, height: 3, label: 'Conference Table' },
  { type: 'table', width: 4, height: 4, label: 'Square Table' },
];

const circularTables: FurnitureTemplate[] = [
  { type: 'table', width: 3, height: 3, label: 'Small Circle' },
  { type: 'table', width: 4, height: 4, label: 'Medium Circle' },
  { type: 'table', width: 5, height: 5, label: 'Large Circle' },
  { type: 'table', width: 6, height: 6, label: 'XL Circle' },
];

type Tool = 'select' | 'marquee' | 'row' | 'table' | 'shapes' | 'people' | 'text' | 'draw';

export default function FurniturePalette({ onDragStart, onActivatePlacementMode, onDeactivatePlacementMode, placementMode, rowChairCount }: FurniturePaletteProps) {
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [expandedPanel, setExpandedPanel] = useState<Tool | null>(null);

  const tools = [
    { id: 'select' as Tool, icon: MousePointer2, label: 'Select', hasPanel: false },
    { id: 'marquee' as Tool, icon: BoxSelect, label: 'Marquee Select', hasPanel: false },
    { id: 'row' as Tool, icon: LayoutGrid, label: 'Rows', hasPanel: true },
    { id: 'table' as Tool, icon: RectangleHorizontal, label: 'Tables', hasPanel: true },
    { id: 'shapes' as Tool, icon: Square, label: 'Shapes', hasPanel: true },
    { id: 'people' as Tool, icon: Users, label: 'Groups', hasPanel: false },
    { id: 'text' as Tool, icon: Type, label: 'Text', hasPanel: false },
    { id: 'draw' as Tool, icon: PenTool, label: 'Draw', hasPanel: false },
  ];

  const handleToolClick = (tool: Tool) => {
    setActiveTool(tool);
    if (tool === 'row' || tool === 'table' || tool === 'shapes') {
      setExpandedPanel(expandedPanel === tool ? null : tool);
    } else {
      setExpandedPanel(null);
    }

    if (tool === 'select') {
      onDeactivatePlacementMode();
    } else if (tool === 'marquee') {
      onActivatePlacementMode('marquee');
    }
  };

  return (
    <div className="shrink-0 flex bg-white border-r border-gray-200">
      <div className="w-14 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4 gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative group ${
              activeTool === tool.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5" />
            {tool.hasPanel && (
              <ChevronRight className={`w-3 h-3 absolute right-0.5 bottom-0.5 transition-transform ${
                expandedPanel === tool.id ? 'rotate-90' : ''
              }`} />
            )}
          </button>
        ))}

        <div className="flex-1" />

        <div className="text-xs text-gray-500 text-center px-1">
          <div className="font-medium">{activeTool === 'marquee' ? 'Marquee' : 'Select'}</div>
          <div className="text-[10px] leading-tight mt-1">{activeTool === 'marquee' ? 'Drag to select' : 'Click & drag'}</div>
        </div>
      </div>

      {expandedPanel && (
        <div className="w-64 p-4 overflow-y-auto bg-white">
          {expandedPanel === 'row' && (
            <>
              <h3 className="text-sm font-bold text-gray-800 mb-3">Seating Rows</h3>
              <div className="space-y-2">
                <div
                  onClick={() => onActivatePlacementMode('multi-row')}
                  className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                    placementMode === 'multi-row'
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-gray-50 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-purple-700" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-800">Multi Row</div>
                      <div className="text-xs text-gray-500">
                        Click start, click end, move perpendicular for rows
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => onActivatePlacementMode('custom-row')}
                  className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                    placementMode === 'custom-row'
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-gray-50 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-800">Custom Row</div>
                      <div className="text-xs text-gray-500">
                        Click to start, drag to extend, click to place
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => onActivatePlacementMode('single')}
                  className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                    placementMode === 'single'
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-gray-50 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                      <Armchair className="w-5 h-5 text-sky-700" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-800">Single Chair</div>
                      <div className="text-xs text-gray-500">
                        Click to place freely
                      </div>
                    </div>
                  </div>
                </div>

                {rowTemplates.map((template, index) => (
                  <div
                    key={index}
                    onClick={() => onActivatePlacementMode('row', template.chairs)}
                    className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                      placementMode === 'row' && rowChairCount === template.chairs
                        ? 'bg-blue-100 border-blue-500'
                        : 'bg-gray-50 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-100 rounded flex items-center justify-center">
                        <LayoutGrid className="w-5 h-5 text-sky-700" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">{template.label}</div>
                        <div className="text-xs text-gray-500">
                          Click to start, drag to set angle
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {expandedPanel === 'table' && (
            <>
              <h3 className="text-sm font-bold text-gray-800 mb-3">Tables</h3>

              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <Circle className="w-4 h-4" />
                  Circle Tables
                </h4>
                <div className="space-y-2">
                  {circularTables.map((template, index) => (
                    <div
                      key={`circle-${index}`}
                      draggable
                      onDragStart={() => onDragStart(template)}
                      className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 cursor-move hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                          <Circle className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">{template.label}</div>
                          <div className="text-xs text-gray-500">
                            {formatDimension(template.width)} diameter
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <RectangleHorizontal className="w-4 h-4" />
                  Rectangle Tables
                </h4>
                <div className="space-y-2">
                  {rectangularTables.map((template, index) => (
                    <div
                      key={`rect-${index}`}
                      draggable
                      onDragStart={() => onDragStart(template)}
                      className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 cursor-move hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded flex items-center justify-center">
                          <RectangleHorizontal className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">{template.label}</div>
                          <div className="text-xs text-gray-500">
                            {formatDimension(template.width)} × {formatDimension(template.height)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {expandedPanel === 'shapes' && (
            <>
              <h3 className="text-sm font-bold text-gray-800 mb-3">Shapes</h3>
              <div className="space-y-2">
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-3">
                    <Circle className="w-6 h-6 text-gray-700" />
                    <span className="font-medium text-sm text-gray-800">Circle</span>
                  </div>
                </div>
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-3">
                    <Square className="w-6 h-6 text-gray-700" />
                    <span className="font-medium text-sm text-gray-800">Square</span>
                  </div>
                </div>
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-3">
                    <Triangle className="w-6 h-6 text-gray-700" />
                    <span className="font-medium text-sm text-gray-800">Triangle</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
