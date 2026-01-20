# Multiple Newsletter Groups - Implementation Guide

## Overview

This document provides a high-level implementation plan for adding multiple group support to newsletters. The implementation is structured into independent tasks that can be worked on in parallel.

## Database Schema

### 1. Database Tables

Create these tables in Supabase:

- `newsletter_groups`
  - id (UUID, PK)
  - name (TEXT, NOT NULL)
  - color (TEXT, DEFAULT '#3b82f6')
  - user_id (UUID, FK to auth.users)
  - created_at, updated_at timestamps

- `newsletter_group_members` (join table)
  - id (UUID, PK)
  - newsletter_id (UUID, FK to newsletters)
  - group_id (UUID, FK to newsletter_groups)
  - user_id (UUID, FK to auth.users)
  - created_at timestamp
  - UNIQUE(newsletter_id, group_id)

### 2. Required Indexes

- Index on user_id for both tables
- Indexes on foreign keys (newsletter_id, group_id)
- Composite index on (newsletter_id, group_id) for the join table

### 3. Row Level Security (RLS)

- Enable RLS on both tables
- Create policies to restrict access to user's own data
- Add trigger to enforce max 10 groups per newsletter

## Backend Implementation

### 1. Type Definitions

Create TypeScript interfaces in `src/common/types/index.ts`:

- `NewsletterGroup` - Core group properties
- `NewsletterGroupMember` - Join table type
- Update `Newsletter` interface to include groups array

### 2. API Service (`newsletterGroupApi.ts`)

Implement these methods:

- CRUD operations for groups
- Membership management (add/remove newsletter from group)
- Bulk operations for updating group memberships
- Statistics and counts (newsletters per group)

### 3. Service Layer (`NewsletterGroupService.ts`)

Wrap API calls with:

- Input validation
- Error handling
- Retry logic
- Business rules (e.g., max 10 groups per newsletter)

## Frontend Implementation

### 1. Group Management Components

- `GroupList` - Display all groups with counts
- `GroupForm` - Create/edit group form with color picker
- `GroupBadge` - Visual representation of a group
- `GroupSelect` - Multi-select component for groups

### 2. Newsletter Integration

- Add group management to newsletter detail view
- Show group badges in newsletter list items
- Add group filtering to inbox view

### 3. State Management

- Use React Query for data fetching/caching
- Optimistic updates for better UX
- Proper error handling and loading states

## Testing

### 1. Unit Tests

- Test service layer methods
- Test API error handling
- Test validation logic

### 2. Integration Tests

- Test group creation and management flow
- Test newsletter-group relationships
- Test group filtering and search

### 3. Manual Testing

- Test all CRUD operations
- Verify RLS policies
- Test edge cases (max groups, concurrent updates)

## Deployment

1. Create database migrations
2. Deploy backend changes
3. Deploy frontend updates
4. Monitor for any issues
5. Consider feature flag for gradual rollout

## Future Enhancements

1. Bulk operations for managing groups
2. Nested groups/categories
3. Group sharing between users
4. Group templates
5. Import/export group configurations
