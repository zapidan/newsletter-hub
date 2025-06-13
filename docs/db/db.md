# Newsletter Hub Database Documentation

## Overview

Newsletter Hub uses Supabase (PostgreSQL) as its primary database. The schema is designed to support a multi-user newsletter management system with features like tagging, reading queues, source management, and grouping.

## Database Schema

### Core Tables

#### 1. `users`
Stores user account information and preferences.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_alias TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- Uses UUID as primary key for security
- Email aliases for newsletter forwarding
- Onboarding tracking
- Automatic timestamps

#### 2. `newsletters`
The core table storing individual newsletter content.

```sql
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  newsletter_source_id UUID REFERENCES newsletter_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  word_count INTEGER DEFAULT 0,
  estimated_read_time INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT FALSE,
  is_liked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- Foreign key to users with CASCADE delete
- Optional source association
- Rich metadata (word count, read time)
- Multiple status flags for organization
- Flexible timestamp tracking

#### 3. `newsletter_sources`
Manages newsletter publishers/sources.

```sql
CREATE TABLE newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain)
);
```

**Key Features:**
- User-scoped sources
- Domain-based identification
- Archive functionality
- Unique constraint on user+domain

#### 4. `tags`
User-defined tags for newsletter organization.

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**Key Features:**
- User-scoped tags
- Color customization
- Unique constraint on user+name

#### 5. `newsletter_tags`
Many-to-many relationship between newsletters and tags.

```sql
CREATE TABLE newsletter_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(newsletter_id, tag_id)
);
```

**Key Features:**
- Junction table for many-to-many relationship
- CASCADE deletes maintain referential integrity
- Unique constraint prevents duplicate associations

#### 6. `reading_queue`
Ordered list of newsletters for reading.

```sql
CREATE TABLE reading_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, newsletter_id),
  UNIQUE(user_id, position)
);
```

**Key Features:**
- User-specific reading queues
- Position-based ordering
- Unique constraints prevent duplicates and position conflicts

#### 7. `newsletter_source_groups`
Groups for organizing newsletter sources.

```sql
CREATE TABLE newsletter_source_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

#### 8. `newsletter_source_group_members`
Many-to-many relationship between groups and sources.

```sql
CREATE TABLE newsletter_source_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES newsletter_source_groups(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES newsletter_sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, source_id)
);
```

## Relationships

### Entity Relationship Diagram

```
users (1) ──────── (M) newsletters
  │                      │
  │                      │ (M)
  │                      │
  │               newsletter_tags
  │                      │
  │                      │ (M)
  │ (1)                  │
  │                    tags (M)
  │
  │ (1)
  │
newsletter_sources (M)
  │
  │ (M)
  │
newsletter_source_group_members
  │
  │ (M)
  │
newsletter_source_groups (M) ── (1) users
```

### Key Relationships

1. **User to Newsletters**: One-to-many (user owns many newsletters)
2. **User to Tags**: One-to-many (user creates many tags)
3. **User to Sources**: One-to-many (user manages many sources)
4. **Newsletter to Tags**: Many-to-many (via newsletter_tags)
5. **Newsletter to Source**: Many-to-one (optional)
6. **Sources to Groups**: Many-to-many (via group_members)

## Indexes and Performance

### Primary Indexes

All tables have UUID primary keys with automatic B-tree indexes.

### Essential Indexes

```sql
-- Newsletter performance indexes
CREATE INDEX idx_newsletters_user_id ON newsletters(user_id);
CREATE INDEX idx_newsletters_source_id ON newsletters(newsletter_source_id);
CREATE INDEX idx_newsletters_received_at ON newsletters(received_at DESC);
CREATE INDEX idx_newsletters_user_status ON newsletters(user_id, is_archived, is_read);
CREATE INDEX idx_newsletters_user_received ON newsletters(user_id, received_at DESC);

-- Tag relationship indexes
CREATE INDEX idx_newsletter_tags_newsletter ON newsletter_tags(newsletter_id);
CREATE INDEX idx_newsletter_tags_tag ON newsletter_tags(tag_id);

-- Source management indexes
CREATE INDEX idx_sources_user_id ON newsletter_sources(user_id);
CREATE INDEX idx_sources_user_domain ON newsletter_sources(user_id, domain);

-- Reading queue indexes
CREATE INDEX idx_reading_queue_user_position ON reading_queue(user_id, position);
CREATE INDEX idx_reading_queue_newsletter ON reading_queue(newsletter_id);

-- Group management indexes
CREATE INDEX idx_group_members_group ON newsletter_source_group_members(group_id);
CREATE INDEX idx_group_members_source ON newsletter_source_group_members(source_id);
```

### Composite Indexes for Common Queries

```sql
-- Most common newsletter queries
CREATE INDEX idx_newsletters_user_status_received 
ON newsletters(user_id, is_archived, is_read, received_at DESC);

-- Tag-based filtering
CREATE INDEX idx_newsletters_tags_user 
ON newsletters(user_id) 
INCLUDE (is_archived, is_read, received_at);

-- Source-based queries
CREATE INDEX idx_newsletters_source_user_status 
ON newsletters(newsletter_source_id, user_id, is_archived);
```

## Row Level Security (RLS)

All tables implement RLS to ensure users can only access their own data.

### Users Table
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (auth.uid() = id);
```

### Newsletters Table
```sql
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own newsletters" ON newsletters
FOR ALL USING (auth.uid() = user_id);
```

### Newsletter Sources Table
```sql
ALTER TABLE newsletter_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sources" ON newsletter_sources
FOR ALL USING (auth.uid() = user_id);
```

### Tags Table
```sql
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" ON tags
FOR ALL USING (auth.uid() = user_id);
```

### Junction Tables
```sql
-- Newsletter Tags
ALTER TABLE newsletter_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage newsletter tags" ON newsletter_tags
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM newsletters 
    WHERE newsletters.id = newsletter_tags.newsletter_id 
    AND newsletters.user_id = auth.uid()
  )
);

-- Reading Queue
ALTER TABLE reading_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reading queue" ON reading_queue
FOR ALL USING (auth.uid() = user_id);
```

## Common Query Patterns

### 1. Get User's Unread Newsletters with Tags

```sql
SELECT 
  n.*,
  ns.name as source_name,
  ns.domain as source_domain,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) as tags
FROM newsletters n
LEFT JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
LEFT JOIN newsletter_tags nt ON n.id = nt.newsletter_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = $1
  AND n.is_read = false
  AND n.is_archived = false
GROUP BY n.id, ns.id
ORDER BY n.received_at DESC
LIMIT $2 OFFSET $3;
```

### 2. Get Newsletter Count by Source

```sql
SELECT 
  ns.id,
  ns.name,
  ns.domain,
  COUNT(n.id) as newsletter_count,
  COUNT(n.id) FILTER (WHERE n.is_read = false) as unread_count
FROM newsletter_sources ns
LEFT JOIN newsletters n ON ns.id = n.newsletter_source_id 
  AND n.is_archived = false
WHERE ns.user_id = $1
  AND ns.is_archived = false
GROUP BY ns.id, ns.name, ns.domain
ORDER BY newsletter_count DESC;
```

### 3. Get Reading Queue with Newsletter Details

```sql
SELECT 
  rq.position,
  n.*,
  ns.name as source_name
FROM reading_queue rq
JOIN newsletters n ON rq.newsletter_id = n.id
LEFT JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
WHERE rq.user_id = $1
ORDER BY rq.position;
```

### 4. Search Newsletters with Full-Text Search

```sql
SELECT 
  n.*,
  ts_rank(
    to_tsvector('english', n.title || ' ' || n.content),
    plainto_tsquery('english', $2)
  ) as rank
FROM newsletters n
WHERE n.user_id = $1
  AND n.is_archived = false
  AND (
    to_tsvector('english', n.title || ' ' || n.content) 
    @@ plainto_tsquery('english', $2)
  )
ORDER BY rank DESC, n.received_at DESC
LIMIT $3;
```

## Data Consistency and Constraints

### Referential Integrity

1. **CASCADE Deletes**: When a user is deleted, all related data is automatically removed
2. **SET NULL**: When a newsletter source is deleted, newsletters keep their content but lose source association
3. **Unique Constraints**: Prevent duplicate tags, sources, and associations

### Data Validation

```sql
-- Ensure positive word count and read time
ALTER TABLE newsletters ADD CONSTRAINT check_word_count 
CHECK (word_count >= 0);

ALTER TABLE newsletters ADD CONSTRAINT check_read_time 
CHECK (estimated_read_time >= 0);

-- Ensure valid email format (basic check)
ALTER TABLE users ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure tag names are not empty
ALTER TABLE tags ADD CONSTRAINT check_tag_name_not_empty 
CHECK (trim(name) != '');

-- Ensure source names are not empty
ALTER TABLE newsletter_sources ADD CONSTRAINT check_source_name_not_empty 
CHECK (trim(name) != '');
```

## Performance Optimization

### Query Optimization Tips

1. **Use Appropriate Indexes**: Always filter by user_id first
2. **Limit Result Sets**: Use LIMIT and OFFSET for pagination
3. **Aggregate Efficiently**: Use window functions for complex analytics
4. **Avoid N+1 Queries**: Use JOINs or JSON aggregation

### Example Optimized Query

```sql
-- Instead of multiple queries, use JSON aggregation
WITH newsletter_data AS (
  SELECT 
    n.*,
    ns.name as source_name,
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color
      )
    ) FILTER (WHERE t.id IS NOT NULL) as tags
  FROM newsletters n
  LEFT JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
  LEFT JOIN newsletter_tags nt ON n.id = nt.newsletter_id
  LEFT JOIN tags t ON nt.tag_id = t.id
  WHERE n.user_id = $1
    AND n.is_archived = false
  GROUP BY n.id, ns.name
)
SELECT * FROM newsletter_data
ORDER BY received_at DESC
LIMIT 50;
```

## Migration Patterns

### Adding New Columns

```sql
-- Always add columns as nullable first
ALTER TABLE newsletters ADD COLUMN new_feature_flag BOOLEAN;

-- Update existing records if needed
UPDATE newsletters SET new_feature_flag = false WHERE new_feature_flag IS NULL;

-- Add NOT NULL constraint after data is populated
ALTER TABLE newsletters ALTER COLUMN new_feature_flag SET NOT NULL;
ALTER TABLE newsletters ALTER COLUMN new_feature_flag SET DEFAULT false;
```

### Creating New Indexes

```sql
-- Create indexes concurrently in production
CREATE INDEX CONCURRENTLY idx_new_feature 
ON newsletters(user_id, new_feature_flag);
```

### Dropping Columns

```sql
-- Always drop constraints first
ALTER TABLE newsletters DROP CONSTRAINT IF EXISTS check_old_constraint;

-- Drop indexes
DROP INDEX IF EXISTS idx_old_feature;

-- Finally drop the column
ALTER TABLE newsletters DROP COLUMN IF EXISTS old_feature;
```

## Backup and Recovery

### Automated Backups
- Supabase provides automatic daily backups
- Point-in-time recovery available for up to 7 days (varies by plan)
- Consider implementing application-level exports for critical data

### Manual Backup Commands

```sql
-- Export user data
COPY (
  SELECT * FROM users WHERE id = $1
) TO '/tmp/user_backup.csv' WITH CSV HEADER;

-- Export newsletters with relationships
COPY (
  SELECT 
    n.*,
    ns.name as source_name,
    string_agg(t.name, ',' ORDER BY t.name) as tag_names
  FROM newsletters n
  LEFT JOIN newsletter_sources ns ON n.newsletter_source_id = ns.id
  LEFT JOIN newsletter_tags nt ON n.id = nt.newsletter_id
  LEFT JOIN tags t ON nt.tag_id = t.id
  WHERE n.user_id = $1
  GROUP BY n.id, ns.name
) TO '/tmp/newsletters_backup.csv' WITH CSV HEADER;
```

## Monitoring and Analytics

### Useful Analytics Queries

```sql
-- User engagement metrics
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as new_users,
  COUNT(*) FILTER (WHERE onboarding_completed) as completed_onboarding
FROM users
GROUP BY week
ORDER BY week;

-- Newsletter reading patterns
SELECT 
  DATE_TRUNC('day', received_at) as day,
  COUNT(*) as total_newsletters,
  COUNT(*) FILTER (WHERE is_read) as read_newsletters,
  AVG(word_count) as avg_word_count
FROM newsletters
WHERE received_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;

-- Popular sources
SELECT 
  ns.name,
  COUNT(n.id) as newsletter_count,
  COUNT(DISTINCT n.user_id) as unique_readers,
  AVG(n.word_count) as avg_word_count
FROM newsletter_sources ns
JOIN newsletters n ON ns.id = n.newsletter_source_id
WHERE n.received_at >= NOW() - INTERVAL '30 days'
GROUP BY ns.id, ns.name
ORDER BY newsletter_count DESC
LIMIT 20;
```

## Best Practices

### 1. Security
- Always use RLS policies
- Validate input at application level
- Use parameterized queries
- Regularly review and update policies

### 2. Performance
- Monitor slow queries
- Use appropriate indexes
- Implement pagination
- Cache frequently accessed data

### 3. Data Integrity
- Use transactions for multi-table operations
- Implement proper error handling
- Validate data consistency
- Regular data cleanup

### 4. Scalability
- Design for horizontal scaling
- Use efficient data types
- Implement proper archiving
- Monitor database size and performance

## Common Issues and Solutions

### 1. Slow Newsletter Queries
**Problem**: Queries involving newsletter listing are slow
**Solution**: Ensure proper indexes on (user_id, is_archived, received_at)

### 2. Tag Performance
**Problem**: Tag-based filtering is slow
**Solution**: Use GIN indexes for tag arrays or optimize junction table queries

### 3. Reading Queue Conflicts
**Problem**: Position conflicts in reading queue
**Solution**: Implement proper transaction isolation and conflict resolution

### 4. Memory Usage
**Problem**: Large newsletter content causing memory issues
**Solution**: Implement pagination and lazy loading for content

## Version History

- **v1.0**: Initial schema with basic newsletter management
- **v1.1**: Added reading queue functionality
- **v1.2**: Implemented newsletter source groups
- **v1.3**: Enhanced indexing and performance optimizations
- **v1.4**: Added full-text search capabilities

## Future Considerations

1. **Sharding**: Consider partitioning large tables by user_id
2. **Archiving**: Implement cold storage for old newsletters
3. **Search**: Enhanced full-text search with better ranking
4. **Analytics**: Dedicated analytics tables for reporting
5. **Caching**: Redis integration for frequently accessed data