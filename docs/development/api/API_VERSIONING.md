# API Versioning Strategy and Deprecation Policy

This document outlines the versioning strategy and deprecation policy for the NewsletterHub API layer to ensure smooth transitions when making changes to the API.

## Table of Contents

- [Overview](#overview)
- [Versioning Strategy](#versioning-strategy)
- [Semantic Versioning](#semantic-versioning)
- [Breaking Changes](#breaking-changes)
- [Deprecation Policy](#deprecation-policy)
- [Migration Process](#migration-process)
- [Backwards Compatibility](#backwards-compatibility)
- [Implementation Guidelines](#implementation-guidelines)
- [Communication Strategy](#communication-strategy)
- [Examples](#examples)

## Overview

The NewsletterHub API layer follows a structured versioning approach to:
- Maintain backwards compatibility when possible
- Provide clear migration paths for breaking changes
- Give developers adequate time to adapt to changes
- Ensure system stability during upgrades

## Versioning Strategy

### Version Numbering

We use **Semantic Versioning (SemVer)** for the API layer:

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes that require code modifications
- **MINOR**: New features that are backwards compatible
- **PATCH**: Bug fixes and minor improvements

### Current Version

The current API version is tracked in:
- `package.json` - Application version
- `src/common/api/version.ts` - API layer version
- `docs/api/CHANGELOG.md` - Change history

### Version Declaration

```typescript
// src/common/api/version.ts
export const API_VERSION = '1.2.0';
export const API_COMPATIBILITY = ['1.0.0', '1.1.0', '1.2.0'];

// Check version compatibility
export const isCompatibleVersion = (requiredVersion: string): boolean => {
  return API_COMPATIBILITY.includes(requiredVersion);
};
```

## Semantic Versioning

### MAJOR Version Changes (1.0.0 → 2.0.0)

Breaking changes that require developer action:

- **Method signature changes**
  ```typescript
  // v1.0.0
  getAll(userId: string, filters: any): Promise<Newsletter[]>
  
  // v2.0.0 - BREAKING
  getAll(params: GetAllParams): Promise<PaginatedResponse<Newsletter>>
  ```

- **Return type changes**
  ```typescript
  // v1.0.0
  Promise<Newsletter[]>
  
  // v2.0.0 - BREAKING
  Promise<PaginatedResponse<Newsletter>>
  ```

- **Required parameter changes**
  ```typescript
  // v1.0.0
  create(data: Partial<Newsletter>): Promise<Newsletter>
  
  // v2.0.0 - BREAKING
  create(data: Required<CreateNewsletterParams>): Promise<Newsletter>
  ```

### MINOR Version Changes (1.0.0 → 1.1.0)

New features that are backwards compatible:

- **New optional parameters**
  ```typescript
  // v1.0.0
  getAll(params: GetAllParams): Promise<PaginatedResponse<Newsletter>>
  
  // v1.1.0 - NEW FEATURE
  getAll(params: GetAllParams & { includeStats?: boolean }): Promise<PaginatedResponse<Newsletter>>
  ```

- **New methods**
  ```typescript
  // v1.1.0 - NEW FEATURE
  export const newsletterApi = {
    // ... existing methods
    getStats(): Promise<NewsletterStats>, // NEW
  };
  ```

- **New response properties**
  ```typescript
  // v1.0.0
  interface Newsletter {
    id: string;
    title: string;
    content: string;
  }
  
  // v1.1.0 - NEW FEATURE
  interface Newsletter {
    id: string;
    title: string;
    content: string;
    readingTime?: number; // NEW, optional
  }
  ```

### PATCH Version Changes (1.0.0 → 1.0.1)

Bug fixes and minor improvements:

- **Bug fixes**
- **Performance improvements**
- **Internal refactoring**
- **Documentation updates**
- **Error message improvements**

## Breaking Changes

### What Constitutes a Breaking Change

1. **Method Signature Changes**
   - Removing parameters
   - Making optional parameters required
   - Changing parameter types
   - Changing parameter order

2. **Return Type Changes**
   - Changing the structure of returned data
   - Removing properties from response objects
   - Changing property types

3. **Error Handling Changes**
   - Changing error codes
   - Changing error message formats
   - Removing error types

4. **Behavior Changes**
   - Changing default values
   - Changing sorting behavior
   - Changing validation rules

### Breaking Change Examples

#### Parameter Type Change
```typescript
// v1.0.0
interface GetAllParams {
  limit?: number;
  filters?: string[]; // Array of strings
}

// v2.0.0 - BREAKING
interface GetAllParams {
  limit?: number;
  filters?: FilterObject; // Changed to object
}
```

#### Required Parameter Addition
```typescript
// v1.0.0
create(data: { title: string; content?: string }): Promise<Newsletter>

// v2.0.0 - BREAKING
create(data: { title: string; content: string }): Promise<Newsletter>
//                                  ^^^^^^^^ Now required
```

#### Return Structure Change
```typescript
// v1.0.0
getAll(): Promise<Newsletter[]>

// v2.0.0 - BREAKING
getAll(): Promise<{
  data: Newsletter[];
  pagination: PaginationInfo;
}>
```

## Deprecation Policy

### Deprecation Timeline

1. **Announcement (3 months before removal)**
   - Mark methods as deprecated
   - Update documentation
   - Notify development team

2. **Warning Period (3 months)**
   - Add console warnings
   - Provide migration examples
   - Update migration guides

3. **Removal (in next major version)**
   - Remove deprecated methods
   - Update version to next major

### Deprecation Markers

```typescript
/**
 * @deprecated Use getAll() instead. Will be removed in v2.0.0
 * @see getAll
 */
export const getAllNewsletters = async (): Promise<Newsletter[]> => {
  console.warn('getAllNewsletters is deprecated. Use newsletterApi.getAll() instead.');
  const result = await newsletterApi.getAll();
  return result.data;
};
```

### Deprecation Documentation

```markdown
## Deprecated APIs

### v1.x Deprecations

| Method | Deprecated In | Removed In | Replacement |
|--------|---------------|------------|-------------|
| `getAllNewsletters()` | v1.2.0 | v2.0.0 | `newsletterApi.getAll()` |
| `createNewsletter()` | v1.2.0 | v2.0.0 | `newsletterApi.create()` |
```

## Migration Process

### Step 1: Identify Breaking Changes

Before releasing a major version:

1. **Code Analysis**
   ```bash
   # Check for breaking changes
   npm run api:check-breaking-changes
   ```

2. **Impact Assessment**
   - Identify affected methods
   - Estimate migration effort
   - Plan migration timeline

### Step 2: Provide Migration Path

```typescript
// Migration utility
export const migrationUtils = {
  // Convert old format to new format
  convertOldParams: (oldParams: OldParams): NewParams => {
    return {
      ...oldParams,
      filters: Array.isArray(oldParams.filters) 
        ? { categories: oldParams.filters }
        : oldParams.filters,
    };
  },
  
  // Convert new format to old format for backwards compatibility
  convertNewResponse: (newResponse: NewResponse): OldResponse => {
    return newResponse.data;
  },
};
```

### Step 3: Transition Period

During the transition period, support both old and new APIs:

```typescript
// v1.x compatibility layer
export const newsletterApiV1 = {
  async getAllNewsletters(): Promise<Newsletter[]> {
    const result = await newsletterApi.getAll();
    return result.data;
  },
  
  async createNewsletter(data: OldCreateParams): Promise<Newsletter> {
    const newParams = migrationUtils.convertOldParams(data);
    return await newsletterApi.create(newParams);
  },
};

// Export both versions
export { newsletterApi }; // Current version
export { newsletterApiV1 }; // Legacy version
```

### Step 4: Complete Migration

```typescript
// Remove compatibility layer in next major version
// Only export current API
export { newsletterApi };
```

## Backwards Compatibility

### Compatibility Guarantees

1. **PATCH versions**: Always backwards compatible
2. **MINOR versions**: Backwards compatible, may add new features
3. **MAJOR versions**: May break backwards compatibility

### Compatibility Checking

```typescript
// Runtime compatibility check
export const checkCompatibility = (requiredVersion: string): void => {
  if (!isCompatibleVersion(requiredVersion)) {
    throw new Error(
      `API version ${requiredVersion} is not compatible with current version ${API_VERSION}`
    );
  }
};

// Usage
try {
  checkCompatibility('1.0.0');
  // Safe to use API
} catch (error) {
  console.error('Version compatibility error:', error.message);
}
```

### Compatibility Adapter

```typescript
// Adapter for backwards compatibility
export const createCompatibilityAdapter = (targetVersion: string) => {
  return {
    async getAll(params?: any): Promise<any> {
      if (targetVersion.startsWith('1.0')) {
        // v1.0 compatibility
        const result = await newsletterApi.getAll(params);
        return result.data; // Return array instead of paginated response
      }
      
      // Default to current version
      return await newsletterApi.getAll(params);
    },
  };
};

// Usage
const apiV1 = createCompatibilityAdapter('1.0.0');
const newsletters = await apiV1.getAll(); // Returns Newsletter[]
```

## Implementation Guidelines

### 1. Version-Aware Development

```typescript
// Always specify version in new features
export const newsletterApi = {
  /**
   * Get all newsletters
   * @since 1.0.0
   * @param params Query parameters
   * @returns Paginated response
   */
  async getAll(params?: GetAllParams): Promise<PaginatedResponse<Newsletter>> {
    // Implementation
  },
  
  /**
   * Get newsletter statistics
   * @since 1.1.0
   * @returns Newsletter statistics
   */
  async getStats(): Promise<NewsletterStats> {
    // Implementation
  },
};
```

### 2. Feature Flags for Breaking Changes

```typescript
// Use feature flags for gradual rollout
const FEATURE_FLAGS = {
  useNewPaginationFormat: process.env.VITE_USE_NEW_PAGINATION === 'true',
  useNewErrorFormat: process.env.VITE_USE_NEW_ERRORS === 'true',
};

export const getAll = async (params?: GetAllParams) => {
  const result = await fetchNewsletters(params);
  
  if (FEATURE_FLAGS.useNewPaginationFormat) {
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }
  
  // Legacy format
  return result.data;
};
```

### 3. Version Headers

```typescript
// Include version in API requests
const API_HEADERS = {
  'X-API-Version': API_VERSION,
  'X-Client-Version': process.env.VITE_APP_VERSION,
};

// Use in Supabase client
const supabaseWithVersion = supabase.from('table').select('*', {
  headers: API_HEADERS,
});
```

### 4. Changelog Maintenance

```markdown
# API Changelog

## [2.0.0] - 2024-03-01

### Breaking Changes
- Changed `getAll()` return type from `Newsletter[]` to `PaginatedResponse<Newsletter>`
- Removed deprecated `getAllNewsletters()` function
- Made `content` parameter required in `create()` method

### Added
- New `bulkUpdate()` method for updating multiple newsletters
- Added `readingTime` property to Newsletter interface

### Migration Guide
- Replace `getAllNewsletters()` with `newsletterApi.getAll()`
- Update code to handle paginated responses
- Ensure `content` is provided when creating newsletters

## [1.2.0] - 2024-02-01

### Added
- New `getStats()` method
- Optional `includeStats` parameter in `getAll()`

### Deprecated
- `getAllNewsletters()` - Use `newsletterApi.getAll()` instead
```

## Communication Strategy

### 1. Advance Notice

**3 months before breaking changes:**
- Send email to development team
- Update documentation
- Post in team communication channels

**1 month before breaking changes:**
- Send reminder email
- Add console warnings to deprecated methods
- Provide migration examples

**1 week before breaking changes:**
- Final reminder
- Ensure migration guides are complete
- Test migration examples

### 2. Documentation Updates

- Update API documentation
- Add migration guides
- Include version compatibility matrices
- Provide code examples

### 3. Code Comments

```typescript
/**
 * @deprecated Since 1.2.0. Use `newsletterApi.getAll()` instead.
 * This method will be removed in version 2.0.0.
 * 
 * @example
 * // Old way (deprecated)
 * const newsletters = await getAllNewsletters();
 * 
 * // New way
 * const response = await newsletterApi.getAll();
 * const newsletters = response.data;
 */
export const getAllNewsletters = async (): Promise<Newsletter[]> => {
  // Implementation with deprecation warning
};
```

## Examples

### Example 1: Adding New Optional Parameter

```typescript
// v1.0.0
interface GetAllParams {
  limit?: number;
  offset?: number;
}

// v1.1.0 - Backwards compatible
interface GetAllParams {
  limit?: number;
  offset?: number;
  includeArchived?: boolean; // NEW, optional
}

// Implementation handles both versions
export const getAll = async (params: GetAllParams = {}) => {
  const {
    limit = 50,
    offset = 0,
    includeArchived = false, // Default value for new parameter
  } = params;
  
  // Implementation
};
```

### Example 2: Breaking Change with Migration

```typescript
// v1.0.0
export const create = async (data: Partial<Newsletter>): Promise<Newsletter> => {
  // Old implementation
};

// v2.0.0 - Breaking change
export const create = async (data: CreateNewsletterParams): Promise<Newsletter> => {
  // New implementation with required parameters
};

// Migration utility
export const migrateCreateParams = (
  oldData: Partial<Newsletter>
): CreateNewsletterParams => {
  if (!oldData.title) {
    throw new Error('Title is required in v2.0.0');
  }
  
  return {
    title: oldData.title,
    content: oldData.content || '',
    // Add other required fields with defaults
  };
};
```

### Example 3: Deprecation with Compatibility Layer

```typescript
// v1.2.0 - Add deprecation warning
/**
 * @deprecated Use newsletterApi.getAll() instead. Will be removed in v2.0.0
 */
export const getAllNewsletters = async (): Promise<Newsletter[]> => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'getAllNewsletters() is deprecated. Use newsletterApi.getAll() instead. ' +
      'This method will be removed in v2.0.0'
    );
  }
  
  const result = await newsletterApi.getAll();
  return result.data;
};

// v2.0.0 - Remove deprecated method
// getAllNewsletters is no longer exported
```

## Conclusion

This versioning strategy ensures:
- **Predictable updates** with clear semantic versioning
- **Smooth migrations** with adequate notice and tools
- **Backwards compatibility** where possible
- **Clear communication** about changes and timelines

By following these guidelines, we can evolve the API while maintaining system stability and developer productivity.

---

**Last Updated:** December 2024  
**Next Review:** March 2025  
**Maintained by:** Engineering Team