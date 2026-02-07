import { useState, useEffect, useCallback } from 'react';
import { Settings, ArrowLeft, Calendar } from 'lucide-react';
import GridCanvas from './components/GridCanvas';
import FurniturePalette from './components/FurniturePalette';
import DimensionSettings from './components/DimensionSettings';
import PropertiesSidebar from './components/PropertiesSidebar';
import type { FurnitureTemplate, FurnitureItem } from './types/furniture';
import { supabase, isSupabaseConfigured } from './lib/supabase';

interface EventData {
  id: string;
  title: string;
  event_date: string | null;
  created_by: string;
}

type AppError = 'missing-event-id' | 'not-authenticated' | 'event-not-found' | 'not-authorized' | 'load-failed';

function App() {
  const [eventId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('eventId');
  });
  const [returnUrl] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('returnUrl');
  });

  const [event, setEvent] = useState<EventData | null>(null);
  const [layout, setLayout] = useState<{
    id: string;
    width: number;
    height: number;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const [draggedTemplate, setDraggedTemplate] = useState<FurnitureTemplate | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [placementMode, setPlacementMode] = useState<'none' | 'single' | 'row' | 'custom-row' | 'multi-row' | 'marquee'>('none');
  const [rowChairCount, setRowChairCount] = useState<number | null>(null);
  const [sidebarSelectedItem, setSidebarSelectedItem] = useState<FurnitureItem | null>(null);
  const [sidebarGroupItems, setSidebarGroupItems] = useState<FurnitureItem[]>([]);
  const [furnitureRefreshKey, setFurnitureRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIndividualId, setSelectedIndividualId] = useState<string | null>(null);
  const [multiSelectedRowItems, setMultiSelectedRowItems] = useState<FurnitureItem[]>([]);
  const [multiSelectedAllItems, setMultiSelectedAllItems] = useState<FurnitureItem[]>([]);

  useEffect(() => {
    if (!eventId) {
      setError('missing-event-id');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setEvent({ id: eventId, title: 'Demo Event', event_date: null, created_by: '' });
      setLayout({ id: 'temp-local-id', width: 90, height: 90, status: 'draft' });
      setLoading(false);
      return;
    }

    loadEventAndLayout(eventId);
  }, [eventId]);

  const loadEventAndLayout = async (eid: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('not-authenticated');
      setLoading(false);
      return;
    }

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eid)
      .maybeSingle();

    if (eventError || !eventData) {
      setError('event-not-found');
      setLoading(false);
      return;
    }

    if (eventData.created_by !== user.id) {
      setError('not-authorized');
      setLoading(false);
      return;
    }

    setEvent(eventData);

    const { data: layoutData } = await supabase
      .from('layouts')
      .select('*')
      .eq('event_id', eid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (layoutData) {
      setLayout({
        id: layoutData.id,
        width: layoutData.width,
        height: layoutData.height,
        status: layoutData.status,
      });
    } else {
      const { data: newLayout, error: createError } = await supabase
        .from('layouts')
        .insert({ event_id: eid })
        .select()
        .single();

      if (createError || !newLayout) {
        setError('load-failed');
        setLoading(false);
        return;
      }

      setLayout({
        id: newLayout.id,
        width: newLayout.width,
        height: newLayout.height,
        status: newLayout.status,
      });
    }

    setLoading(false);
  };

  const handleFurnitureDragStart = (template: FurnitureTemplate) => {
    setDraggedTemplate(template);
  };

  const handleActivatePlacementMode = (mode: 'single' | 'row' | 'custom-row' | 'multi-row' | 'marquee', chairCount?: number) => {
    setPlacementMode(mode);
    setRowChairCount(chairCount ?? null);
  };

  const handleDeactivatePlacementMode = () => {
    setPlacementMode('none');
    setRowChairCount(null);
  };

  const handleSelectionChange = useCallback((selectedItem: FurnitureItem | null, groupItems: FurnitureItem[], itemSelectedId: string | null, itemSelectedIndividualId: string | null) => {
    setSelectedId(itemSelectedId);
    setSelectedIndividualId(itemSelectedIndividualId);
    if (selectedItem && (selectedItem.type === 'row' || selectedItem.type === 'table')) {
      setSidebarSelectedItem(selectedItem);
      setSidebarGroupItems(groupItems);
    } else {
      setSidebarSelectedItem(null);
      setSidebarGroupItems([]);
    }
  }, []);

  const handleMultiSelectionChange = useCallback((rowItems: FurnitureItem[], allItems: FurnitureItem[]) => {
    setMultiSelectedRowItems(rowItems);
    setMultiSelectedAllItems(allItems);
    setSidebarSelectedItem(null);
    setSidebarGroupItems([]);
  }, []);

  const handleClearSelection = () => {
    setSelectedId(null);
    setSelectedIndividualId(null);
    setSidebarSelectedItem(null);
    setSidebarGroupItems([]);
    setMultiSelectedRowItems([]);
    setMultiSelectedAllItems([]);
  };

  const handleSidebarUpdate = () => {
    setFurnitureRefreshKey(prev => prev + 1);
  };

  const handleDimensionUpdate = async (width: number, height: number) => {
    if (!layout) return;

    const formatDimension = (feet: number): string => {
      const wholeF = Math.floor(feet);
      const inches = Math.round((feet - wholeF) * 12);
      if (inches === 0) return `${wholeF}'`;
      return `${wholeF}'${inches}"`;
    };

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from('layouts')
        .update({
          width,
          height,
          name: `Layout ${formatDimension(width)} x ${formatDimension(height)}`,
        })
        .eq('id', layout.id);

      if (updateError) {
        console.error('Error updating layout:', updateError);
        return;
      }

      const { data: layoutItems } = await supabase
        .from('layout_items')
        .select('*')
        .eq('layout_id', layout.id);

      if (layoutItems) {
        for (const item of layoutItems) {
          const newX = Math.max(0, Math.min(item.x, width - item.width));
          const newY = Math.max(0, Math.min(item.y, height - item.height));

          if (newX !== item.x || newY !== item.y) {
            await supabase
              .from('layout_items')
              .update({ x: newX, y: newY })
              .eq('id', item.id);
          }
        }
      }
    }

    setLayout({ ...layout, width, height });
  };

  const handleLayoutStatusChange = (status: string) => {
    if (layout) {
      setLayout({ ...layout, status });
    }
  };

  const formatEventDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const messages: Record<AppError, { title: string; detail: string }> = {
      'missing-event-id': {
        title: 'No Event Selected',
        detail: 'This designer must be opened from an event.',
      },
      'not-authenticated': {
        title: 'Not Signed In',
        detail: 'Please sign in to access the layout designer.',
      },
      'event-not-found': {
        title: 'Event Not Found',
        detail: 'The event you are looking for does not exist or has been removed.',
      },
      'not-authorized': {
        title: 'Access Denied',
        detail: 'You do not have permission to edit this event\'s layout.',
      },
      'load-failed': {
        title: 'Failed to Load',
        detail: 'Something went wrong while loading the layout. Please try again.',
      },
    };

    const msg = messages[error];

    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center px-6">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gray-100 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{msg.title}</h1>
          <p className="text-sm text-gray-500 mb-6">{msg.detail}</p>
          {returnUrl && (
            <a
              href={returnUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Event
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!layout || !event) return null;

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col">
      {!isSupabaseConfigured && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-center">
          <p className="text-sm text-yellow-800">
            Running in demo mode - Changes will not be saved
          </p>
        </div>
      )}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 flex-shrink-0">
        {returnUrl && (
          <a
            href={returnUrl}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition mr-1"
            title="Back to Event"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 truncate">{event.title}</h1>
          {event.event_date && (
            <span className="text-sm text-gray-500 whitespace-nowrap flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatEventDate(event.event_date)}
            </span>
          )}
          {layout.status === 'published' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full whitespace-nowrap">
              Published
            </span>
          )}
          {layout.status === 'draft' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">
              Draft
            </span>
          )}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            Dimensions
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        <FurniturePalette
          onDragStart={handleFurnitureDragStart}
          onActivatePlacementMode={handleActivatePlacementMode}
          onDeactivatePlacementMode={handleDeactivatePlacementMode}
          placementMode={placementMode}
          rowChairCount={rowChairCount}
        />
        <div className="flex-1 overflow-hidden min-w-0">
          <GridCanvas
            width={layout.width}
            height={layout.height}
            refreshKey={furnitureRefreshKey}
            layoutId={layout.id}
            eventId={event.id}
            draggedTemplate={draggedTemplate}
            onTemplatePlaced={() => setDraggedTemplate(null)}
            placementMode={placementMode}
            rowChairCount={rowChairCount}
            onDeactivatePlacementMode={handleDeactivatePlacementMode}
            onSelectionChange={handleSelectionChange}
            onMultiSelectionChange={handleMultiSelectionChange}
            selectedId={selectedId}
            selectedIndividualId={selectedIndividualId}
            onClearSelection={handleClearSelection}
            onLayoutStatusChange={handleLayoutStatusChange}
          />
        </div>
        {(sidebarSelectedItem || multiSelectedRowItems.length > 0) && (
          <PropertiesSidebar
            selectedItem={sidebarSelectedItem}
            groupItems={sidebarGroupItems}
            multiSelectedRowItems={multiSelectedRowItems}
            multiSelectedAllItems={multiSelectedAllItems}
            onClose={handleClearSelection}
            onUpdate={handleSidebarUpdate}
          />
        )}
      </div>
      {showSettings && (
        <DimensionSettings
          currentWidth={layout.width}
          currentHeight={layout.height}
          onUpdate={handleDimensionUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
