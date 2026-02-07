import { X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { FurnitureItem } from '../types/furniture';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { updateRowCurvePositions, updateMultiRowCurvePositions } from '../lib/rowCurveUpdate';
import ScrubInput from './ScrubInput';
import { formatLabel, getMaxForFormat } from '../lib/labelFormat';

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
  const [rowLabelFormat, setRowLabelFormat] = useState<string>('numbers');
  const [rowLabelStartAt, setRowLabelStartAt] = useState<number>(1);
  const [rowLabelDir, setRowLabelDir] = useState<string>('ltr');
  const [rowLabelPosition, setRowLabelPosition] = useState<string>('both');
  const [rowDisplayedType, setRowDisplayedType] = useState<string>('Row');
  const [seatLabelFormat, setSeatLabelFormat] = useState<string>('numbers');
  const [seatLabelEnabled, setSeatLabelEnabled] = useState<boolean>(false);
  const [seatLabelStartAt, setSeatLabelStartAt] = useState<number>(1);
  const [seatLabelDir, setSeatLabelDir] = useState<string>('ltr');
  const [seatDisplayedType, setSeatDisplayedType] = useState<string>('Seat');

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
  const curveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCurveUpdate = useCallback((value: number) => {
    if (curveDebounceRef.current) clearTimeout(curveDebounceRef.current);
    curveDebounceRef.current = setTimeout(() => {
      updateCurveProperty(value);
    }, 250);
  }, [selectedItem, groupItems, multiSelectedRowItems, multiSelectedAllItems, isMultiRow]);

  useEffect(() => {
    return () => {
      if (curveDebounceRef.current) clearTimeout(curveDebounceRef.current);
    };
  }, []);

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
      setRowLabelFormat(activeItem.row_label_format || 'numbers');
      setRowLabelStartAt(activeItem.row_label_start_at ?? 1);
      setRowLabelDir(activeItem.row_label_direction || 'ltr');
      setRowLabelPosition(activeItem.row_label_position || 'both');
      setRowDisplayedType(activeItem.row_displayed_type || 'Row');
      setSeatLabelFormat(activeItem.seat_label_format || 'numbers');
      setSeatLabelEnabled(activeItem.seat_label_enabled ?? false);
      setSeatLabelStartAt(activeItem.seat_label_start_at ?? 1);
      setSeatLabelDir(activeItem.seat_label_dir || 'ltr');
      setSeatDisplayedType(activeItem.seat_displayed_type || 'Seat');
    } else if (isRow && activeItem) {
      setSeatCount(activeItem.seat_count || groupItems.filter(i => i.type === 'chair').length);
      setCurve(activeItem.curve || 0);
      setSeatSpacing(activeItem.seat_spacing || 1);
      setRowLabel(activeItem.row_label || '');
      setRowLabelEnabled(activeItem.row_label_enabled ?? true);
      setRowLabelFormat(activeItem.row_label_format || 'numbers');
      setRowLabelStartAt(activeItem.row_label_start_at ?? 1);
      setRowLabelDir(activeItem.row_label_direction || 'ltr');
      setRowLabelPosition(activeItem.row_label_position || 'both');
      setRowDisplayedType(activeItem.row_displayed_type || 'Row');
      setSeatLabelFormat(activeItem.seat_label_format || 'numbers');
      setSeatLabelEnabled(activeItem.seat_label_enabled ?? false);
      setSeatLabelStartAt(activeItem.seat_label_start_at ?? 1);
      setSeatLabelDir(activeItem.seat_label_dir || 'ltr');
      setSeatDisplayedType(activeItem.seat_displayed_type || 'Seat');
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

  const updateCurveProperty = async (value: number) => {
    if (!isSupabaseConfigured) return;

    if (isMultiRow) {
      const allIds = [...multiSelectedRowItems, ...multiSelectedAllItems].map(i => i.id);
      await Promise.all(allIds.map(id =>
        supabase.from('furniture_items').update({ curve: value }).eq('id', id)
      ));

      const floorPlanId = multiSelectedRowItems[0].floor_plan_id;
      const { data: allFurniture } = await supabase
        .from('furniture_items')
        .select('*')
        .eq('floor_plan_id', floorPlanId);

      if (allFurniture) {
        const updatedRows = multiSelectedRowItems.map(row => ({ ...row, curve: value }));
        await updateMultiRowCurvePositions(updatedRows, allFurniture as FurnitureItem[]);
      }
    } else if (selectedItem?.type === 'row') {
      const itemsToUpdate = selectedItem.group_id
        ? groupItems.map(i => i.id)
        : [selectedItem.id];

      await Promise.all(itemsToUpdate.map(id =>
        supabase.from('furniture_items').update({ curve: value }).eq('id', id)
      ));

      const { data: allFurniture } = await supabase
        .from('furniture_items')
        .select('*')
        .eq('floor_plan_id', selectedItem.floor_plan_id);

      if (allFurniture) {
        await updateRowCurvePositions({ ...selectedItem, curve: value }, allFurniture as FurnitureItem[]);
      }
    }

    onUpdate();
  };

  const updateProperty = async (field: string, value: any) => {
    if (field === 'curve') return;

    if (isMultiRow) {
      if (isSupabaseConfigured) {
        const allIds = [...multiSelectedRowItems, ...multiSelectedAllItems].map(i => i.id);
        await Promise.all(allIds.map(id =>
          supabase.from('furniture_items').update({ [field]: value }).eq('id', id)
        ));
      }
      onUpdate();
      return;
    }

    if (!selectedItem) return;

    const itemsToUpdate = selectedItem.group_id
      ? groupItems.map(i => i.id)
      : [selectedItem.id];

    if (isSupabaseConfigured) {
      await Promise.all(itemsToUpdate.map(id =>
        supabase.from('furniture_items').update({ [field]: value }).eq('id', id)
      ));
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
                  <ScrubInput
                    value={curve}
                    onChange={(val) => {
                      setCurve(val);
                      debouncedCurveUpdate(val);
                    }}
                    min={0}
                    max={30}
                    step={0.1}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Seat spacing</span>
                  <ScrubInput
                    value={seatSpacing}
                    onChange={(val) => {
                      setSeatSpacing(val);
                      updateProperty('seat_spacing', val);
                    }}
                    min={0.1}
                    max={10}
                    step={0.1}
                    suffix="pt"
                  />
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
              <h3 className="text-sm font-bold text-gray-900 mb-2">Row labeling</h3>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Enabled</span>
                  <input
                    type="checkbox"
                    checked={rowLabelEnabled}
                    onChange={(e) => {
                      setRowLabelEnabled(e.target.checked);
                      updateProperty('row_label_enabled', e.target.checked);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Labels</span>
                  <select
                    value={rowLabelFormat}
                    onChange={(e) => {
                      const newFormat = e.target.value;
                      const max = getMaxForFormat(newFormat);
                      setRowLabelFormat(newFormat);
                      updateProperty('row_label_format', newFormat);
                      if (rowLabelStartAt > max) {
                        setRowLabelStartAt(1);
                        updateProperty('row_label_start_at', 1);
                      }
                    }}
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="numbers">1, 2, 3...</option>
                    <option value="LETTERS">A, B, C...</option>
                    <option value="letters">a, b, c...</option>
                    <option value="ROMAN">I, II, III...</option>
                    <option value="roman">i, ii, iii...</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Start at</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const next = Math.max(1, rowLabelStartAt - 1);
                        setRowLabelStartAt(next);
                        updateProperty('row_label_start_at', next);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-xs"
                    >
                      &lt;
                    </button>
                    {rowLabelFormat === 'numbers' ? (
                      <input
                        type="number"
                        value={rowLabelStartAt}
                        onChange={(e) => {
                          const max = getMaxForFormat(rowLabelFormat);
                          const val = Math.min(max, Math.max(1, parseInt(e.target.value) || 1));
                          setRowLabelStartAt(val);
                          updateProperty('row_label_start_at', val);
                        }}
                        className="w-14 text-center text-sm border border-gray-300 rounded py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min={1}
                      />
                    ) : (
                      <span className="w-14 text-center text-sm border border-gray-300 rounded py-1 inline-block bg-white select-none">
                        {formatLabel(rowLabelStartAt, rowLabelFormat)}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const max = getMaxForFormat(rowLabelFormat);
                        const next = Math.min(max, rowLabelStartAt + 1);
                        setRowLabelStartAt(next);
                        updateProperty('row_label_start_at', next);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-xs"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Direction</span>
                  <button
                    onClick={() => {
                      const next = rowLabelDir === 'ltr' ? 'rtl' : 'ltr';
                      setRowLabelDir(next);
                      updateProperty('row_label_direction', next);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 transition"
                    title={rowLabelDir === 'ltr' ? 'Left to right' : 'Right to left'}
                  >
                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-600 ${rowLabelDir === 'rtl' ? 'scale-x-[-1]' : ''}`}>
                      <path d="M2 8h16M14 3l4 5-4 5" />
                      <line x1="6" y1="3" x2="2" y2="8" />
                      <line x1="2" y1="8" x2="6" y2="13" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Position</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const hasLeft = rowLabelPosition === 'left' || rowLabelPosition === 'both';
                        const hasRight = rowLabelPosition === 'right' || rowLabelPosition === 'both';
                        let next: string;
                        if (hasLeft) {
                          next = hasRight ? 'right' : 'none';
                        } else {
                          next = hasRight ? 'both' : 'left';
                        }
                        setRowLabelPosition(next);
                        updateProperty('row_label_position', next);
                      }}
                      className={`min-w-[24px] h-6 px-1.5 rounded text-xs font-medium transition ${
                        rowLabelPosition === 'left' || rowLabelPosition === 'both'
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {rowLabelFormat === 'numbers' ? '1' : rowLabelFormat === 'LETTERS' ? 'A' : rowLabelFormat === 'letters' ? 'a' : rowLabelFormat === 'ROMAN' ? 'I' : 'i'}
                    </button>
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const hasLeft = rowLabelPosition === 'left' || rowLabelPosition === 'both';
                        const hasRight = rowLabelPosition === 'right' || rowLabelPosition === 'both';
                        let next: string;
                        if (hasRight) {
                          next = hasLeft ? 'left' : 'none';
                        } else {
                          next = hasLeft ? 'both' : 'right';
                        }
                        setRowLabelPosition(next);
                        updateProperty('row_label_position', next);
                      }}
                      className={`min-w-[24px] h-6 px-1.5 rounded text-xs font-medium transition ${
                        rowLabelPosition === 'right' || rowLabelPosition === 'both'
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {rowLabelFormat === 'numbers' ? '1' : rowLabelFormat === 'LETTERS' ? 'A' : rowLabelFormat === 'letters' ? 'a' : rowLabelFormat === 'ROMAN' ? 'I' : 'i'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Displayed type</span>
                  <input
                    type="text"
                    value={rowDisplayedType}
                    onChange={(e) => {
                      setRowDisplayedType(e.target.value);
                      updateProperty('row_displayed_type', e.target.value || 'Row');
                    }}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Seat labeling</h3>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Enabled</span>
                  <input
                    type="checkbox"
                    checked={seatLabelEnabled}
                    onChange={(e) => {
                      setSeatLabelEnabled(e.target.checked);
                      updateProperty('seat_label_enabled', e.target.checked);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Labels</span>
                  <select
                    value={seatLabelFormat}
                    onChange={(e) => {
                      const newFormat = e.target.value;
                      const max = getMaxForFormat(newFormat);
                      setSeatLabelFormat(newFormat);
                      updateProperty('seat_label_format', newFormat);
                      if (seatLabelStartAt > max) {
                        setSeatLabelStartAt(1);
                        updateProperty('seat_label_start_at', 1);
                      }
                    }}
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="numbers">1, 2, 3...</option>
                    <option value="LETTERS">A, B, C...</option>
                    <option value="letters">a, b, c...</option>
                    <option value="ROMAN">I, II, III...</option>
                    <option value="roman">i, ii, iii...</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Start at</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const next = Math.max(1, seatLabelStartAt - 1);
                        setSeatLabelStartAt(next);
                        updateProperty('seat_label_start_at', next);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-xs"
                    >
                      &lt;
                    </button>
                    {seatLabelFormat === 'numbers' ? (
                      <input
                        type="number"
                        value={seatLabelStartAt}
                        onChange={(e) => {
                          const max = getMaxForFormat(seatLabelFormat);
                          const val = Math.min(max, Math.max(1, parseInt(e.target.value) || 1));
                          setSeatLabelStartAt(val);
                          updateProperty('seat_label_start_at', val);
                        }}
                        className="w-14 text-center text-sm border border-gray-300 rounded py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min={1}
                      />
                    ) : (
                      <span className="w-14 text-center text-sm border border-gray-300 rounded py-1 inline-block bg-white select-none">
                        {formatLabel(seatLabelStartAt, seatLabelFormat)}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const max = getMaxForFormat(seatLabelFormat);
                        const next = Math.min(max, seatLabelStartAt + 1);
                        setSeatLabelStartAt(next);
                        updateProperty('seat_label_start_at', next);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 text-xs"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Direction</span>
                  <button
                    onClick={() => {
                      const next = seatLabelDir === 'ltr' ? 'rtl' : 'ltr';
                      setSeatLabelDir(next);
                      updateProperty('seat_label_dir', next);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 transition"
                    title={seatLabelDir === 'ltr' ? 'Left to right' : 'Right to left'}
                  >
                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-600 ${seatLabelDir === 'rtl' ? 'scale-x-[-1]' : ''}`}>
                      <path d="M2 8h16M14 3l4 5-4 5" />
                      <line x1="6" y1="3" x2="2" y2="8" />
                      <line x1="2" y1="8" x2="6" y2="13" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">Displayed type</span>
                  <input
                    type="text"
                    value={seatDisplayedType}
                    onChange={(e) => {
                      setSeatDisplayedType(e.target.value);
                      updateProperty('seat_displayed_type', e.target.value || 'Seat');
                    }}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <ScrubInput
                    value={openSpaces}
                    onChange={(val) => {
                      setOpenSpaces(val);
                      updateProperty('open_spaces', val);
                    }}
                    min={0}
                    max={20}
                    step={1}
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
                <ScrubInput
                  value={rotation}
                  onChange={(val) => {
                    setRotation(val);
                    updateProperty('rotation', val);
                  }}
                  min={-360}
                  max={360}
                  step={1}
                  suffix="°"
                />
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
                  <ScrubInput
                    value={seatLabelStart}
                    onChange={(val) => {
                      setSeatLabelStart(val);
                      updateProperty('seat_label_start', val);
                    }}
                    min={1}
                    max={999}
                    step={1}
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
