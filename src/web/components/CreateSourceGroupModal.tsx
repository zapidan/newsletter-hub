import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { NewsletterSource } from '@common/types';
import { useNewsletterSourceGroups } from '@common/hooks/useNewsletterSourceGroups';

interface CreateSourceGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: NewsletterSource[];
  groupToEdit?: {
    id: string;
    name: string;
    sources: NewsletterSource[];
  } | null;
}

export const CreateSourceGroupModal = ({
  isOpen,
  onClose,
  sources,
  groupToEdit
}: CreateSourceGroupModalProps) => {
  const [name, setName] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  const { 
    createGroup, 
    updateGroup, 
    isPending: isSaving 
  } = useNewsletterSourceGroups();

  // Initialize form when opening modal or when groupToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (groupToEdit) {
        setName(groupToEdit.name);
        setSelectedSourceIds(new Set(groupToEdit.sources.map(s => s.id)));
      } else {
        setName('');
        setSelectedSourceIds(new Set());
      }
      setSearchTerm('');
    }
  }, [isOpen, groupToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    
    try {
      if (groupToEdit) {
        await updateGroup.mutateAsync({
          id: groupToEdit.id,
          name: name.trim(),
          sourceIds: Array.from(selectedSourceIds)
        });
      } else {
        await createGroup.mutateAsync({
          name: name.trim(),
          sourceIds: Array.from(selectedSourceIds)
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save group:', error);
    }
  };

  const toggleSource = (sourceId: string) => {
    const newSelected = new Set(selectedSourceIds);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedSourceIds(newSelected);
  };

  const filteredSources = sources.filter(source =>
    source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden p-6 relative"
        style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '32rem',
          maxHeight: '90vh',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10000,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="flex justify-between items-center pb-4 border-b">
          <h2 className="text-xl font-semibold">
            {groupToEdit ? 'Edit Group' : 'Create New Group'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="pt-4 pb-4 space-y-4">
            <div>
              <label htmlFor="group-name" className="block text-base font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border rounded-md text-base"
                placeholder="e.g., Tech News, Personal, etc."
                required
                autoFocus
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-base font-medium text-gray-700">
                  Sources ({selectedSourceIds.size} selected)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm p-2 border rounded-md w-56"
                    placeholder="Search sources..."
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="border rounded-md max-h-72 overflow-y-auto">
                {filteredSources.length > 0 ? (
                  <ul className="divide-y">
                    {filteredSources.map((source) => (
                      <li key={source.id} className="hover:bg-gray-50">
                        <label className="flex items-start px-8 py-4 cursor-pointer">
                          <div className="mt-1">
                            <input
                              type="checkbox"
                              checked={selectedSourceIds.has(source.id)}
                              onChange={() => toggleSource(source.id)}
                              className="h-6 w-6 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                          </div>
                          <div className="ml-14 space-y-2">
                            {/* Increased ml-8 to ml-14 for more padding between checkbox and text */}
                            <div className="text-base font-medium text-gray-900">
                              {source.name}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {source.domain}
                            </div>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-sm text-gray-500">
                    {sources.length === 0 
                      ? 'No sources available. Add some sources first.'
                      : 'No sources match your search.'}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="pt-4 pb-2 bg-gray-50 border-t flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || selectedSourceIds.size === 0 || isSaving}
              className={`px-5 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                (!name.trim() || selectedSourceIds.size === 0) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? (
                'Saving...'
              ) : groupToEdit ? (
                'Update Group'
              ) : (
                <>
                  <Plus className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                  Create Group
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
