import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { Newsletter } from '../hooks/useNewsletters';
import { format } from 'date-fns';
import LoadingScreen from '../components/common/LoadingScreen';

const Search = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Mock data for search results
  const mockSearchResults: Newsletter[] = initialQuery ? [
    {
      id: '1',
      title: 'The Future of AI in Content Processing',
      received_at: new Date().toISOString(),
      is_read: true,
      content: 'Content about AI and machine learning advancements...',
      summary: 'This newsletter discusses the latest trends in AI for content processing and summarization.',
      image_url: '',
      user_id: '1',
      is_liked: false,
      source: {
        id: '1',
        name: 'Tech Insights Weekly',
        domain: 'techinsights.com',
        user_id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      newsletter_source_id: '1',
    },
    {
      id: '2',
      title: 'How Semantic Search is Changing the Game',
      received_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      is_read: false,
      content: 'Content about semantic search technologies...',
      summary: 'An exploration of modern semantic search approaches and their applications.',
      image_url: '',
      user_id: '1',
      is_liked: false,
      source: {
        id: '2',
        name: 'Search Technology Today',
        domain: 'searchtech.com',
        user_id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      newsletter_source_id: '2',
    },
    {
      id: '3',
      title: 'Natural Language Processing Breakthroughs',
      received_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      is_read: true,
      content: 'Content about NLP and language models...',
      summary: 'A summary of recent breakthroughs in natural language processing research.',
      image_url: '',
      user_id: '1',
      is_liked: false,
      source: {
        id: '3',
        name: 'AI Research Roundup',
        domain: 'airesearch.com',
        user_id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      newsletter_source_id: '3',
    }
  ] : [];

  useEffect(() => {
    if (initialQuery) {
      handleSearch();
    }
  }, [initialQuery]);

  const handleSearch = () => {
    if (!query.trim()) return;
    
    setLoading(true);
    
    // Simulate API request
    setTimeout(() => {
      setResults(mockSearchResults);
      setLoading(false);
      setSearchPerformed(true);
      
      // Update URL with search query
      const newUrl = `/search?q=${encodeURIComponent(query)}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }, 800);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearchPerformed(false);
    window.history.pushState({ path: '/search' }, '', '/search');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Search Newsletters</h2>
      
      {/* Search bar */}
      <div className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for topics, newsletters, or keywords..."
            className="input-field pl-10 py-3 pr-10 text-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-neutral-500">
            {searchPerformed && `${results.length} results found`}
          </div>
          
          <button 
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className={`${
              query.trim() && !loading
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
            } px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center`}
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Searching...
              </>
            ) : (
              <>
                <SearchIcon size={16} className="mr-2" />
                Search
              </>
            )}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-neutral-600">Searching newsletters...</p>
          </div>
        </div>
      ) : (
        <>
          {searchPerformed && (
            <>
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                    <SearchIcon size={24} className="text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-800 mb-2">No results found</h3>
                  <p className="text-neutral-500 max-w-md mx-auto">
                    We couldn't find any newsletters matching your search. Try using different keywords or check your spelling.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-medium">Search Results</h3>
                    <button className="ml-auto flex items-center text-sm text-neutral-600 hover:text-neutral-800">
                      <Filter size={14} className="mr-1" />
                      Filter
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        className="card cursor-pointer hover:shadow transition-all"
                        onClick={() => window.location.href = `/inbox/${result.id}`}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="text-lg font-medium">{result.title}</h3>
                            <span className="text-sm text-neutral-500">
                              {format(new Date(result.received_at), 'MMM d')}
                            </span>
                          </div>
                          <div className="text-sm text-neutral-500 mb-2">
                            {result.source?.name || 'Unknown Source'}
                            {result.source?.domain && (
                              <span className="text-gray-400 ml-2">• {result.source.domain}</span>
                            )}
                          </div>
                          <p className="text-neutral-700">{result.summary}</p>
                          
                          <div className="mt-3 pt-3 border-t border-neutral-200">
                            <div className="text-sm text-neutral-600">
                              <span className="font-medium">Matching contexts:</span> AI technology, content processing, summarization
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      
      {!searchPerformed && !loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
            <SearchIcon size={24} className="text-neutral-400" />
          </div>
          <h3 className="text-lg font-medium text-neutral-800 mb-2">Search across all your newsletters</h3>
          <p className="text-neutral-500 max-w-md mx-auto">
            Find specific content, topics, or phrases from all your newsletter subscriptions using our powerful semantic search.
          </p>
        </div>
      )}
    </div>
  );
};

export default Search;