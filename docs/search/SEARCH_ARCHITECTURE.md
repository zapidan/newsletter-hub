# Newsletter Hub - Search Architecture Documentation

## Overview

The search functionality has been refactored to follow a clean architecture pattern with clear separation of concerns. This modular approach improves maintainability, testability, and reusability of the search components.

## Architecture Layers

### 1. **Presentation Layer** (`src/web/pages/Search.tsx`)
- **Responsibility**: UI rendering and user interactions
- **Dependencies**: Hooks, Components
- **Key Features**:
  - Minimal business logic
  - Declarative component composition
  - Event handling delegation to hooks

### 2. **Custom Hooks Layer** (`src/web/hooks/`)
- **Responsibility**: State management and component logic
- **Dependencies**: Services, Utilities
- **Key Features**:
  - Reusable stateful logic
  - Effect management
  - API integration
  - URL synchronization

### 3. **Service Layer** (`src/web/services/`)
- **Responsibility**: Business logic and data operations
- **Dependencies**: API, Utilities
- **Key Features**:
  - Search operations
  - Data transformation
  - Local storage management
  - Validation logic

### 4. **Utility Layer** (`src/web/utils/`)
- **Responsibility**: Pure functions and helpers
- **Dependencies**: None (pure functions)
- **Key Features**:
  - Text processing
  - Search highlighting
  - Formatting functions
  - Validation helpers

## Directory Structure

```
src/web/
├── pages/
│   └── Search.tsx                 # Main search page component
├── hooks/
│   ├── useSearch.ts              # Main search hook
│   ├── useSearchFilters.ts       # Filter management hook
│   └── index.ts                  # Hooks exports
├── services/
│   ├── searchService.ts          # Search business logic
│   └── index.ts                  # Services exports
├── utils/
│   ├── searchUtils.tsx           # Search utility functions
│   └── index.ts                  # Utils exports
└── components/
    └── search/                   # Search-specific components
        ├── SearchInput.tsx
        ├── SearchFilters.tsx
        ├── SearchResults.tsx
        └── PaginationControls.tsx
```

## Key Components and Their Responsibilities

### Custom Hooks

#### `useSearch()`
- **Purpose**: Main search state and operations management
- **State**: Query, results, loading, error, pagination
- **Actions**: Search execution, pagination, URL management
- **Usage**:
```typescript
const {
  query,
  results,
  loading,
  error,
  updateQuery,
  handleSearch,
  handlePageChange,
  clearSearch
} = useSearch();
```

#### `useSearchSuggestions()`
- **Purpose**: Search suggestions and recent searches
- **State**: Suggestions, recent searches, visibility
- **Actions**: Generate suggestions, manage recent searches
- **Usage**:
```typescript
const {
  suggestions,
  showSuggestions,
  recentSearches,
  handleSuggestionClick,
  removeRecentSearch
} = useSearchSuggestions(query);
```

#### `useSearchFilters()`
- **Purpose**: Filter state management and validation
- **State**: All filter options and their values
- **Actions**: Update filters, validation, bulk operations
- **Usage**:
```typescript
const {
  filters,
  updateFilters,
  clearAllFilters,
  hasFiltersApplied,
  validation
} = useSearchFilters();
```

#### `usePagination()`
- **Purpose**: Pagination logic and navigation
- **State**: Current page, total pages, navigation state
- **Actions**: Page navigation, page number generation
- **Usage**:
```typescript
const {
  totalPages,
  hasMore,
  goToNext,
  goToPrevious,
  getVisiblePages
} = usePagination(currentPage, totalCount, itemsPerPage, onPageChange);
```

### Services

#### `SearchService`
- **Purpose**: Encapsulates all search-related business logic
- **Key Methods**:
  - `search()`: Execute search with filters and pagination
  - `getSources()`: Fetch newsletter sources for filtering
  - `saveRecentSearch()`: Manage search history
  - `validateSearchInput()`: Input validation
  - `buildUrlParams()`: URL state management

### Utilities

#### Search Text Processing
```typescript
// Highlight search terms in text
highlightSearchTerms(text: string, query: string): JSX.Element

// Extract relevant context from content
getSearchContext(text: string, query: string, maxLength?: number): string

// Generate search suggestions
generateSearchSuggestions(query: string, recentSearches: string[]): string[]
```

#### Search Parameter Building
```typescript
// Build API search parameters
buildSearchParams(query: string, filters: SearchFilters, pagination: PaginationOptions): Record<string, any>

// Validate search filters
validateSearchFilters(filters: SearchFilters): ValidationResult

// Format results for display
formatResultsCount(count: number, hasFilters: boolean): string
```

#### Performance Utilities
```typescript
// Debounce function calls
debounce<T>(func: T, delay: number): (...args: Parameters<T>) => void

// Throttle function calls
throttle<T>(func: T, delay: number): (...args: Parameters<T>) => void
```

## Data Flow

### 1. **User Interaction Flow**
```
User Input → Search Component → useSearch Hook → SearchService → API
                ↓
User Interface ← Format Results ← Transform Data ← API Response
```

### 2. **Search Execution Flow**
```
1. User types query
2. useSearchSuggestions generates suggestions
3. User triggers search
4. useSearch calls SearchService.search()
5. SearchService validates input and builds parameters
6. API call executed with search parameters
7. Results transformed and stored in hook state
8. UI re-renders with new results
9. URL updated with search state
```

### 3. **Filter Management Flow**
```
1. User modifies filters
2. useSearchFilters validates and updates state
3. useSearch detects filter changes
4. New search executed with updated filters
5. Results filtered and displayed
```

## Benefits of This Architecture

### **Separation of Concerns**
- **UI Components**: Focus only on rendering and user interactions
- **Hooks**: Manage state and side effects
- **Services**: Handle business logic and API calls
- **Utilities**: Provide reusable pure functions

### **Testability**
- **Isolated Units**: Each layer can be tested independently
- **Pure Functions**: Utilities are easily unit tested
- **Mocked Dependencies**: Services can be mocked for hook testing
- **Component Testing**: UI components can be tested with mock hooks

### **Reusability**
- **Custom Hooks**: Can be reused across different components
- **Services**: Business logic available to any component
- **Utilities**: Pure functions usable anywhere in the app

### **Maintainability**
- **Single Responsibility**: Each file has a clear purpose
- **Dependency Injection**: Easy to swap implementations
- **Type Safety**: Strong TypeScript typing throughout

### **Performance**
- **Memoization**: Hooks use useCallback and useMemo appropriately
- **Debouncing**: Search suggestions are debounced
- **Pagination**: Large result sets handled efficiently

## Usage Examples

### Basic Search Implementation
```typescript
// In a component
const SearchPage = () => {
  const {
    query,
    results,
    loading,
    updateQuery,
    handleSearch,
  } = useSearch();

  return (
    <div>
      <input
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      {loading ? <Loading /> : <Results data={results} />}
    </div>
  );
};
```

### Advanced Search with Filters
```typescript
const AdvancedSearch = () => {
  const search = useSearch();
  const filters = useSearchFilters();
  const sources = useNewsletterSources();

  const handleFilteredSearch = () => {
    search.updateFilters(filters.filters);
    search.handleSearch();
  };

  return (
    <div>
      <SearchInput {...search} />
      <SearchFilters {...filters} sources={sources.sources} />
      <SearchResults {...search} />
    </div>
  );
};
```

### Custom Search Hook
```typescript
// Creating a specialized search hook
const useNewsletterSearch = (sourceId?: string) => {
  const search = useSearch();
  
  useEffect(() => {
    if (sourceId) {
      search.updateFilters({ selectedSources: [sourceId] });
    }
  }, [sourceId]);

  return search;
};
```

## Testing Strategy

### **Unit Tests**
- **Utilities**: Test pure functions with various inputs
- **Services**: Test business logic with mocked APIs
- **Hooks**: Test state changes and side effects

### **Integration Tests**
- **Hook + Service**: Test complete search flow
- **Component + Hook**: Test UI interactions

### **E2E Tests**
- **Search Flow**: Complete user journey from input to results
- **Filter Interactions**: Multi-filter search scenarios

### **Example Test Structure**
```typescript
// searchUtils.test.ts
describe('highlightSearchTerms', () => {
  it('should highlight matching terms', () => {
    const result = highlightSearchTerms('Hello world', 'hello');
    expect(result).toContainMarkElement();
  });
});

// useSearch.test.ts
describe('useSearch', () => {
  it('should update query and trigger search', async () => {
    const { result } = renderHook(() => useSearch());
    act(() => {
      result.current.updateQuery('test');
      result.current.handleSearch();
    });
    await waitFor(() => {
      expect(result.current.results).toHaveLength(5);
    });
  });
});
```

## Extension Points

### **Adding New Search Features**
1. **New Filter Types**: Extend `SearchFilters` interface
2. **Custom Hooks**: Create specialized search hooks
3. **New Services**: Add domain-specific search services
4. **Utility Functions**: Add new text processing utilities

### **Performance Optimizations**
1. **Caching**: Add search result caching in service layer
2. **Virtualization**: Implement virtual scrolling for large result sets
3. **Preloading**: Prefetch next page of results
4. **Search Analytics**: Track search patterns and optimize

### **Advanced Features**
1. **Saved Searches**: Extend service to save search queries
2. **Search History**: Advanced search history management
3. **Export Results**: Add result export functionality
4. **Search Shortcuts**: Keyboard shortcuts for power users

## Migration Guide

### **From Old to New Architecture**

1. **Move State to Hooks**: Transfer component state to custom hooks
2. **Extract Business Logic**: Move API calls and validation to services
3. **Create Utilities**: Extract pure functions to utility files
4. **Update Components**: Simplify components to use hooks
5. **Add Types**: Ensure strong typing throughout

### **Breaking Changes**
- Component props may change when switching to hooks
- Some internal state management patterns will be different
- Testing approach will need updates for new architecture

This architecture provides a solid foundation for the search functionality while maintaining flexibility for future enhancements and ensuring code quality through proper separation of concerns.