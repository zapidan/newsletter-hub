# Newsletter Hub - Search Functionality

## Overview

The Search functionality in Newsletter Hub provides a comprehensive and powerful way to find newsletters across your entire collection. It includes real-time search, advanced filtering, search suggestions, and intelligent result highlighting.

## Features Implemented

### 🔍 Core Search
- **Real-time search** across newsletter titles, content, and summaries
- **Case-insensitive** search with partial matching
- **Multi-term search** with individual term highlighting
- **Search as you type** with instant suggestions

### 🎯 Advanced Filtering
- **Source filtering**: Filter by specific newsletter sources
- **Read status**: Filter by read/unread status
- **Archive status**: Show active, archived, or all newsletters
- **Date range**: Filter by publication date range
- **Combined filters**: Use multiple filters simultaneously

### 💡 Smart Search Features
- **Search suggestions**: Dynamic suggestions based on query
- **Recent searches**: Quick access to your recent search history
- **Search tips**: Built-in help for effective searching
- **Auto-complete**: Suggestions appear as you type

### 🎨 Enhanced Results Display
- **Search term highlighting**: Matched terms are highlighted in yellow
- **Content context**: Shows relevant snippets from newsletter content
- **Rich metadata**: Displays source, read status, tags, and read time
- **Visual indicators**: Clear icons for read/unread and archived status

### 📱 User Experience
- **Responsive design**: Works seamlessly on all device sizes
- **Keyboard navigation**: Use Enter to search, Escape to close suggestions
- **Loading states**: Clear feedback during search operations
- **Error handling**: Graceful error messages and recovery

### 📄 Pagination
- **Smart pagination**: Handles large result sets efficiently
- **Page navigation**: Previous/Next buttons with page numbers
- **Results summary**: Shows current page and total results
- **Configurable page size**: 20 results per page by default

## How to Use

### Basic Search
1. Navigate to the Search page
2. Enter your search terms in the search box
3. Press Enter or click the Search button
4. Browse through the results

### Using Filters
1. Click the "Filters" button to expand advanced options
2. Select desired sources from the checkbox list
3. Choose read status (All, Read only, Unread only)
4. Set archive status (Active only, All, Archived only)
5. Optionally set a date range
6. Search results will update automatically

### Search Suggestions
- Start typing to see suggestions appear
- Click on any suggestion to use it
- Recent searches are saved and suggested
- Use the X button to remove items from recent searches

### Search Tips
- Use specific keywords for better results
- Try searching for topics like "AI research" or "crypto market"
- Combine filters to narrow down results
- Browse by tags using the filter options

## Technical Implementation

### API Integration
The search functionality uses the `searchNewsletters` API function which:
- Searches across `title`, `content`, and `summary` fields
- Supports pagination with configurable limits
- Includes related data (sources, tags)
- Handles filtering server-side for performance

### Search Parameters
```typescript
interface SearchParams {
  search: string;           // Search query
  limit: number;           // Results per page (default: 20)
  offset: number;          // Pagination offset
  sourceIds?: string[];    // Filter by source IDs
  isRead?: boolean;        // Filter by read status
  isArchived?: boolean;    // Filter by archive status
  dateFrom?: string;       // Start date filter
  dateTo?: string;         // End date filter
  includeSource: boolean;  // Include source data
  includeTags: boolean;    // Include tag data
}
```

### Search Highlighting
- Uses custom `highlightSearchTerms` function
- Highlights individual search terms in results
- Applies to titles, summaries, and content snippets
- Uses yellow background with rounded corners

### Local Storage
- Recent searches are stored in `newsletter_recent_searches`
- Maintains up to 10 recent searches
- Automatically deduplicates search history

## Components and Files

### Main Files
- `src/web/pages/Search.tsx` - Main search component
- `src/common/api/newsletterApi.ts` - API functions
- `src/web/index.css` - Search-specific styles

### Key Functions
- `searchNewsletters()` - API call for searching
- `highlightSearchTerms()` - Text highlighting utility
- `getSearchContext()` - Content snippet extraction
- `handleSearch()` - Main search handler
- `performSearch()` - API integration function

### CSS Classes
- `.line-clamp-2` - Text truncation utility
- `mark` - Search term highlighting styles
- Custom scrollbar styles for suggestions dropdown

## Search Query Examples

### Basic Searches
- `AI` - Find newsletters about artificial intelligence
- `crypto market` - Find content about cryptocurrency markets
- `startup funding` - Find newsletters about startup investment

### Advanced Usage
- Use filters to narrow by specific sources
- Set date ranges to find recent content
- Combine read/unread filters with topics
- Search within archived newsletters

## Performance Considerations

- **Server-side search**: All searching happens on the database level
- **Pagination**: Large result sets are paginated for performance
- **Debounced suggestions**: Suggestions are generated locally to avoid API calls
- **Efficient highlighting**: Text highlighting is done client-side only on visible results

## Future Enhancements

Potential improvements for the search functionality:
- Full-text search with ranking
- Saved search queries
- Search within specific time periods
- Export search results
- Advanced boolean search operators
- Search result sorting options
- Search analytics and insights

## Troubleshooting

### No Results Found
- Check spelling of search terms
- Try broader search terms
- Remove or adjust filters
- Ensure newsletters exist in the selected criteria

### Slow Search Performance
- Use more specific search terms
- Apply filters to reduce result set size
- Check internet connection
- Contact support if issues persist

### Search Suggestions Not Working
- Ensure JavaScript is enabled
- Check that local storage is working
- Clear browser cache if needed
- Try refreshing the page