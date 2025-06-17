# Newsletter Navigation Feature - Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the newsletter navigation feature that allows users to navigate between newsletters in the inbox using next/previous buttons and keyboard shortcuts.

## Feature Description
The newsletter navigation feature adds:
- **Navigation buttons**: Previous and Next buttons in the newsletter detail view
- **Position counter**: Shows current position (e.g., "2 of 15")
- **Keyboard shortcuts**: Arrow keys (←/→) and J/K keys for navigation
- **Context awareness**: Respects current inbox filters (tags, read status, etc.)
- **Auto-mark as read**: Automatically marks newsletters as read when viewing them
- **Accessibility**: ARIA labels, tooltips, and keyboard support

## Prerequisites
1. Ensure the development server is running (`npm run dev`)
2. Have at least 3-5 newsletters in your inbox for testing
3. Ensure newsletters have different received dates for proper ordering

## Test Cases

### 1. Basic Navigation UI
**Objective**: Verify navigation components render correctly

**Steps**:
1. Navigate to any newsletter detail page (e.g., `/newsletters/{id}`)
2. Look for the navigation component below the back button

**Expected Results**:
- Navigation component is visible with Previous/Next buttons
- Position counter shows current position (e.g., "2 of 15")
- Both buttons have proper styling and hover effects

### 2. Navigation Button Functionality
**Objective**: Test previous/next button clicks

**Steps**:
1. Open a newsletter in the middle of your inbox (not first or last)
2. Click the "Previous" button
3. Verify you navigate to the previous newsletter (more recent)
4. Click the "Next" button
5. Verify you navigate to the next newsletter (older)

**Expected Results**:
- Previous button navigates to more recent newsletter
- Next button navigates to older newsletter
- URL updates correctly
- Newsletter content loads properly
- Position counter updates

### 3. Boundary Conditions
**Objective**: Test navigation at list boundaries

**Steps**:
1. Navigate to the first newsletter in your inbox
2. Check Previous button state
3. Navigate to the last newsletter in your inbox
4. Check Next button state

**Expected Results**:
- Previous button is disabled on first newsletter
- Next button is disabled on last newsletter
- Disabled buttons have proper visual styling
- Tooltips show appropriate messages

### 4. Keyboard Navigation
**Objective**: Test keyboard shortcuts

**Steps**:
1. Open any newsletter detail page
2. Press the left arrow key (←)
3. Press the right arrow key (→)
4. Try the J key (previous)
5. Try the K key (next)

**Expected Results**:
- Left arrow and J key navigate to previous newsletter
- Right arrow and K key navigate to next newsletter
- Navigation works same as button clicks
- No navigation when input fields are focused

### 5. Filter Context Preservation
**Objective**: Ensure navigation respects inbox filters

**Steps**:
1. Go to the inbox (`/inbox`)
2. Apply a filter (e.g., unread newsletters only)
3. Open a newsletter from the filtered list
4. Use navigation buttons to move between newsletters

**Expected Results**:
- Navigation only moves between newsletters matching the filter
- Position counter reflects filtered list size
- Navigation maintains filter context

### 6. Performance and Loading
**Objective**: Test loading states and performance

**Steps**:
1. Open a newsletter near the end of a large list
2. Navigate towards newsletters that haven't been loaded yet
3. Observe loading states

**Expected Results**:
- Loading indicators appear when fetching more data
- Navigation remains responsive
- No errors in console
- Smooth transitions between newsletters

### 7. Accessibility Testing
**Objective**: Verify accessibility features

**Steps**:
1. Use tab navigation to reach navigation buttons
2. Check button focus states
3. Use screen reader to verify ARIA labels
4. Test with keyboard-only navigation

**Expected Results**:
- All buttons are keyboard accessible
- Focus indicators are visible
- ARIA labels are descriptive
- Tooltips provide helpful information

### 8. Auto-Mark as Read Functionality
**Objective**: Verify newsletters are automatically marked as read

**Steps**:
1. Go to inbox and identify an unread newsletter
2. Note that the newsletter shows as unread (bold text, unread indicator)
3. Open the newsletter detail page
4. Wait 2-3 seconds
5. Navigate back to inbox or use browser back button
6. Check the newsletter's read status

**Expected Results**:
- Newsletter automatically marked as read after viewing for 2 seconds
- No manual action required to mark as read
- Read status persists when navigating away and back
- Navigation between newsletters also triggers auto-mark

### 9. Auto-Mark During Navigation
**Objective**: Test auto-mark when using navigation buttons

**Steps**:
1. Open an unread newsletter in detail view
2. Wait for it to be auto-marked as read (2 seconds)
3. Use Previous/Next navigation to go to another unread newsletter
4. Wait 2 seconds on the new newsletter
5. Check that both newsletters are now marked as read

**Expected Results**:
- Each newsletter visited is automatically marked as read
- No toasts or notifications for auto-marking (silent operation)
- Read status updates immediately in the background
- Navigation maintains smooth UX without interruption

### 10. Mobile Responsiveness
**Objective**: Test on mobile devices

**Steps**:
1. Open newsletter detail on mobile device
2. Test button touch targets
3. Verify layout doesn't break
4. Test auto-mark functionality on mobile

**Expected Results**:
- Buttons are easily tappable
- Layout remains readable
- Navigation works on touch devices
- Auto-mark functionality works on mobile

## Error Scenarios

### 1. Network Issues
**Test**: Disconnect network while navigating
**Expected**: Graceful error handling, no crashes

### 2. Missing Newsletter
**Test**: Navigate to a newsletter that was deleted
**Expected**: Appropriate error message, fallback navigation

### 3. Empty Inbox
**Test**: Try navigation with no newsletters
**Expected**: Navigation component doesn't render or shows appropriate message

## Browser Compatibility
Test the feature in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Benchmarks
- Initial load should be under 2 seconds
- Navigation between newsletters should be under 1 second
- No memory leaks during extended navigation sessions

## Common Issues and Troubleshooting

### Navigation buttons not appearing
- Check if newsletter ID is valid
- Verify inbox has multiple newsletters
- Check console for errors

### Keyboard shortcuts not working
- Ensure no input fields are focused
- Check if component is properly mounted
- Verify event listeners are attached

### Wrong navigation order
- Verify newsletters are sorted by received_at desc
- Check if filters are applied correctly
- Ensure infinite scroll data is loading properly

### Position counter showing wrong numbers
- Check totalCount from infinite query
- Verify currentIndex calculation
- Ensure newsletter is found in the list

### Auto-mark not working
- Check console for errors related to markAsRead
- Verify newsletter has is_read: false initially
- Ensure 2-second delay is completing
- Check network requests for mark-as-read API calls

### Newsletters marked as read too quickly
- Verify the 2-second delay is working
- Check if auto-mark is being triggered multiple times
- Ensure navigation doesn't trigger immediate marking

## Reporting Issues
When reporting bugs, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (if any)
5. Network requests (if relevant)

## Feature Verification Checklist
- [ ] Navigation buttons render correctly
- [ ] Previous/Next functionality works
- [ ] Keyboard shortcuts work
- [ ] Position counter is accurate
- [ ] Boundary conditions handled
- [ ] Filter context preserved
- [ ] Loading states work
- [ ] Auto-mark as read works on detail view
- [ ] Auto-mark as read works during navigation
- [ ] No unwanted toasts for auto-marking
- [ ] Read status persists correctly
- [ ] Accessibility features present
- [ ] Mobile responsive
- [ ] Error handling works
- [ ] Performance is acceptable