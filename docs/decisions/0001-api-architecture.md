# ADR-0001: API Architecture for Centralized Database Access

## Status

**Accepted** - December 2024

## Context

The NewsletterHub application was originally built with direct Supabase database calls scattered throughout components, hooks, and utility functions. This approach led to several issues:

### Problems with Direct Database Access

1. **Inconsistent Error Handling**: Different parts of the application handled database errors differently, leading to inconsistent user experiences and difficult debugging.

2. **Performance Monitoring Gaps**: No centralized way to monitor database query performance or identify slow operations.

3. **Code Duplication**: Similar database queries were implemented multiple times across different components, violating DRY principles.

4. **Difficult Testing**: Mocking database calls required mocking Supabase directly in many places, making tests brittle and hard to maintain.

5. **Security Concerns**: User authentication and authorization checks were inconsistently applied across database operations.

6. **Maintainability Issues**: Changes to database schema or query patterns required updates in multiple locations throughout the codebase.

7. **Type Safety**: Inconsistent typing of database responses and transformations across the application.

### Business Requirements

- Improve application reliability and user experience
- Enable better performance monitoring and optimization
- Reduce development time for new features
- Improve code maintainability and testability
- Ensure consistent security practices

## Decision

We will implement a centralized API layer architecture with the following characteristics:

### API Service Layer

Create dedicated API service modules for each domain:
- `newsletterApi.ts` - Newsletter CRUD operations
- `tagApi.ts` - Tag management and associations
- `readingQueueApi.ts` - Reading queue operations
- `userApi.ts` - User profile and settings
- `newsletterSourceApi.ts` - Newsletter source management
- `newsletterSourceGroupApi.ts` - Source group management

### Standardized Patterns

All API services will follow consistent patterns:

1. **Authentication**: Use `requireAuth()` for all user-specific operations
2. **Error Handling**: Use `handleSupabaseError()` for consistent error processing
3. **Performance Monitoring**: Wrap operations with `withPerformanceLogging()`
4. **Type Safety**: Define clear interfaces for all parameters and return types
5. **Data Transformation**: Handle data transformation within the API layer

### Enhanced Supabase Client

Extend the base Supabase client with:
- Centralized error handling utilities
- Performance monitoring capabilities
- Authentication requirement enforcement
- Logging and debugging tools

### Migration Strategy

1. **Phase 1**: Create API services for core domains
2. **Phase 2**: Update hooks to use API services instead of direct calls
3. **Phase 3**: Refactor utility functions to delegate to API services
4. **Phase 4**: Update components to use API-based hooks
5. **Phase 5**: Remove direct Supabase imports from non-API files

## Alternatives Considered

### 1. Status Quo (Direct Supabase Calls)

**Pros:**
- No migration effort required
- Direct control over queries
- Familiar to current team

**Cons:**
- All the problems mentioned in the context section
- Technical debt continues to accumulate
- Difficult to scale development team

**Decision:** Rejected due to long-term maintainability concerns

### 2. GraphQL Layer

**Pros:**
- Powerful query capabilities
- Strong typing
- Industry standard

**Cons:**
- Significant learning curve for team
- Additional infrastructure complexity
- Overkill for current application size
- Would require rewriting most data access code

**Decision:** Rejected as too complex for current needs

### 3. Repository Pattern

**Pros:**
- Clean separation of concerns
- Easy to test with interfaces
- Well-established pattern

**Cons:**
- More abstraction layers
- Potential over-engineering
- Less direct integration with React Query

**Decision:** Rejected in favor of simpler API service approach

### 4. Custom ORM/Query Builder

**Pros:**
- Maximum control over data access
- Could optimize for specific use cases

**Cons:**
- Significant development effort
- Maintenance burden
- Team would need to become experts in database optimization

**Decision:** Rejected as reinventing the wheel

## Consequences

### Positive Consequences

1. **Consistent Error Handling**
   - All database errors handled uniformly
   - Better user experience with consistent error messages
   - Easier debugging and monitoring

2. **Improved Performance Monitoring**
   - Centralized logging of all database operations
   - Easy identification of slow queries
   - Performance metrics collection

3. **Better Code Organization**
   - Clear separation between UI logic and data access
   - Single responsibility principle enforced
   - Easier to locate and modify data access code

4. **Enhanced Testing**
   - Mock at API service level instead of database level
   - More reliable and maintainable tests
   - Easier to test error scenarios

5. **Improved Security**
   - Consistent authentication checks across all operations
   - User authorization enforced at API layer
   - Reduced risk of security vulnerabilities

6. **Type Safety**
   - Consistent typing across all data operations
   - Better IDE support and autocomplete
   - Compile-time error detection

7. **Developer Experience**
   - Clear patterns for new features
   - Easier onboarding for new team members
   - Reduced cognitive load when working with data

### Negative Consequences

1. **Migration Effort**
   - Significant upfront work to migrate existing code
   - Risk of introducing bugs during migration
   - Time away from feature development

2. **Additional Abstraction Layer**
   - One more layer between components and database
   - Potential performance overhead (minimal)
   - Learning curve for team members

3. **Initial Complexity**
   - More files and structure to understand
   - Potential over-engineering for simple operations

### Mitigation Strategies

1. **Gradual Migration**: Implement migration in phases to reduce risk
2. **Comprehensive Testing**: Maintain test coverage during migration
3. **Documentation**: Create clear documentation and examples
4. **Team Training**: Ensure all team members understand new patterns
5. **Performance Monitoring**: Track performance during migration to catch regressions

## Implementation Details

### API Service Structure

```typescript
export const domainApi = {
  // CRUD operations
  async getAll(params?: QueryParams): Promise<PaginatedResponse<T>> { },
  async getById(id: string): Promise<T | null> { },
  async create(params: CreateParams): Promise<T> { },
  async update(params: UpdateParams): Promise<T> { },
  async delete(id: string): Promise<boolean> { },
  
  // Domain-specific operations
  async domainSpecificOperation(params: any): Promise<any> { },
};
```

### Enhanced Supabase Client Features

```typescript
// Authentication requirement
export const requireAuth = async (): Promise<User> => { };

// Error handling
export const handleSupabaseError = (error: PostgrestError): never => { };

// Performance monitoring
export const withPerformanceLogging = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => { };
```

### Hook Pattern

```typescript
// Before
const { data, error } = await supabase.from('table').select('*');

// After
const { data, error } = useQuery({
  queryKey: ['domain'],
  queryFn: () => domainApi.getAll(),
});
```

## Compliance

This decision aligns with:
- **React Best Practices**: Separation of concerns, single responsibility
- **TypeScript Guidelines**: Strong typing, interface definitions
- **Security Best Practices**: Centralized authentication and authorization
- **Testing Best Practices**: Mockable interfaces, isolated testing
- **Performance Best Practices**: Monitoring and optimization capabilities

## References

- [Supabase Client Library Documentation](https://supabase.com/docs/reference/javascript/supabase-client)
- [React Query Best Practices](https://react-query.tanstack.com/guides/best-practices)
- [TypeScript API Design Guidelines](https://github.com/microsoft/TypeScript/wiki/API-Design-Guidelines)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## Related Decisions

- ADR-0002: Error Handling Strategy (planned)
- ADR-0003: Performance Monitoring Implementation (planned)
- ADR-0004: API Versioning Strategy (planned)

---

**Last Updated**: December 2024  
**Next Review**: March 2025  
**Stakeholders**: Engineering Team, Product Team