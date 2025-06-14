# Tag Update Integration Tests

## Overview
This document outlines integration tests for the newsletter tag update functionality implemented across multiple components and hooks.

## Test Setup
- Ensure user is authenticated
- Have at least 2 newsletters in the system
- Have at least 2 existing tags
- Have both archived and unarchived newsletters

## Test Cases

### 1. Basic Tag Update Functionality

#### 1.1 Add New Tag to Newsletter
**Steps:**
1. Navigate to newsletters page
2. Click the tag icon on any newsletter row
3. Click "Add Tag" button in tag selector
4. Enter a new tag name
5. Select a color
6. Click "Add" button

**Expected Result:**
- New tag appears in the newsletter's tag list
- Success toast shows "Tags updated successfully"
- Tag selector closes
- Newsletter reflects the new tag immediately

#### 1.2 Add Existing Tag to Newsletter
**Steps:**
1. Click tag icon on newsletter row
2. Click on an existing tag from the dropdown list

**Expected Result:**
- Existing tag is added to newsletter
- Success toast appears
- Tag appears in newsletter's tag display

#### 1.3 Remove Tag from Newsletter
**Steps:**
1. Click tag icon on newsletter with existing tags
2. Click the X button next to a selected tag

**Expected Result:**
- Tag is removed from newsletter
- Success toast appears
- Tag no longer appears in newsletter display

### 2. Loading States

#### 2.1 Tag Update Loading State
**Steps:**
1. Click tag icon on newsletter
2. Add or remove a tag (simulate slow network if needed)

**Expected Result:**
- Tag icon shows loading spinner
- Tag selector is disabled during update
- "Updating tags..." text appears
- All tag-related interactions are disabled
- Loading state clears after operation completes

#### 2.2 Tag Icon Loading Indicator
**Steps:**
1. Initiate tag update operation
2. Observe tag icon button

**Expected Result:**
- Button shows "Updating tags..." tooltip
- Button has opacity-50 and cursor-not-allowed classes
- Loading spinner replaces tag icon

### 3. Error Handling

#### 3.1 Network Error During Tag Update
**Steps:**
1. Disconnect network or simulate API failure
2. Attempt to update tags on a newsletter

**Expected Result:**
- Error toast appears with appropriate message
- Error message displays in tag selector area
- User can dismiss error message
- Original tags remain unchanged
- Tag selector remains functional for retry

#### 3.2 Authentication Error
**Steps:**
1. Expire user session (or simulate auth failure)
2. Attempt to update tags

**Expected Result:**
- Error message indicates authentication required
- User is prompted to log in again
- No changes are made to tags

#### 3.3 Permission Error
**Steps:**
1. Attempt to update tags on newsletter not owned by user (if applicable)

**Expected Result:**
- Error message indicates insufficient permissions
- No changes are made
- Error is handled gracefully

### 4. User Experience

#### 4.1 Tag Visibility Toggle
**Steps:**
1. Click tag icon on newsletter row
2. Verify tag selector appears
3. Click tag icon again

**Expected Result:**
- Tag selector shows/hides correctly
- Icon state changes to indicate visibility
- No unintended side effects

#### 4.2 Tag Click Navigation
**Steps:**
1. Click on a tag badge in newsletter display

**Expected Result:**
- Navigation occurs to filtered view
- Tag filter is applied correctly
- Click event doesn't propagate to parent elements

#### 4.3 Error Dismissal
**Steps:**
1. Trigger an error during tag update
2. Click "Dismiss" button on error message

**Expected Result:**
- Error message disappears
- Tag selector remains functional
- User can retry operation

### 5. Data Persistence

#### 5.1 Tag Updates Persist Across Page Refresh
**Steps:**
1. Add tags to a newsletter
2. Refresh the page
3. Verify tags are still present

**Expected Result:**
- Tags remain associated with newsletter
- Tag display is consistent
- No data loss occurs

#### 5.2 Tag Updates Sync Across Multiple Views
**Steps:**
1. Update tags in newsletters page
2. Navigate to inbox or other newsletter view
3. Verify same newsletter shows updated tags

**Expected Result:**
- Tag changes are reflected in all views
- Cache invalidation works correctly
- Data consistency is maintained

### 6. Edge Cases

#### 6.1 Updating Tags on Archived Newsletter
**Steps:**
1. Archive a newsletter
2. Navigate to archived view
3. Update tags on archived newsletter

**Expected Result:**
- Tag updates work normally for archived newsletters
- Proper user validation occurs
- No unexpected behavior

#### 6.2 Newsletter Without Existing Tags
**Steps:**
1. Find newsletter with no tags
2. Open tag selector
3. Add first tag

**Expected Result:**
- Tag selector shows empty state correctly
- Adding first tag works normally
- UI handles empty state gracefully

#### 6.3 Newsletter Without Source
**Steps:**
1. Find newsletter without source (if applicable)
2. Update tags

**Expected Result:**
- Tag updates work regardless of source presence
- No errors related to missing source
- Functionality remains intact

#### 6.4 Rapid Tag Updates
**Steps:**
1. Quickly add/remove multiple tags in succession

**Expected Result:**
- Operations are queued properly
- No race conditions occur
- Final state reflects all changes
- Loading states handle multiple operations

### 7. Performance

#### 7.1 Tag Update Response Time
**Steps:**
1. Update tags on newsletter
2. Measure response time

**Expected Result:**
- Operation completes within reasonable time (<2 seconds)
- UI remains responsive during update
- No noticeable lag in user interface

#### 7.2 Cache Invalidation Performance
**Steps:**
1. Update tags on newsletter
2. Verify cache invalidation doesn't cause performance issues

**Expected Result:**
- Related queries update efficiently
- No unnecessary refetches occur
- UI updates smoothly

### 8. Validation

#### 8.1 Empty Tag Name Validation
**Steps:**
1. Open tag selector
2. Try to create tag with empty name
3. Try to create tag with only whitespace

**Expected Result:**
- Empty tag names are rejected
- Appropriate validation feedback
- No invalid tags are created

#### 8.2 Duplicate Tag Handling
**Steps:**
1. Try to add same tag to newsletter twice

**Expected Result:**
- Duplicate tags are handled gracefully
- No duplicate entries appear
- User receives appropriate feedback

## Test Environment Notes
- Test with both development and production builds
- Test with different network conditions (slow, offline)
- Test across different browsers if web application
- Verify mobile responsiveness if applicable

## Success Criteria
- All test cases pass without errors
- User experience is smooth and intuitive
- Error handling is robust and user-friendly
- Performance meets acceptable standards
- Data integrity is maintained throughout all operations