import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface NewsletterSource {
  id: string;
  name: string;
  // Add other source properties as needed
}

interface SourceFilterDropdownProps {
  sources: NewsletterSource[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  className?: string;
}

export function SourceFilterDropdown({
  sources,
  selectedSourceId,
  onSourceSelect,
  className = ''
}: SourceFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedSource = selectedSourceId 
    ? sources.find(s => s.id === selectedSourceId) 
    : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
          selectedSource
            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <span>
          {selectedSource 
            ? `Source: ${selectedSource.name}` 
            : 'Filter by Source'}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown menu positioned relative to button */}
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200">
            <div className="py-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSourceSelect(null);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm ${
                  !selectedSourceId 
                    ? 'bg-blue-50 text-blue-800 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Sources
              </button>
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSourceSelect(source.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    selectedSourceId === source.id
                      ? 'bg-blue-50 text-blue-800 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {source.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
