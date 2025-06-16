# NewsletterHub Architecture

## 1. Overview

NewsletterHub is a modern web application for managing, reading, and organizing newsletters. It consists of a React-based frontend and a Supabase backend (Postgres + Auth + Functions). The architecture is designed for scalability, maintainability, and extensibility.

```
[User Browser]
      |
      v
[React Web App] <----> [Supabase Backend]
      |                        |
   Components,           Database (Postgres)
   Pages, Hooks,         Auth (Supabase Auth)
   Services              Storage, Edge Functions
```

---

## 2. Web App Structure

**Location:** `/src/web`

### Key Directories

- **components/**: Reusable UI components (e.g., [NewsletterRow](cci:1://file:///Users/dzapata/Documents/Projects/Personal/newsletterHub/src/web/components/NewsletterRow.tsx:38:0-277:2), `SourceGroupCard`)
  - Presentational only, without business logic
  - Accept callbacks for user interactions
- **pages/**: Top-level route components (e.g., `Inbox`, [NewslettersPage](cci:1://file:///Users/dzapata/Documents/Projects/Personal/newsletterHub/src/web/pages/NewslettersPage.tsx:45:0-1374:2))
- **common/api/**: API clients and data access
  - Contains API clients (e.g., `newsletterApi`, `tagApi`)
  - Handles data transformation and validation
  - No UI components or React hooks
- **common/services/**: Core services
  - `supabaseClient.ts`: Supabase client initialization
  - Shared business logic utilities
- **hooks/**: Custom React hooks
  - Encapsulate reusable stateful logic
  - Compose multiple hooks together
  - Should not contain UI components
- **lib/**, **utils/**: Pure utility functions
  - Stateless helper functions
  - Type definitions
  - Constants and configuration

### When to Use What

1. **API Clients** (in `/common/api`):
   - API client initialization and configuration
   - Data transformation and validation
   - Direct Supabase queries and mutations

2. **Services** (in `/common/services`):
   - Core service initialization (e.g., Supabase client)
   - Shared business logic utilities
   - Cross-cutting concerns

3. **Hooks**:
   - Reusable stateful logic
   - Composing multiple hooks
   - Data fetching and subscriptions
   - Managing side effects

### Separation of Concerns

- **UI Components**: Should be dumb and presentational
- **Business Logic**: Lives in services
- **State Management**: Handled by hooks
- **API Calls**: Abstracted in services

---

## 3. Routing & State Management

### Routing

- **Implementation**: React Router in `App.tsx`
- **Route Protection**: 
  - `ProtectedRoute` component for auth checks
  - Role-based access control
  - Route-based code splitting

### State Management

1. **Local State**:
   - `useState` for component-specific state
   - `useReducer` for complex state logic

2. **Global State**:
   - `AuthContext` for user session
   - `SettingsContext` for user preferences
   - `CacheContext` for API response caching

3. **Server State**:
   - React Query for data fetching
   - Optimistic updates
   - Automatic background refetching

---

## 3. API & Data Layer

### Supabase Client

- **Initialization**: `common/services/supabaseClient.ts`
- **Auth**: Handled by Supabase Auth
- **CRUD Operations**: Through API modules in `common/api/`

### Key Data Flows

1. **Fetching Newsletters**:
   - UI → `useNewsletters` hook → `newsletterApi` → Supabase
   - Data is cached and paginated

2. **Tag Management**:
   - Components → Tag hooks → `tagApi` → Supabase `newsletter_tags`

3. **Newsletter Actions**:
   - `NewsletterActions` component → Shared action handlers → API → Optimistic UI updates

---

## 4. Supabase Backend

**Location:** `/supabase`

### Database Schema

- `newsletters`: Core content
- `newsletter_sources`: Senders of newsletters
- `newsletter_source_groups`: User-defined source groups
- `tags` & `newsletter_tags`: Categorization system
- `reading_queue`: User's reading list
- `users`: Managed by Supabase Auth

### Security

- **Row-Level Security (RLS)**: Enabled on all tables
- **Policies**: Defined in migrations to restrict access per user

### Functions

- **Edge Functions**: Custom logic (e.g., email handling)
- **Migrations**: Schema versioning in `/supabase/migrations/`

---

## 5. Component Interactions

### Reading Queue Flow
1. User reorders items in `ReadingQueuePage`
2. `SortableNewsletterRow` updates order via API
3. Supabase `reading_queue` table updates
4. UI reflects changes via hooks

### Authentication Flow
1. User logs in via `Login` page
2. `AuthContext` manages session
3. Protected routes check auth status

---

## 6. Extensibility

### Adding New Features
1. **Database**: Add migrations in `/supabase/migrations/`
2. **API**: Create modules in `common/api/`
3. **UI**: Add components and hooks as needed

### Best Practices
- Keep components small and focused
- Reuse existing hooks and utilities
- Follow RLS patterns for security


## 7. Features

### Core Features

1. **Newsletter Management**
   - View, search, and filter newsletters
   - Mark as read/unread
   - Archive/trash functionality

2. **Tagging System**
   - Create and manage tags
   - Filter by tags
   - Bulk tag operations

3. **Reading Queue**
   - Reorder items via drag-and-drop
   - Persisted reading progress
   - Keyboard navigation

4. **Source Management**
   - Group sources
   - Filter by source
   - Source analytics

5. **Search**
   - Full-text search
   - Advanced filters
   - Saved searches

### User Experience

- Responsive design
- Keyboard shortcuts
- Dark/light theme
- Progressive loading

---

## 8. References
- [Supabase Documentation](https://supabase.com/docs)
- [React Router](https://reactrouter.com/)

*Document last updated: June 2025*