# Multiple Newsletter Groups - Implementation Guide

## Overview

Groups are associated with **newsletter_sources**, not newsletters directly. Newsletters inherit group membership from their source (`newsletter_source_id`). This keeps data consistent and avoids duplicating group assignments per newsletter.

## Database Schema

### 1. Database Tables

- `newsletter_groups`
  - id (UUID, PK)
  - name (TEXT, NOT NULL)
  - color (TEXT, DEFAULT '#3b82f6')
  - user_id (UUID, FK to auth.users)
  - created_at, updated_at timestamps

- `newsletter_group_members` (join table: **source–group**)
  - id (UUID, PK)
  - **source_id** (UUID, FK to newsletter_sources)
  - group_id (UUID, FK to newsletter_groups)
  - user_id (UUID, FK to auth.users)
  - created_at timestamp
  - UNIQUE(group_id, source_id)

### 2. Required Indexes

- Index on user_id for both tables
- Indexes on foreign keys (source_id, group_id)
- Composite index on (group_id, source_id) for the join table

### 3. Row Level Security (RLS)

- Enable RLS on both tables
- Policies restrict access to the user's own data
- **INSERT on newsletter_group_members**: require group ownership **and** source ownership (source.user_id = auth.uid())
- Trigger: max 10 groups **per source**

## Backend Implementation

### 1. Type Definitions (`src/common/types/index.ts`)

- `NewsletterGroup` – id, name, color, user_id, `sources?: NewsletterSource[]`, `_count?: { sources: number }`
- `NewsletterGroupMember` – id, **source_id**, group_id, user_id, created_at, `source?: NewsletterSource`, `group?: NewsletterGroup`
- `Newsletter` does **not** have a `groups` array; group membership is derived from `newsletter.source_id` and `getSourceGroups(sourceId)`.

### 2. API Service (`newsletterGroupApi.ts`)

- **CRUD**: `getAll`, `getById`, `create`, `update`, `delete` (create/update accept `sourceIds?: string[]`)
- **Source–group membership**:
  - `addSources({ groupId, sourceIds })` → `NewsletterSource[]`
  - `removeSources({ groupId, sourceIds })` → `boolean`
  - `getGroupSources(groupId)` → `NewsletterSource[]`
  - `getSourceGroups(sourceId)` → `NewsletterGroup[]`
  - `updateSourceGroups(sourceId, groupIds)` → `NewsletterGroup[]`
- **Stats**: `getStats()` → `{ totalGroups, totalSources, averageSourcesPerGroup, groupsWithoutSources }`
- **Search**: `search(query)` → `NewsletterGroup[]`

All membership operations enforce **source ownership** via RLS (source must belong to the current user).

### 3. Service Layer (`NewsletterGroupService.ts`)

- Wraps the API with validation, retry, and error handling
- **Validation**: source IDs and group IDs as non-empty strings; max 10 groups per source in `updateSourceGroups`
- **Source-based methods**: `addSourcesToGroup`, `removeSourcesFromGroup`, `getSourceGroups`, `getGroupSources`, `updateSourceGroups`
- Business rules validate **source ownership** (via API/RLS), not newsletter ownership

## Frontend Implementation

Frontend Implementation
Summary of UI Changes
Component/Area Changes Needed Impact Level Files to Modify
URL Navigation Multi-group parameter handling (?groups=id1,id2) High src/web/pages/Inbox.tsx, src/web/pages/NewsletterDetail.tsx
State Management Array-based group state (groupFilters: string[]) High src/common/hooks/useInboxFilters.ts, src/web/pages/Inbox.tsx
Filter Components Multi-select Groups UI (checkboxes, Clear All) High src/web/components/InboxFilters.tsx
Selected Filters Display Show selected group chips with clear controls Medium src/web/components/SelectedFiltersDisplay.tsx (new)
Newsletter Rows Show group badges (from newsletter.source.groups) Medium src/web/components/NewsletterRow\*.tsx
Mobile UI Multi-select experience in mobile panel Medium src/web/components/MobileFilterPanel.tsx
Bulk Actions Respect group filter context where applicable Medium src/web/components/BulkSelectionActions.tsx
Performance Query key stability for multi-group filters Low src/common/utils/queryKeyFactory.ts
Validation Validate multi-group inputs and URL params Low src/common/utils/filterValidation.ts (new)

1. Filter Bar and Group Multi-Select
   Replace single groupFilter: string | null with groupFilters: string[].
   Update InboxFilters:
   Add groupFilters and onGroupFiltersChange(groupIds: string[]).
   Implement a Groups dropdown with checkboxes, selected count badge, and “Clear All”.
   Keep mutual exclusion: when any groupFilters selected, disable source dropdown; when sourceFilter is set, disable groups dropdown.
2. State Management and URL Params
   Inbox.tsx:
   Introduce const [groupFilters, setGroupFilters] = useState<string[]>([]).
   On group updates, call setGroupFilters(newIds) and setSourceFilter(null).
   Resolve selected groups → source IDs:
   For each selected group, union its sources[].id into a Set → use as sourceIds for newsletter queries.
   URL handling:
   Write groups=id1,id2 when non-empty; remove when empty.
   Parse groups on mount to initialize groupFilters.
   useInboxFilters.ts:
   Extend state with groupFilters: string[].
   Provide setGroupFilters(groupIds: string[]).
   Optional: centralize URL sync/parsing here if desired.
3. Newsletter Query Integration
   Keep the server filter model unchanged; only pass sourceIds resolved from groups.
   Build a stable filter object (memoized) where:
   If groupFilters.length > 0, override sourceIds with the union from selected groups.
   Ensure query keys include a normalized representation (e.g., sorted arrays) to prevent cache thrash.
4. Selected Filters Display
   Add SelectedFiltersDisplay (new):
   Renders chips for each selected group with an “X” to clear individually.
   Optional “Clear all” when multiple selected.
   Place below the filter bar (near existing SelectedTagsDisplay).
5. Newsletter Rows and Badges
   In NewsletterRow (or the presentation/container pair):
   If groupFilters.length > 0, show group badges that intersect with the newsletter’s source.groups.
   Badge content: group name; style consistent with other pills.
6. Mobile Experience
   In a mobile filter panel (existing or new), mirror the multi-select behavior:
   Checklist of groups.
   Clear all button.
   Respect mutual exclusion with source filter.
7. Navigation Preservation
   When navigating from Inbox to Newsletter Detail:
   Include groups param if groupFilters.length > 0.
   On Detail page, read and preserve groups when linking back or performing actions that update the URL.
8. Performance and Validation
   Query keys:
   When embedding arrays (e.g., sourceIds, groupIds), sort arrays and avoid creating new references unnecessarily.
   Validation:
   Validate groups URL param against available groups (drop unknown IDs).
   Guard against pathological selections (e.g., extremely large arrays) if user manipulates URL.
9. Testing
   Unit
   State transitions: add/remove groups, clear all, mutual exclusion with source filter.
   URL parsing/serialization for groups.
   SelectedFiltersDisplay behaviors.
   Integration
   Filtering results match union of sources for selected groups.
   Navigation preserves and restores groups.
   Mobile multi-select behavior mirrors desktop.
   E2E
   Multi-group selection, deep link with ?groups=id1,id2, reload behavior, and return to Inbox preserving filters.
   File-Level Checklist
   High priority
   src/web/components/InboxFilters.tsx (multi-select dropdown)
   src/web/pages/Inbox.tsx (state, URL sync, sourceIds resolution, pass props)
   src/common/hooks/useInboxFilters.ts (optional centralization)
   Medium priority
   src/web/components/SelectedFiltersDisplay.tsx (new)
   src/web/components/NewsletterRow\*.tsx (group badges)
   src/web/components/MobileFilterPanel.tsx (mobile multi-select)
   Low priority
   src/common/utils/queryKeyFactory.ts (sorted keys)
   src/common/utils/filterValidation.ts (new)
   This section captures all UI-only changes needed to support selecting multiple source groups in the newsletter view, leveraging the existing Source ↔ Group M:N and Newsletter → Source 1:1 relationships.

Phase 1: Core state management and URL handling
Phase 2: Multi-select filter component
Phase 3: Display and navigation updates
Phase 4: Mobile responsiveness and advanced features
Phase 5: Performance optimization and validation

Implementation Priority
High: Enhance useInboxFilters hook with multi-group support
Medium: Mobile filter panel and newsletter detail navigation
Medium: Group badges display and bulk actions integration
Low: Filter validation and performance optimizations

### 1. Group Management Components

- `GroupList` – list groups with **source** counts
- `GroupForm` – create/edit group with color picker and **source** multi-select
- `GroupBadge` – visual group label
- `GroupSelect` – multi-select for groups (e.g. when editing a **source**)

### 2. Source Integration

- Group management in the **newsletter source** (sender) detail/settings view
- When displaying a **newsletter**, resolve groups via `getSourceGroups(newsletter.source_id)` (or `newsletter.source_id && getSourceGroups(newsletter.source_id)`)
- Show group badges on list items using the source’s groups
- Inbox filtering by `group_id` can be implemented by joining newsletters → sources → group_members

### 3. State Management

- React Query for groups and source–group memberships
- Optimistic updates where appropriate
- Error and loading states

## Testing

### 1. Unit Tests

- Service: `addSourcesToGroup`, `removeSourcesFromGroup`, `getSourceGroups`, `getGroupSources`, `updateSourceGroups`, validation, max 10 groups per source
- API: same method names, error handling, `sourceIds` / `sourceId` parameters

### 2. Integration Tests

- Create group with `sourceIds`
- Add/remove sources, `updateSourceGroups`, `getSourceGroups`, `getGroupSources`
- Filtering by group (via sources)

### 3. Manual Testing

- CRUD on groups
- All source-based membership operations
- RLS: only own sources and own groups
- Edge cases: max 10 groups per source, concurrent updates

## Deployment

1. Run migrations: `20260120100000_create_newsletter_groups.sql`, and if you previously had `newsletter_id` on `newsletter_group_members`, `20260120110000_newsletter_group_members_use_source_id.sql`
2. Deploy API and service
3. Deploy frontend (source-based group UI)
4. Monitor and consider a feature flag

## Missing Implementation Items (Priority Order)

### HIGH PRIORITY

#### 1. Group Badges on Newsletter Rows

- **Status**: ❌ Missing
- **Files**: `src/web/components/NewsletterRow*.tsx`
- **Details**: Newsletter rows should display group badges when `groupFilters.length > 0`, showing intersection with newsletter's source.groups
- **Impact**: Users cannot see which groups filtered newsletters belong to

#### 2. Filter Validation Utility

- **Status**: ❌ Missing
- **Files**: `src/common/utils/filterValidation.ts` (new)
- **Details**: Validate groups URL parameter against available groups, guard against pathological selections
- **Impact**: Invalid group IDs in URLs could cause unexpected behavior

### MEDIUM PRIORITY

#### 3. Enhanced Bulk Actions with Group Context

- **Status**: ⚠️ Partial
- **Files**: `src/web/components/BulkSelectionActions.tsx`
- **Details**: Bulk actions should respect group filter context where applicable
- **Impact**: Bulk operations may not work correctly with group filters applied

#### 4. Group Management UI Components

- **Status**: ⚠️ Partial
- **Files**: Need components for group CRUD operations
- **Details**:
  - `GroupList` – list groups with source counts
  - `GroupForm` – create/edit group with color picker and source multi-select
  - `GroupBadge` – visual group label (exists but needs integration)
  - `GroupSelect` – multi-select for groups when editing a source
- **Impact**: Users cannot create/edit groups through the UI

### LOW PRIORITY

#### 5. Performance Optimizations

- **Status**: ✅ Mostly Complete
- **Files**: `src/common/utils/queryKeyFactory.ts`
- **Details**: Query keys already sort arrays for stability, but could add more optimizations
- **Impact**: Minor performance improvements

#### 6. Advanced Group Features

- **Status**: ❌ Missing
- **Details**:
  - Bulk assign/remove sources across groups
  - Nested groups/categories
  - Group sharing
  - Group templates
  - Import/export of group configuration
- **Impact**: Advanced user workflows not supported

## Implementation Status Summary

| Feature                             | Status      | Notes                                                  |
| ----------------------------------- | ----------- | ------------------------------------------------------ |
| **Core State Management**           | ✅ Complete | `useInboxFilters` supports `groupFilters: string[]`    |
| **Multi-select Filter Component**   | ✅ Complete | `InboxFilters.tsx` has `MultiGroupFilterDropdown`      |
| **URL Parameter Handling**          | ✅ Complete | `?groups=id1,id2` format supported                     |
| **Mobile Filter Panel**             | ✅ Complete | `MobileFilterPanel.tsx` supports multi-group selection |
| **Selected Filters Display**        | ✅ Complete | `SelectedFiltersDisplay.tsx` implemented               |
| **Navigation Preservation**         | ✅ Complete | NewsletterDetail preserves groups parameter            |
| **Query Key Stability**             | ✅ Complete | Arrays sorted in `queryKeyFactory.ts`                  |
| **Group Badges on Newsletter Rows** | ❌ Missing  | Need to add group badges to NewsletterRow components   |
| **Filter Validation**               | ❌ Missing  | Need `filterValidation.ts` utility                     |
| **Group Management UI**             | ⚠️ Partial  | Backend ready, frontend needs CRUD components          |
| **Bulk Actions Integration**        | ⚠️ Partial  | Needs group filter context awareness                   |

## Next Steps (Recommended Order)

1. **Implement Group Badges** (High) - Add visual feedback for filtered newsletters
2. **Add Filter Validation** (High) - Improve robustness of URL parameter handling
3. **Complete Group Management UI** (Medium) - Enable full CRUD operations
4. **Enhance Bulk Actions** (Medium) - Ensure group filter compatibility
5. **Performance Review** (Low) - Optimize any remaining bottlenecks
6. **Advanced Features** (Low) - Plan future enhancements based on user feedback
