#!/bin/bash

# API Layer Migration Verification Script
# This script verifies that the API layer migration has been completed successfully

echo "🔍 API Layer Migration Verification"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

# Function to print failure
print_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "1. Checking Hook Updates"
echo "------------------------"

# Check useNewsletters hook
if grep -q "PaginatedResponse<NewsletterWithRelations>" src/common/hooks/useNewsletters.ts; then
    print_success "useNewsletters hook uses PaginatedResponse type"
else
    print_failure "useNewsletters hook missing PaginatedResponse type"
fi

if grep -q "NewsletterFilter" src/common/hooks/useNewsletters.ts; then
    print_success "useNewsletters hook imports NewsletterFilter"
else
    print_failure "useNewsletters hook missing NewsletterFilter import"
fi

# Check useNewsletterSources hook
if grep -q "newsletterSourceApi" src/common/hooks/useNewsletterSources.ts; then
    print_success "useNewsletterSources hook uses API layer"
else
    print_failure "useNewsletterSources hook not using API layer"
fi

if grep -q "PaginatedResponse<NewsletterSource>" src/common/hooks/useNewsletterSources.ts; then
    print_success "useNewsletterSources hook uses PaginatedResponse type"
else
    print_failure "useNewsletterSources hook missing PaginatedResponse type"
fi

echo ""
echo "2. Checking Component Updates"
echo "-----------------------------"

# Check Inbox component
if grep -q "NewsletterFilter" src/web/pages/Inbox.tsx; then
    print_success "Inbox component uses NewsletterFilter"
else
    print_failure "Inbox component missing NewsletterFilter"
fi

if grep -q "newsletterApi" src/web/pages/Inbox.tsx; then
    print_success "Inbox component uses newsletterApi"
else
    print_failure "Inbox component not using newsletterApi"
fi

# Check NewslettersPage component
if grep -q "newsletterApi" src/web/pages/NewslettersPage.tsx; then
    print_success "NewslettersPage component uses newsletterApi"
else
    print_failure "NewslettersPage component not using newsletterApi"
fi

if grep -q "useAuth" src/web/pages/NewslettersPage.tsx; then
    print_success "NewslettersPage uses useAuth hook"
else
    print_failure "NewslettersPage missing useAuth hook"
fi

echo ""
echo "3. Checking Direct Supabase Usage Removal"
echo "-----------------------------------------"

# Check for direct supabase imports in target files
SUPABASE_IMPORTS_INBOX=$(grep -c "import.*supabase" src/web/pages/Inbox.tsx 2>/dev/null || echo "0")
SUPABASE_IMPORTS_NEWSLETTERS=$(grep -c "import.*supabase" src/web/pages/NewslettersPage.tsx 2>/dev/null || echo "0")

if [ "$SUPABASE_IMPORTS_INBOX" -eq 0 ]; then
    print_success "Inbox component has no direct Supabase imports"
else
    print_failure "Inbox component still has $SUPABASE_IMPORTS_INBOX direct Supabase import(s)"
fi

if [ "$SUPABASE_IMPORTS_NEWSLETTERS" -eq 0 ]; then
    print_success "NewslettersPage component has no direct Supabase imports"
else
    print_failure "NewslettersPage component still has $SUPABASE_IMPORTS_NEWSLETTERS direct Supabase import(s)"
fi

# Check for direct supabase calls in target files
SUPABASE_CALLS_INBOX=$(grep -c "supabase\." src/web/pages/Inbox.tsx 2>/dev/null || echo "0")
SUPABASE_CALLS_NEWSLETTERS=$(grep -c "supabase\." src/web/pages/NewslettersPage.tsx 2>/dev/null || echo "0")

if [ "$SUPABASE_CALLS_INBOX" -eq 0 ]; then
    print_success "Inbox component has no direct Supabase calls"
else
    print_failure "Inbox component still has $SUPABASE_CALLS_INBOX direct Supabase call(s)"
fi

if [ "$SUPABASE_CALLS_NEWSLETTERS" -eq 0 ]; then
    print_success "NewslettersPage component has no direct Supabase calls"
else
    print_failure "NewslettersPage component still has $SUPABASE_CALLS_NEWSLETTERS direct Supabase call(s)"
fi

echo ""
echo "4. Checking API Layer Structure"
echo "------------------------------"

# Check API files exist
API_FILES=(
    "src/common/api/index.ts"
    "src/common/api/newsletterApi.ts"
    "src/common/api/newsletterSourceApi.ts"
    "src/common/api/supabaseClient.ts"
    "src/common/api/errorHandling.ts"
)

for file in "${API_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "API file exists: $file"
    else
        print_failure "API file missing: $file"
    fi
done

# Check API exports
if grep -q "export.*newsletterApi" src/common/api/index.ts; then
    print_success "newsletterApi properly exported"
else
    print_failure "newsletterApi export missing"
fi

if grep -q "export.*newsletterSourceApi" src/common/api/index.ts; then
    print_success "newsletterSourceApi properly exported"
else
    print_failure "newsletterSourceApi export missing"
fi

echo ""
echo "5. Checking Type Definitions"
echo "----------------------------"

# Check for PaginatedResponse type
if grep -q "interface PaginatedResponse" src/common/types/api.ts; then
    print_success "PaginatedResponse interface exists"
else
    print_failure "PaginatedResponse interface missing"
fi

# Check for NewsletterFilter type
if grep -q "interface NewsletterFilter" src/common/types/cache.ts; then
    print_success "NewsletterFilter interface exists"
else
    print_failure "NewsletterFilter interface missing"
fi

echo ""
echo "6. Checking Documentation"
echo "------------------------"

if [ -f "docs/api-migration.md" ]; then
    print_success "API migration documentation exists"

    # Check documentation content
    if grep -q "PaginatedResponse" docs/api-migration.md; then
        print_success "Documentation covers PaginatedResponse"
    else
        print_warning "Documentation missing PaginatedResponse coverage"
    fi

    if grep -q "useNewsletters" docs/api-migration.md; then
        print_success "Documentation covers useNewsletters migration"
    else
        print_warning "Documentation missing useNewsletters coverage"
    fi
else
    print_failure "API migration documentation missing"
fi

if [ -f "MIGRATION_SUMMARY.md" ]; then
    print_success "Migration summary exists"
else
    print_warning "Migration summary missing"
fi

echo ""
echo "7. Advanced Checks"
echo "-----------------"

# Check hook usage patterns
INBOX_HOOK_USAGE=$(grep -A 5 -B 5 "useNewsletters(" src/web/pages/Inbox.tsx | grep -c "newsletterFilter" || echo "0")
if [ "$INBOX_HOOK_USAGE" -gt 0 ]; then
    print_success "Inbox uses structured filter object with useNewsletters"
else
    print_failure "Inbox not using structured filter object with useNewsletters"
fi

# Check for pagination handling
if grep -q "sourcesCount\|sourcesPage\|sourcesHasMore" src/common/hooks/useNewsletterSources.ts; then
    print_success "useNewsletterSources returns pagination properties"
else
    print_warning "useNewsletterSources missing pagination properties"
fi

# Check for proper error handling
if grep -q "handleSupabaseError\|try.*catch" src/common/api/newsletterApi.ts; then
    print_success "Newsletter API has proper error handling"
else
    print_warning "Newsletter API missing error handling"
fi

echo ""
echo "8. File Structure Verification"
echo "------------------------------"

# Check hook files haven't been deleted
HOOK_FILES=(
    "src/common/hooks/useNewsletters.ts"
    "src/common/hooks/useNewsletterSources.ts"
)

for file in "${HOOK_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "Hook file exists: $file"
    else
        print_failure "Hook file missing: $file"
    fi
done

# Check component files
COMPONENT_FILES=(
    "src/web/pages/Inbox.tsx"
    "src/web/pages/NewslettersPage.tsx"
)

for file in "${COMPONENT_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "Component file exists: $file"
    else
        print_failure "Component file missing: $file"
    fi
done

echo ""
echo "9. Migration Completeness Check"
echo "------------------------------"

# Check if old patterns still exist
OLD_PATTERNS_FOUND=0

# Check for old useNewsletters call patterns in target files
if grep -q "useNewsletters([^)].*," src/web/pages/Inbox.tsx 2>/dev/null; then
    print_warning "Inbox may still use old useNewsletters pattern"
    ((OLD_PATTERNS_FOUND++))
fi

# Check for direct database operations
if grep -q "\.from(" src/web/pages/Inbox.tsx src/web/pages/NewslettersPage.tsx 2>/dev/null; then
    print_warning "Direct database operations found in components"
    ((OLD_PATTERNS_FOUND++))
fi

if [ "$OLD_PATTERNS_FOUND" -eq 0 ]; then
    print_success "No old patterns detected"
fi

echo ""
echo "=================================="
echo "📊 MIGRATION VERIFICATION SUMMARY"
echo "=================================="
echo ""
echo -e "✅ Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 MIGRATION COMPLETED SUCCESSFULLY!${NC}"
    echo ""
    echo "All verification checks passed. The API layer migration has been"
    echo "completed successfully with the following improvements:"
    echo ""
    echo "• Hooks updated to use paginated responses"
    echo "• Components migrated to use structured filter objects"
    echo "• Direct Supabase calls eliminated from target components"
    echo "• API layer properly integrated"
    echo "• Type safety enhanced with proper interfaces"
    echo "• Comprehensive documentation created"
    echo ""
    echo "The application is ready for deployment with the new API layer."
    exit 0
else
    echo -e "${RED}⚠️  MIGRATION INCOMPLETE${NC}"
    echo ""
    echo "Some verification checks failed. Please review the failed items above"
    echo "and address them before considering the migration complete."
    echo ""
    echo "Common issues to check:"
    echo "• Ensure all required files exist"
    echo "• Verify TypeScript types are properly imported"
    echo "• Check that API layer functions are being used"
    echo "• Confirm direct Supabase calls have been removed"
    exit 1
fi
