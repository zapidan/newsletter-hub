# Source Filtering and Unread Count Testing Guide

## Overview
This document provides a comprehensive testing checklist for the source filtering and unread count features implemented in Newsletter Hub.

## Prerequisites
- Newsletter Hub application running locally
- Test data with multiple newsletter sources
- Some newsletters marked as read/unread across different sources

## Test Scenarios

### 1. Source Filtering in Inbox

#### Test Case 1.1: Basic Source Filter
- [ ] Navigate to `/inbox`
- [ ] Click on "Filter by Source" dropdown
- [ ] Verify all available sources are listed
- [ ] Select a specific source
- [ ] Verify only newsletters from that source are displayed
- [ ] Verify URL updates with `?source=<source_id>` parameter

#### Test Case 1.2: Source Filter Persistence
- [ ] Filter by a specific source
- [ ] Refresh the page
- [ ] Verify the source filter is maintained
- [ ] Verify the same newsletters are still displayed

#### Test Case 1.3: Clear Source Filter
- [ ] Apply a source filter
- [ ] Select "All Sources" from dropdown
- [ ] Verify all newsletters are displayed again
- [ ] Verify URL parameter is removed

### 2. Unread Count Display

#### Test Case 2.1: Sidebar Unread Count (Global)
- [ ] Navigate to any page
- [ ] Verify inbox link shows total unread count badge
- [ ] Mark a newsletter as read
- [ ] Verify inbox badge count decreases
- [ ] Mark a newsletter as unread
- [ ] Verify inbox badge count increases

#### Test Case 2.2: Source-Specific Unread Counts in Sidebar
- [ ] Look at the "Sources" section in sidebar
- [ ] Verify up to 10 sources are displayed
- [ ] Verify sources with unread newsletters show orange badges
- [ ] Verify badge numbers match actual unread counts
- [ ] Click on a source in sidebar
- [ ] Verify navigation to inbox with source filter applied

#### Test Case 2.3: Source Filter Dropdown Unread Counts
- [ ] Navigate to `/inbox`
- [ ] Open source filter dropdown
- [ ] Verify sources with unread newsletters show count badges
- [ ] Verify count numbers are accurate
- [ ] Select a source with unread newsletters
- [ ] Apply unread filter
- [ ] Verify displayed count matches badge count

### 3. Newsletter Sources Page

#### Test Case 3.1: Source Count Display
- [ ] Navigate to `/newsletters`
- [ ] Verify each source shows total newsletter count (blue badge)
- [ ] Verify sources with unread newsletters show unread count (orange badge)
- [ ] Verify counts are accurate

#### Test Case 3.2: Source Count Updates
- [ ] Note current counts for a source
- [ ] Navigate to inbox and filter by that source
- [ ] Mark some newsletters as read
- [ ] Return to `/newsletters`
- [ ] Verify unread count decreased appropriately
- [ ] Verify total count remained the same

### 4. Real-time Updates

#### Test Case 4.1: Cross-Tab Updates
- [ ] Open Newsletter Hub in two browser tabs
- [ ] In tab 1, navigate to inbox
- [ ] In tab 2, navigate to newsletters page
- [ ] In tab 1, mark newsletters as read/unread
- [ ] In tab 2, verify counts update automatically
- [ ] Switch tabs and verify sidebar counts update

#### Test Case 4.2: Source Filter Real-time Updates
- [ ] Open inbox with source filter applied
- [ ] In another tab, mark newsletters from that source as read
- [ ] Return to filtered inbox
- [ ] Verify newsletter list updates
- [ ] Verify counts in sidebar update

### 5. Performance Testing

#### Test Case 5.1: Large Source Lists
- [ ] Ensure more than 10 sources exist
- [ ] Verify sidebar shows only 10 sources
- [ ] Verify "View all X sources..." link appears
- [ ] Click link and verify navigation to newsletters page
- [ ] Verify source filter dropdown shows all sources

#### Test Case 5.2: Response Times
- [ ] Time source filter application
- [ ] Time unread count updates
- [ ] Time sidebar source list loading
- [ ] Verify all operations complete within 2 seconds

### 6. Edge Cases

#### Test Case 6.1: No Unread Newsletters
- [ ] Mark all newsletters as read
- [ ] Verify no unread count badges appear
- [ ] Verify inbox badge is hidden
- [ ] Verify sidebar sources show no badges

#### Test Case 6.2: Source with No Newsletters
- [ ] Create a source with no newsletters
- [ ] Verify it appears in source lists
- [ ] Verify it shows 0 newsletter count
- [ ] Verify no unread count badge appears

#### Test Case 6.3: Archived Newsletters
- [ ] Archive some newsletters
- [ ] Verify archived newsletters don't affect unread counts
- [ ] Verify archived newsletters don't appear in source filters
- [ ] Filter by archived newsletters
- [ ] Verify source filter still works correctly

### 7. Error Handling

#### Test Case 7.1: Network Errors
- [ ] Simulate network disconnection
- [ ] Verify cached counts are still displayed
- [ ] Verify graceful error handling
- [ ] Restore network connection
- [ ] Verify counts update when connection restored

#### Test Case 7.2: Missing Source Data
- [ ] Test with newsletter that has null source_id
- [ ] Verify it appears under "Unknown" source
- [ ] Verify counts are still accurate

### 8. Accessibility

#### Test Case 8.1: Keyboard Navigation
- [ ] Use Tab key to navigate source filter dropdown
- [ ] Use Enter/Space to select sources
- [ ] Use Escape to close dropdown
- [ ] Verify all interactions work without mouse

#### Test Case 8.2: Screen Reader Support
- [ ] Verify badges have appropriate aria-labels
- [ ] Verify source filter dropdown has proper labeling
- [ ] Verify count changes announce properly

### 9. Mobile Responsiveness

#### Test Case 9.1: Mobile Source Filtering
- [ ] Test on mobile device or responsive mode
- [ ] Verify source filter dropdown works on touch
- [ ] Verify sidebar source list is accessible
- [ ] Verify counts are readable on small screens

#### Test Case 9.2: Mobile Sidebar
- [ ] Test sidebar toggle on mobile
- [ ] Verify source list scrolls properly
- [ ] Verify touch interactions work for source selection

## Expected Results

### Functional Requirements
- ✅ Source filtering works correctly across all views
- ✅ Unread counts are accurate and update in real-time
- ✅ UI consistently shows counts across all components
- ✅ URL state is properly maintained for source filters
- ✅ Performance is acceptable for typical usage

### Visual Requirements
- ✅ Unread count badges use consistent styling
- ✅ Source filter dropdown is intuitive and accessible
- ✅ Sidebar source list is cleanly organized
- ✅ Newsletter sources page clearly displays counts

### Technical Requirements
- ✅ No console errors during normal operation
- ✅ Proper cache invalidation on count changes
- ✅ Efficient database queries for count operations
- ✅ Graceful error handling for edge cases

## Bug Reporting Template

If issues are found, report them using this template:

```
**Bug Title:** [Brief description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Environment:**
- Browser: [Browser name and version]
- Device: [Desktop/Mobile]
- Screen size: [If relevant]

**Additional Notes:**
[Any other relevant information]
```

## Performance Benchmarks

Document actual performance metrics:

- Source filter application time: _____ ms
- Unread count update time: _____ ms
- Sidebar loading time: _____ ms
- Real-time update propagation: _____ ms

## Sign-off

Testing completed by: ________________
Date: ________________
All test cases passed: ☐ Yes ☐ No
Notes: ________________________________