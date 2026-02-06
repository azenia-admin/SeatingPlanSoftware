import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { FurnitureItem } from '../types/furniture';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PropertiesSidebarProps {
  selectedItem: FurnitureItem | null;
  groupItems: FurnitureItem[];
  multiSelectedRowItems?: FurnitureItem[];
  multiSelectedAllItems?: FurnitureItem[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function PropertiesSidebar({
  selectedItem,
  groupItems,
  multiSelectedRowItems = [],
  multiSelectedAllItems = [],
  onClose,
  onUpdate,
}: PropertiesSidebarProps) {
  const [category, setCategory] = useState<string>('');
  const [sectionLabel, setSectionLabel] = useState<string>('');

  // Row properties
  const [seatCount, setSeatCount] = useState<number>(0);
  const [curve, setCurve] = useState<number>(0);
  const [seatSpacing, setSeatSpacing] = useState<number>(1);
  const [rowLabel, setRowLabel] = useState<string>('');
  const [rowLabelEnabled, setRowLabelEnabled] = useState<boolean>(true);

  // Table properties
  const [chairCount, setChairCount] = useState<number>(0);
  const [openSpaces, setOpenSpaces] = useState<number>(0);
  const [automaticRadius, setAutomaticRadius] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [tableLabel, setTableLabel] = useState<string>('');
  const [tableLabelVisible, setTableLabelVisible] = useState<boolean>(true);
  const [seatLabelStart, setSeatLabelStart] = useState<number>(1);
  const [seatLabelDirection, setSeatLabelDirection] = useState<string>('clockwise');

  const isMultiRow = multiSelectedRowItems.length > 0;
  const isRow = isMultiRow || selectedItem?.type === 'row';
  const isTable = !isMultiRow && selectedItem?.type === 'table';

  const activeItem = isMultiRow ? multiSelectedRowItems[0] : selectedItem;

  useEffect(() => {
    if (!activeItem) return;

    setCategory(activeItem.category || '');
    setSectionLabel(activeItem.section_label || '');

    if (isMultiRow) {
      const totalSeats = multiSelectedAllItems.filter(i => i.type === 'chair').length;
      setSeatCount(totalSeats);
      setCurve(activeItem.curve || 0);
      setSeatSpacing(activeItem.seat_spacing || 1);
      setRowLabel('');
      setRowLabelEnabled(activeItem.row_label_enabled ?? true);
    } else if (isRow && activeItem) {
      setSeatCount(activeItem.seat_count || groupItems.filter(i => i.type === 'chair').length);
      setCurve(activeItem.curve || 0);
      setSeatSpacing(activeItem.seat_spacing || 1);
      setRowLabel(activeItem.row_label || '');
      setRowLabelEnabled(activeItem.row_label_enabled ?? true);
    }

    if (isTable && activeItem) {
      setChairCount(activeItem.chair_count || groupItems.filter(i => i.type === 'chair').length);
      setOpenSpaces(activeItem.open_spaces || 0);
      setAutomaticRadius(activeItem.automatic_radius ?? true);
      setRotation(activeItem.rotation || 0);
      setTableLabel(activeItem.table_label || '');
      setTableLabelVisible(activeItem.table_label_visible ?? true);
      setSeatLabelStart(activeItem.seat_label_start || 1);
      setSeatLabelDirection(activeItem.seat_label_direction || 'clockwise');
    }
  }, [activeItem, groupItems, multiSelectedRowItems, multiSelectedAllItems, isRow, isTable, isMultiRow]);

  const updateProperty = async (field: string, value: any) => {
    if (isMultiRow) {
      if (isSupabaseConfigured) {
        const allIds = [...multiSelectedRowItems, ...multiSelectedAllItems].map(i => i.id);
        for (const itemId of allIds) {
          await supabase
            .from('furniture_items')
            .update({ [field]: value })
            .eq('id', itemId);
        }
      }
      onUpdate();
      return;
    }

    if (!selectedItem) return;

    const itemsToUpdate = selectedItem.group_id
      ? groupItems.map(i => i.id)
      : [selectedItem.id];

    if (isSupabaseConfigured) {
      for (const itemId of itemsToUpdate) {
        await supabase
          .from('furniture_items')
          .update({ [field]: value })
          .eq('id', itemId);
      }
    }

    onUpdate();
  };

  if (!activeItem) return null;

  return (
    <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {isMultiRow ? `${multiSelectedRowItems.length} Rows` : isRow ? 'Row' : isTable ? 'Table' : 'Item'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Category Section */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              updateProperty('category', e.target.value || null);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No category assigned</option>
            <option value="VIP">VIP</option>
            <option value="General">General</option>
            <option value="Reserved">Reserved</option>
          </select>
        </div>

        {/* Row-specific properties */}
        {isRow && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{isMultiRow ? 'Rows' : 'Row'}</h3>
              <div className="space-y-3">
                {isMultiRow && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Number of rows</span>
                    <span className="text-sm font-medium text-gray-900">{multiSelectedRowItems.length}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{isMultiRow ? 'Total seats' : 'Number of seats'}</span>
                  <span className="text-sm font-medium text-gray-900">{seatCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Curve</span>
                  <input
                    type="number"
                    value={curve}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCurve(val);
                      updateProperty('curve', val);
                    }}
                    className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Seat spacing</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={seatSpacing}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setSeatSpacing(val);
                        updateProperty('seat_spacing', val);
                      }}
                      step="0.1"
                      className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">pt</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Section labeling</h3>
              <input
                type="text"
                value={sectionLabel}
                onChange={(e) => {
                  setSectionLabel(e.target.value);
                  updateProperty('section_label', e.target.value || null);
                }}
                placeholder="Section label"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Row labeling</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rowLabelEnabled}
                    onChange={(e) => {
                      setRowLabelEnabled(e.target.checked);
                      updateProperty('row_label_enabled', e.target.checked);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Enabled</span>
                </label>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={rowLabel}
                    onChange={(e) => {
                      setRowLabel(e.target.value);
                      updateProperty('row_label', e.target.value || null);
                    }}
                    placeholder="Row label"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Table-specific properties */}
        {isTable && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {selectedItem.width === selectedItem.height ? 'Round Table' : 'Table'}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Chairs</span>
                  <span className="text-sm font-medium text-gray-900">{chairCount} chairs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Open spaces</span>
                  <input
                    type="number"
                    value={openSpaces}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setOpenSpaces(val);
                      updateProperty('open_spaces', val);
                    }}
                    className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={automaticRadius}
                    onChange={(e) => {
                      setAutomaticRadius(e.target.checked);
                      updateProperty('automatic_radius', e.target.checked);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Automatic radius</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Shape</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Rotation</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={rotation}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setRotation(val);
                      updateProperty('rotation', val);
                    }}
                    className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">°</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Section labeling</h3>
              <input
                type="text"
                value={sectionLabel}
                onChange={(e) => {
                  setSectionLabel(e.target.value);
                  updateProperty('section_label', e.target.value || null);
                }}
                placeholder="Section label"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Table labeling</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={tableLabel}
                    onChange={(e) => {
                      setTableLabel(e.target.value);
                      updateProperty('table_label', e.target.value || null);
                    }}
                    placeholder="Table label"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tableLabelVisible}
                    onChange={(e) => {
                      setTableLabelVisible(e.target.checked);
                      updateProperty('table_label_visible', e.target.checked);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Visible</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Seat labeling</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start at</label>
                  <input
                    type="number"
                    value={seatLabelStart}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setSeatLabelStart(val);
                      updateProperty('seat_label_start', val);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Direction</label>
                  <select
                    value={seatLabelDirection}
                    onChange={(e) => {
                      setSeatLabelDirection(e.target.value);
                      updateProperty('seat_label_direction', e.target.value);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="clockwise">Clockwise</option>
                    <option value="counterclockwise">Counterclockwise</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
