import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search as SearchIcon,
  Filter,
  X,
  Tag,
  Archive,
  Eye,
  Clock,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import { format } from "date-fns";

// Hooks
import { useSearch } from "../hooks/useSearch";
import { useSearchSuggestions } from "../hooks/useSearch";
import { useNewsletterSources } from "../hooks/useSearch";
import { usePagination } from "../hooks/useSearch";
import { useSearchKeyboard } from "../hooks/useSearch";

// Utils
import {
  highlightSearchTerms,
  getSearchContext,
  formatResultsCount,
  formatPaginationInfo,
} from "../utils/searchUtils";

// Components
const SearchInput: React.FC<{
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  showSuggestions: boolean;
  suggestions: string[];
  recentSearches: string[];
  onSuggestionClick: (suggestion: string) => void;
  onRemoveRecentSearch: (search: string) => void;
  onShowSuggestions: () => void;
  onHideSuggestions: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  suggestionsRef: React.RefObject<HTMLDivElement>;
}> = ({
  query,
  onQueryChange,
  onSearch,
  onClear,
  showSuggestions,
  suggestions,
  recentSearches,
  onSuggestionClick,
  onRemoveRecentSearch,
  onShowSuggestions,
  onHideSuggestions,
  inputRef,
  suggestionsRef,
}) => {
  const { handleKeyDown } = useSearchKeyboard(onSearch, onHideSuggestions);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onShowSuggestions}
        onKeyDown={handleKeyDown}
        placeholder="Search for topics, newsletters, or keywords..."
        className="input-field pl-10 py-3 pr-10 text-lg"
      />

      <SearchIcon
        size={20}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
      />

      {query && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}

      {/* Search Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions &&
          (suggestions.length > 0 || recentSearches.length > 0) && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
            >
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-neutral-500 mb-2 px-2">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => onSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 rounded-md text-sm flex items-center"
                    >
                      <SearchIcon size={14} className="mr-2 text-neutral-400" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {!query && recentSearches.length > 0 && (
                <div className="p-2 border-t border-neutral-100">
                  <div className="text-xs font-medium text-neutral-500 mb-2 px-2 flex items-center">
                    <Clock size={12} className="mr-1" />
                    Recent Searches
                  </div>
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => onSuggestionClick(search)}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 rounded-md text-sm flex items-center group"
                    >
                      <Clock size={14} className="mr-2 text-neutral-400" />
                      {search}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecentSearch(search);
                        }}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 rounded"
                      >
                        <X size={12} />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};

const SearchFilters: React.FC<{
  showFilters: boolean;
  sources: any[];
  selectedSources: string[];
  readStatus: string;
  archivedStatus: string;
  dateFrom: string;
  dateTo: string;
  onToggleSource: (sourceId: string) => void;
  onReadStatusChange: (status: any) => void;
  onArchivedStatusChange: (status: any) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClearFilters: () => void;
}> = ({
  showFilters,
  sources,
  selectedSources,
  readStatus,
  archivedStatus,
  dateFrom,
  dateTo,
  onToggleSource,
  onReadStatusChange,
  onArchivedStatusChange,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
}) => {
  if (!showFilters) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 p-4 bg-neutral-50 rounded-lg border"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-neutral-800">Search Filters</h4>
        <button
          onClick={onClearFilters}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sources */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Sources
          </label>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {sources.map((source) => (
              <label key={source.id} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.id)}
                  onChange={() => onToggleSource(source.id)}
                  className="mr-2 rounded"
                />
                <span className="truncate">{source.name}</span>
                {typeof source.newsletter_count === "number" && (
                  <span className="ml-auto text-neutral-400">
                    ({source.newsletter_count})
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Read Status */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Read Status
          </label>
          <select
            value={readStatus}
            onChange={(e) => onReadStatusChange(e.target.value)}
            className="w-full px-3 py-1 border border-neutral-300 rounded-md text-sm"
          >
            <option value="all">All newsletters</option>
            <option value="read">Read only</option>
            <option value="unread">Unread only</option>
          </select>
        </div>

        {/* Archive Status */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Archive Status
          </label>
          <select
            value={archivedStatus}
            onChange={(e) => onArchivedStatusChange(e.target.value)}
            className="w-full px-3 py-1 border border-neutral-300 rounded-md text-sm"
          >
            <option value="active">Active only</option>
            <option value="all">All newsletters</option>
            <option value="archived">Archived only</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Date Range
          </label>
          <div className="space-y-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
              placeholder="To"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SearchResults: React.FC<{
  results: any[];
  query: string;
  loading: boolean;
  onResultClick: (id: string) => void;
}> = ({ results, query, loading, onResultClick }) => {
  const [clickedIds, setClickedIds] = React.useState<Set<string>>(new Set());

  const handleResultClick = async (id: string) => {
    setClickedIds((prev) => new Set(prev).add(id));
    try {
      await onResultClick(id);
    } finally {
      // Remove from clicked set after navigation
      setClickedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
          <p className="text-neutral-600">Searching newsletters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <motion.div
          key={result.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          className={`card cursor-pointer hover:shadow transition-all ${
            clickedIds.has(result.id) ? "opacity-50 pointer-events-none" : ""
          }`}
          onClick={() => handleResultClick(result.id)}
        >
          <div className="p-4">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-medium">
                {highlightSearchTerms(result.title, query)}
              </h3>
              <span className="text-sm text-neutral-500">
                {format(new Date(result.received_at), "MMM d")}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-neutral-500 mb-2">
              <div className="flex items-center">
                {result.source?.name || "Unknown Source"}
                {result.source?.from && (
                  <span className="text-gray-400 ml-2">
                    • {result.source.from}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {clickedIds.has(result.id) && (
                  <span className="flex items-center text-blue-600">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                    Opening...
                  </span>
                )}
                {!clickedIds.has(result.id) && !result.is_read && (
                  <span className="flex items-center text-primary-600">
                    <Eye size={12} className="mr-1" />
                    Unread
                  </span>
                )}
                {!clickedIds.has(result.id) && result.is_archived && (
                  <span className="flex items-center text-neutral-400">
                    <Archive size={12} className="mr-1" />
                    Archived
                  </span>
                )}
                {!clickedIds.has(result.id) && (
                  <span className="text-neutral-400">
                    {result.estimated_read_time} min read
                  </span>
                )}
              </div>
            </div>

            <p className="text-neutral-700 line-clamp-2">
              {highlightSearchTerms(result.summary, query)}
            </p>

            {/* Search Context from Content */}
            {(() => {
              const context = getSearchContext(result.content, query);
              return context && context !== result.summary ? (
                <div className="mt-2 p-2 bg-neutral-50 rounded text-sm">
                  <div className="text-xs text-neutral-500 mb-1 flex items-center">
                    <SearchIcon size={10} className="mr-1" />
                    Found in content:
                  </div>
                  <div className="text-neutral-600 italic">
                    {highlightSearchTerms(context, query)}
                  </div>
                </div>
              ) : null;
            })()}

            {result.tags && result.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {result.tags.slice(0, 3).map((tag: any) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <Tag size={10} className="mr-1" />
                    {tag.name}
                  </span>
                ))}
                {result.tags.length > 3 && (
                  <span className="text-xs text-neutral-500">
                    +{result.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const PaginationControls: React.FC<{
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalCount, itemsPerPage, onPageChange }) => {
  const pagination = usePagination(
    currentPage,
    totalCount,
    itemsPerPage,
    onPageChange,
  );

  if (totalCount <= itemsPerPage) return null;

  return (
    <div className="mt-8 flex items-center justify-between">
      <div className="text-sm text-neutral-500">
        {formatPaginationInfo(currentPage, itemsPerPage, totalCount)}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={pagination.goToPrevious}
          disabled={!pagination.hasPrevious}
          className={`${
            pagination.hasPrevious
              ? "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
          } px-3 py-2 text-sm font-medium border rounded-md transition-colors`}
        >
          Previous
        </button>

        <div className="flex items-center space-x-1">
          {pagination.getVisiblePages().map((pageNum, index) => {
            if (pageNum === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-neutral-500"
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={pageNum}
                onClick={() => pagination.goToPage(pageNum)}
                className={`${
                  pageNum === currentPage
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
                } px-3 py-2 text-sm font-medium border rounded-md transition-colors`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={pagination.goToNext}
          disabled={!pagination.hasMore}
          className={`${
            pagination.hasMore
              ? "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
          } px-3 py-2 text-sm font-medium border rounded-md transition-colors`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{
  hasSearched: boolean;
  hasResults: boolean;
  recentSearches: string[];
  onSuggestionClick: (suggestion: string) => void;
}> = ({ hasSearched, hasResults, recentSearches, onSuggestionClick }) => {
  const [showSearchTips, setShowSearchTips] = React.useState(false);

  if (hasSearched && !hasResults) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
          <SearchIcon size={24} className="text-neutral-400" />
        </div>
        <h3 className="text-lg font-medium text-neutral-800 mb-2">
          No results found
        </h3>
        <p className="text-neutral-500 max-w-md mx-auto">
          We couldn't find any newsletters matching your search. Try using
          different keywords or check your spelling.
        </p>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
          <SearchIcon size={24} className="text-neutral-400" />
        </div>
        <h3 className="text-lg font-medium text-neutral-800 mb-2">
          Search across all your newsletters
        </h3>
        <p className="text-neutral-500 max-w-md mx-auto mb-6">
          Find specific content, topics, or phrases from all your newsletter
          subscriptions using our powerful semantic search.
        </p>

        {/* Search Tips */}
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setShowSearchTips(!showSearchTips)}
            className="flex items-center text-sm text-primary-600 hover:text-primary-700 mx-auto mb-4"
          >
            <Lightbulb size={16} className="mr-1" />
            {showSearchTips ? "Hide" : "Show"} search tips
          </button>

          <AnimatePresence>
            {showSearchTips && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-neutral-50 rounded-lg p-4 text-left"
              >
                <h4 className="font-medium text-neutral-800 mb-3">
                  Search Tips
                </h4>
                <div className="space-y-2 text-sm text-neutral-600">
                  <div className="flex items-start">
                    <TrendingUp
                      size={14}
                      className="mr-2 mt-0.5 text-primary-500"
                    />
                    <div>
                      <strong>Use specific keywords:</strong> Try "AI research",
                      "crypto market", or "startup funding"
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Filter
                      size={14}
                      className="mr-2 mt-0.5 text-primary-500"
                    />
                    <div>
                      <strong>Apply filters:</strong> Narrow results by source,
                      read status, or date range
                    </div>
                  </div>
                  <div className="flex items-start">
                    <SearchIcon
                      size={14}
                      className="mr-2 mt-0.5 text-primary-500"
                    />
                    <div>
                      <strong>Search content:</strong> We search through titles,
                      content, and summaries
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Tag size={14} className="mr-2 mt-0.5 text-primary-500" />
                    <div>
                      <strong>Browse by tags:</strong> Use filters to find
                      newsletters with specific tags
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="mt-8">
            <h4 className="text-sm font-medium text-neutral-700 mb-3">
              Your Recent Searches
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {recentSearches.slice(0, 6).map((search, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(search)}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-sm transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

const Search: React.FC = () => {
  const [showFilters, setShowFilters] = React.useState(false);

  // Use custom hooks
  const {
    query,
    filters,
    results,
    loading,
    error,

    totalCount,
    currentPage,
    hasMore,
    itemsPerPage,
    updateQuery,
    updateFilters,
    handleSearch,
    handlePageChange,
    handleResultClick,
    clearSearch,
    clearFilters,
    hasFiltersApplied,
    hasResults,
    hasSearched,
  } = useSearch();

  const {
    suggestions,
    showSuggestions,
    recentSearches,
    suggestionsRef,
    inputRef,
    handleSuggestionClick,
    removeRecentSearch,
    showSuggestionsDropdown,
    hideSuggestions,
  } = useSearchSuggestions(query);

  const { sources } = useNewsletterSources();

  // Handlers
  const handleSuggestionSelect = (suggestion: string) => {
    const newQuery = handleSuggestionClick(suggestion);
    updateQuery(newQuery);
    setTimeout(() => handleSearch(), 100);
  };

  const handleQueryChange = (newQuery: string) => {
    updateQuery(newQuery);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Search Newsletters</h2>

      {/* Search Input Section */}
      <div className="mb-8">
        <SearchInput
          query={query}
          onQueryChange={handleQueryChange}
          onSearch={handleSearch}
          onClear={clearSearch}
          loading={loading}
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          recentSearches={recentSearches}
          onSuggestionClick={handleSuggestionSelect}
          onRemoveRecentSearch={removeRecentSearch}
          onShowSuggestions={showSuggestionsDropdown}
          onHideSuggestions={hideSuggestions}
          inputRef={inputRef}
          suggestionsRef={suggestionsRef}
        />

        {/* Search Controls */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-neutral-500">
            {hasSearched && !loading && (
              <>
                {formatResultsCount(totalCount, hasFiltersApplied)}
                {filters.selectedSources.length > 0 &&
                  ` • ${filters.selectedSources.length} source${
                    filters.selectedSources.length !== 1 ? "s" : ""
                  } selected`}
              </>
            )}
            {error && <span className="text-red-500">{error}</span>}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`${
                showFilters || hasFiltersApplied
                  ? "bg-primary-100 text-primary-600"
                  : "bg-neutral-100 text-neutral-600 hover:text-neutral-800"
              } px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center`}
            >
              <Filter size={14} className="mr-1" />
              Filters
            </button>

            <button
              onClick={handleSearch}
              disabled={!query.trim() || loading}
              className={`${
                query.trim() && !loading
                  ? "bg-primary-500 hover:bg-primary-600 text-white"
                  : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
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

        {/* Search Filters */}
        <SearchFilters
          showFilters={showFilters}
          sources={sources}
          selectedSources={filters.selectedSources}
          readStatus={filters.readStatus}
          archivedStatus={filters.archivedStatus}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onToggleSource={(sourceId) => {
            const newSources = filters.selectedSources.includes(sourceId)
              ? filters.selectedSources.filter((id) => id !== sourceId)
              : [...filters.selectedSources, sourceId];
            updateFilters({ selectedSources: newSources });
          }}
          onReadStatusChange={(status) => updateFilters({ readStatus: status })}
          onArchivedStatusChange={(status) =>
            updateFilters({ archivedStatus: status })
          }
          onDateFromChange={(date) => updateFilters({ dateFrom: date })}
          onDateToChange={(date) => updateFilters({ dateTo: date })}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Search Results */}
      {hasSearched && hasResults && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">
              Search Results
              <span className="ml-2 text-sm font-normal text-neutral-500">
                ({totalCount.toLocaleString()} total)
              </span>
            </h3>
            {hasFiltersApplied && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral-500">
                  Filters applied
                </span>
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <SearchResults
            results={results}
            query={query}
            loading={loading}
            onResultClick={handleResultClick}
          />

          <PaginationControls
            currentPage={currentPage}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            hasMore={hasMore}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Empty States */}
      <EmptyState
        hasSearched={hasSearched}
        hasResults={hasResults}
        recentSearches={recentSearches}
        onSuggestionClick={handleSuggestionSelect}
      />
    </div>
  );
};

export default Search;
