import React, { useState, FormEvent } from 'react';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { NewsletterSource } from '../types';
import { PlusCircle, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';

const NewslettersPage: React.FC = () => {
  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    addNewsletterSource, // This is the mutate function
    isAddingSource,
    isErrorAddingSource,
    errorAddingSource,
    isSuccessAddingSource,
  } = useNewsletterSources();

  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');

  // Clear form on successful submission
  React.useEffect(() => {
    if (isSuccessAddingSource) {
      setNewName('');
      setNewDomain('');
    }
  }, [isSuccessAddingSource]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Client-side validation can still be useful for immediate feedback
    // or rely on the mutation's error handling as addNewsletterSourceFn throws an error for empty fields.
    if (!newName.trim() || !newDomain.trim()) {
        // Forcing an error to be shown by the mutation's error state, 
        // or you could set a local form error state here for non-mutation related errors.
        addNewsletterSource({ name: newName, domain: newDomain }); // This will likely fail and set errorAddingSource
        return;
    }
    addNewsletterSource({ name: newName, domain: newDomain });
  };

  // TODO: Implement delete functionality if needed
  // const handleDelete = async (sourceId: string) => {
  //   console.log('Delete source:', sourceId);
  //   // Call a delete function from the hook if implemented
  // };

  return (
    <div className="max-w-4xl w-full mx-auto p-6">
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

      {/* Add New Source Form */}
      <section className="mb-10 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary-800">Add New Source</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newsletterName" className="block text-sm font-medium text-gray-700 mb-1">
              Newsletter Name
            </label>
            <input
              type="text"
              id="newsletterName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Tech Weekly Digest"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              disabled={isAddingSource} // Use isAddingSource from the hook
            />
          </div>
          <div>
            <label htmlFor="emailDomain" className="block text-sm font-medium text-gray-700 mb-1">
              Email Domain
            </label>
            <input
              type="text"
              id="emailDomain"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., example.com (not an email address)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              disabled={isAddingSource} // Use isAddingSource from the hook
            />
             <p className="mt-1 text-xs text-gray-500">Enter the main domain, like 'newsletter.com', not 'contact@newsletter.com'.</p>
          </div>
          
          {/* Display error from adding source mutation */}
          {isErrorAddingSource && errorAddingSource && (
            <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md">
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              <span>{errorAddingSource.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isAddingSource || isLoadingSources} // Use states from the hook
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isAddingSource ? (
              <Loader2 size={20} className="animate-spin mr-2" />
            ) : (
              <PlusCircle size={20} className="mr-2" />
            )}
            Add Source
          </button>
        </form>
      </section>

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
          <div className="overflow-hidden bg-white border border-neutral-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Domain
                  </th>
                  {/* <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th> */}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {newsletterSources.map((source: NewsletterSource) => (
                  <tr key={source.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      <div className="flex items-center">
                        <span className="truncate max-w-[200px]">{source.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {source.domain}
                        </span>
                      </div>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => handleDelete(source.id)}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        // disabled // Enable when delete is implemented
                        title="Delete Source (coming soon)"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default NewslettersPage;
