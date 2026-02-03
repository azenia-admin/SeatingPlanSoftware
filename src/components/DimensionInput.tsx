import { useState } from 'react';
import { Ruler } from 'lucide-react';

interface DimensionInputProps {
  onSubmit: (width: number, height: number) => void;
}

export default function DimensionInput({ onSubmit }: DimensionInputProps) {
  const [widthFeet, setWidthFeet] = useState('30');
  const [widthInches, setWidthInches] = useState('0');
  const [heightFeet, setHeightFeet] = useState('24');
  const [heightInches, setHeightInches] = useState('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wf = parseFloat(widthFeet) || 0;
    const wi = parseFloat(widthInches) || 0;
    const hf = parseFloat(heightFeet) || 0;
    const hi = parseFloat(heightInches) || 0;

    const width = wf + wi / 12;
    const height = hf + hi / 12;

    if (width > 0 && height > 0) {
      onSubmit(width, height);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <Ruler className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
          Floor Plan Designer
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Enter your space dimensions to get started
        </p>
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
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition duration-200 shadow-lg hover:shadow-xl"
          >
            Create Floor Plan
          </button>
        </form>
      </div>
    </div>
  );
}
