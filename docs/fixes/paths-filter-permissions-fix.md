# Paths-Filter Permissions Fix

## Problem
The CI workflow was failing with the error:
```
Error: Resource not accessible by integration
```

This occurred in the `dorny/paths-filter@v2` action when trying to detect changed files.

## Root Cause
The `changes` job in the workflow didn't have the necessary permissions to access repository files. The `dorny/paths-filter@v2` action requires specific GitHub permissions to read repository contents and pull request information.

## Solution

### 1. Added Required Permissions
Updated the `changes` job in `.github/workflows/test.yml` to include the necessary permissions:

```yaml
changes:
  runs-on: ubuntu-latest
  permissions:
    contents: read
    pull-requests: read
```

### 2. Made Workflow More Resilient
Updated job conditions to handle cases where the paths-filter action might fail:

```yaml
# Before
if: needs.changes.outputs.src == 'true' || needs.changes.outputs.tests == 'true'

# After  
if: always() && (needs.changes.outputs.src == 'true' || needs.changes.outputs.tests == 'true' || needs.changes.result == 'failure')
```

### 3. Applied to All Dependent Jobs
Updated conditions for:
- `lint-and-typecheck` job
- `test` job  
- `visual-tests` job

## Required Permissions Explained

- **`contents: read`**: Allows the action to read repository files to detect changes
- **`pull-requests: read`**: Allows the action to access pull request information to determine which files changed

## Benefits

1. **Fixes Permission Error**: The workflow can now properly detect changed files
2. **Improved Resilience**: Jobs can still run even if the paths-filter action fails
3. **Better CI Experience**: More reliable and predictable CI behavior

## Testing
The fix has been applied to the workflow. The next CI run should:
1. Successfully detect changed files
2. Run appropriate jobs based on changes
3. Continue working even if there are permission issues

## Files Modified
- `.github/workflows/test.yml` - Added permissions and improved job conditions
- `docs/fixes/paths-filter-permissions-fix.md` - This documentation (new file) 