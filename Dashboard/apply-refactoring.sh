#!/bin/bash

# Dashboard Refactoring Application Script
# This script applies the professional refactoring to your crowd monitoring dashboard

echo "=========================================="
echo " FestNet Dashboard Refactoring Script"
echo "=========================================="
echo ""

# Navigate to crowd monitoring feature directory
cd "$(dirname "$0")/src/features/crowd_monitoring" || exit

echo "📁 Creating backups of original files..."

# Create backup directory
mkdir -p .backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".backups/$(date +%Y%m%d_%H%M%S)"

# Backup original files
if [ -f "pages/CrowdMonitoringPage.tsx" ]; then
  cp pages/CrowdMonitoringPage.tsx "$BACKUP_DIR/CrowdMonitoringPage.original.tsx"
  echo "✅ Backed up CrowdMonitoringPage.tsx"
fi

if [ -f "components/SurgeAlertBanner.tsx" ]; then
  cp components/SurgeAlertBanner.tsx "$BACKUP_DIR/SurgeAlertBanner.original.tsx"
  echo "✅ Backed up SurgeAlertBanner.tsx"
fi

if [ -f "components/ZoneDrawerModal.tsx" ]; then
  cp components/ZoneDrawerModal.tsx "$BACKUP_DIR/ZoneDrawerModal.original.tsx"
  echo "✅ Backed up ZoneDrawerModal.tsx"
fi

echo ""
echo "🔄 Applying refactored versions..."

# Apply refactored files
if [ -f "pages/CrowdMonitoringPage.refactored.tsx" ]; then
  mv pages/CrowdMonitoringPage.refactored.tsx pages/CrowdMonitoringPage.tsx
  echo "✅ Applied CrowdMonitoringPage refactoring"
fi

if [ -f "components/SurgeAlertBanner.refactored.tsx" ]; then
  mv components/SurgeAlertBanner.refactored.tsx components/SurgeAlertBanner.tsx
  echo "✅ Applied SurgeAlertBanner refactoring"
fi

if [ -f "components/ZoneDrawerModal.refactored.tsx" ]; then
  mv components/ZoneDrawerModal.refactored.tsx components/ZoneDrawerModal.tsx
  echo "✅ Applied ZoneDrawerModal refactoring"
fi

echo ""
echo "✨ Refactoring complete!"
echo ""
echo "📋 What changed:"
echo "  ✓ Removed all inline styles → CSS modules"
echo "  ✓ Removed emojis → Professional icon components"
echo "  ✓ Extracted magic numbers → Named constants"
echo "  ✓ Added loading and error states"
echo "  ✓ Created reusable components"
echo ""
echo "📂 Backups saved to: $BACKUP_DIR"
echo ""
echo "🧪 Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Test all functionality"
echo "  3. Check responsive design"
echo "  4. Review browser console for errors"
echo ""
echo "🔄 To rollback (if needed):"
echo "  cp $BACKUP_DIR/*.tsx pages/"
echo "  cp $BACKUP_DIR/*.tsx components/"
echo ""
echo "=========================================="
