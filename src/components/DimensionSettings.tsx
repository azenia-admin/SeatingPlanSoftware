import { useState } from 'react';
import { X } from 'lucide-react';

interface DimensionSettingsProps {
  currentWidth: number;
  currentHeight: number;
  onUpdate: (width: number, height: number) => void;
  onClose: () => void;
}

export default function DimensionSettings({
  currentWidth,
  currentHeight,
  onUpdate,
  onClose,
}: DimensionSettingsProps) {
  const [widthFeet, setWidthFeet] = useState(Math.floor(currentWidth).toString());
  const [widthInches, setWidthInches] = useState(
    Math.round((currentWidth - Math.floor(currentWidth)) * 12).toString()
  );
  const [heightFeet, setHeightFeet] = useState(Math.floor(currentHeight).toString());
  const [heightInches, setHeightInches] = useState(
    Math.round((currentHeight - Math.floor(currentHeight)) * 12).toString()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wf = parseFloat(widthFeet) || 0;
    const wi = parseFloat(widthInches) || 0;
    const hf = parseFloat(heightFeet) || 0;
    const hi = parseFloat(heightInches) || 0;

    const width = wf + wi / 12;
    const height = hf + hi / 12;

    if (width > 0 && height > 0) {
      onUpdate(width, height);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Floor Plan Dimensions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Width
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={widthFeet}
                  onChange={(e) => setWidthFeet(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="feet"
                />
                <span className="text-xs text-gray-500 mt-1 block">feet</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="11.99"
                  value={widthInches}
                  onChange={(e) => setWidthInches(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="inches"
                />
                <span className="text-xs text-gray-500 mt-1 block">inches</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Height
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="feet"
                />
                <span className="text-xs text-gray-500 mt-1 block">feet</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="11.99"
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="inches"
                />
                <span className="text-xs text-gray-500 mt-1 block">inches</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
