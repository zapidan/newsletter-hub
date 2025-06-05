// Requires: npm install @headlessui/react
import React, { useState, FormEvent, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { NewsletterSource } from '../types';
import { PlusCircle, AlertTriangle, Loader2, ArrowLeft, Trash2, Edit, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import NewsletterCard from '../components/NewsletterCard';
import { useNavigate } from 'react-router-dom';

// Debug styles - can be removed after confirming buttons work
const debugStyles = {
  button: 'border-2 border-red-500',
  text: 'text-black',
  bg: 'bg-white',
};

const NewslettersPage: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();
  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    addNewsletterSource,
    deleteNewsletterSource,
    isDeletingSource,
    updateNewsletterSource,
    isUpdatingSource,
    isSuccessUpdatingSource,
    isAddingSource,
    isErrorAddingSource,
    errorAddingSource,
    isSuccessAddingSource,
  } = useNewsletterSources();

  const [formData, setFormData] = useState({
    name: '',
    domain: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear form
  const resetForm = useCallback(() => {
    setFormData({ name: '', domain: '' });
    setEditingId(null);
  }, []);

  // Handle edit
  const handleEdit = (source: NewsletterSource) => {
    setFormData({
      name: source.name,
      domain: source.domain
    });
    setEditingId(source.id);
    setShowAddModal(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    resetForm();
  };

  // Handle delete with confirmation
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this source? This action cannot be undone.')) {
      try {
        await deleteNewsletterSource(id);
        toast.success('Source deleted successfully');
      } catch (error) {
        toast.error('Failed to delete source');
      }
    }
  };

  // Reset form on successful add/update
  React.useEffect(() => {
    if (isSuccessAddingSource || isSuccessUpdatingSource) {
      resetForm();
      const message = isSuccessAddingSource ? 'Source added successfully' : 'Source updated successfully';
      toast.success(message);
    }
  }, [isSuccessAddingSource, isSuccessUpdatingSource, resetForm]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.name.trim() || !formData.domain.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      if (editingId) {
        await updateNewsletterSource({ 
          id: editingId, 
          name: formData.name, 
          domain: formData.domain 
        });
      } else {
        await addNewsletterSource({ 
          name: formData.name, 
          domain: formData.domain 
        });
      }
      setShowAddModal(false); // Close modal on success
      resetForm(); // Reset the form
    } catch (error) {
      // Error handling is done by the mutation
      console.error('Error submitting form:', error);
    }
  };

  // State for selected source
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Fetch newsletters for the selected source
  const {
    data: newslettersForSource = [],
    isLoading: isLoadingNewslettersForSource,
    isError: isErrorNewslettersForSource,
    error: errorNewslettersForSource,
  } = useQuery<{ id: string }[]>({
    queryKey: ['newslettersBySource', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId) return [];
      const { data, error } = await supabase
        .from('newsletters')
        .select(`*, newsletter_tags ( tag:tags (id, name, color) ), newsletter_source_id`)
        .eq('newsletter_source_id', selectedSourceId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      // Transform tags to match NewsletterCard expectations
      return (data || []).map((item: any) => ({
        ...item,
        tags: (item.newsletter_tags || []).map((nt: any) => nt.tag)
      }));
    },
    enabled: !!selectedSourceId
  });

  return (
    <main className="max-w-4xl w-full mx-auto p-6">
      <button
        onClick={() => window.history.back()}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inbox
      </button>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary-900">Manage Newsletter Sources</h1>
        <p className="text-gray-600 mt-1">
          Define your newsletter sources by name and their primary email domain.
        </p>
      </header>

      {/* Add New Source Button and Modal */}
      <div className="mb-8 flex justify-end">
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: 600,
            borderRadius: '0.375rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            border: '1px solid #1d4ed8',
          }}
          onClick={() => setShowAddModal(true)}
        >
          <PlusCircle className="mr-2 h-5 w-5" style={{ color: 'white' }} />
          <span>Add Source</span>
        </button>
      </div>
      
      <Transition.Root show={showAddModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-30 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    {editingId ? 'Edit Newsletter Source' : 'Add Newsletter Source'}
                  </Dialog.Title>
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        id="name"
                        className="w-full rounded-md border border-gray-300 p-2 focus:ring focus:ring-blue-200"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                      <input
                        type="text"
                        id="domain"
                        className="w-full rounded-md border border-gray-300 p-2 focus:ring focus:ring-blue-200"
                        value={formData.domain}
                        onChange={e => setFormData({ ...formData, domain: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 1rem',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          fontWeight: 600,
                          borderRadius: '0.375rem',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          border: '1px solid #1d4ed8',
                          opacity: (isAddingSource || isUpdatingSource) ? 0.6 : 1,
                          cursor: (isAddingSource || isUpdatingSource) ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isAddingSource || isUpdatingSource}
                      >
                        {editingId ? 
                          <Check className="mr-2 h-4 w-4" style={{ color: 'white' }} /> : 
                          <PlusCircle className="mr-2 h-4 w-4" style={{ color: 'white' }} />
                        }
                        <span>{editingId ? 'Update Source' : 'Add Source'}</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
                        onClick={() => setShowAddModal(false)}
                        disabled={isAddingSource || isUpdatingSource}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
                          onClick={handleCancelEdit}
                          disabled={isAddingSource || isUpdatingSource}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                  {/* Error State */}
                  {isErrorAddingSource && errorAddingSource && (
                    <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md mt-4">
                      <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                      <span>Error: {errorAddingSource.message}</span>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Existing Sources List */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-primary-800">Existing Sources</h2>
        {/* Display loading state for the list */}
        {isLoadingSources && (
          <div className="flex items-center justify-center text-gray-500 py-6">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span>Loading sources...</span>
          </div>
        )}
        {/* Display error state for the list */}
        {isErrorSources && errorSources && (
          <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
            <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
            <span>Error loading sources: {errorSources.message}</span>
          </div>
        )}
        {/* Display if no sources and not loading/error */}
        {!isLoadingSources && !isErrorSources && newsletterSources.length === 0 && (
          <p className="text-gray-500 italic">No newsletter sources defined yet. Add one above!</p>
        )}
        {/* Display the list if data is available */}
        {!isLoadingSources && !isErrorSources && newsletterSources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 p-2">
            {newsletterSources.map((source: NewsletterSource) => (
              <div
                key={source.id}
                className={`group relative cursor-pointer rounded-xl border transition-colors shadow-sm p-6 bg-white hover:border-blue-300 hover:shadow-md ${selectedSourceId === source.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-neutral-200'}`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="truncate font-semibold text-lg text-neutral-900 max-w-[160px]">{source.name}</span>
                  <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); handleEdit(source); }}
                      className="p-2 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      disabled={isDeletingSource || isUpdatingSource}
                      title="Edit Source"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(source.id); }}
                      className="p-2 rounded hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-50"
                      disabled={isDeletingSource || isUpdatingSource}
                      title="Delete Source"
                    >
                      {isDeletingSource ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
                {/* Small logo/preview icon placeholder */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Try favicon, fallback to first letter */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}`}
                    alt={source.name}
                    className="w-6 h-6 rounded-full border border-gray-200 bg-white object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="inline-block w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                    {source.name?.[0] || '?'}
                  </span>
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium rounded-full px-3 py-1">{source.domain}</span>
                </div>
                <div className="text-xs text-neutral-500 mb-2">Added {new Date(source.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Newsletters for selected source */}
      {selectedSourceId && (
        <section className="mt-12">
          <h3 className="text-lg font-semibold mb-4 text-primary-800">Newsletters from this Source</h3>
          {isLoadingNewslettersForSource ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="animate-spin mr-2" /> Loading newsletters...
            </div>
          ) : isErrorNewslettersForSource ? (
            <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
              <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
              <span>Error loading newsletters: {errorNewslettersForSource?.message}</span>
            </div>
          ) : newslettersForSource.length === 0 ? (
            <p className="text-gray-500 italic">No newsletters found for this source.</p>
          ) : (
            <div className="flex gap-2 p-2">
              {newslettersForSource.slice(0, 3).map((newsletter: any) => (
  <div key={newsletter.id} className="w-28 cursor-pointer" onClick={() => navigate(`/inbox/${newsletter.id}`)}>
    <NewsletterCard 
      newsletter={{ ...newsletter, source: newsletter.source || newsletterSources.find((s: any) => s.id === newsletter.newsletter_source_id) || newsletterSources.find((s: any) => s.id === selectedSourceId) }} 
      showBookmark={false} 
      showArchiveButton={false} 
      showSource={true}
    />
  </div>
))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default NewslettersPage;
