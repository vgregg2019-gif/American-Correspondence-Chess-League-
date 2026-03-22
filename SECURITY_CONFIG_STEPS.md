# Security Configuration Steps

This document outlines the manual configuration steps needed in the Supabase Dashboard to complete the security improvements.

## ✅ Completed (via Migration)

1. **Added index for moves.player_id foreign key** - Critical for query performance
2. **Removed unused indexes** - Reduces storage and write overhead

## 🔧 Manual Configuration Required

The following settings must be configured in the Supabase Dashboard as they cannot be automated via SQL migrations:

### 1. Auth DB Connection Strategy

**Issue:** Auth server using fixed connection pool (10 connections) instead of percentage-based allocation.

**Steps:**
1. Navigate to Supabase Dashboard → Project Settings → Database
2. Go to "Connection Pooling" section
3. Find "Auth Server" connection pool settings
4. Change connection strategy from "Fixed" to "Percentage"
5. Set Auth connections to use 10-15% of total connection pool
6. Click "Save"

**Why:** Percentage-based allocation automatically scales with instance size upgrades.

### 2. Leaked Password Protection

**Issue:** HaveIBeenPwned.org password checking is disabled.

**Steps:**
1. Navigate to Supabase Dashboard → Authentication → Settings
2. Scroll to "Security and Protection" section
3. Find "Leaked Password Protection" toggle
4. Enable "Check passwords against HaveIBeenPwned"
5. Click "Save"

**Why:** Prevents users from using compromised passwords, significantly improving account security.

## Configuration Impact

- **Performance:** Index improvements will speed up move history queries
- **Security:** Password protection prevents use of known compromised credentials
- **Scalability:** Percentage-based Auth connections scale with database instance

## Verification

After applying these changes:

1. Check indexes: Run `\di` in Supabase SQL Editor to verify indexes
2. Test Auth: Try registering with a known leaked password (should be rejected)
3. Monitor performance: Check query execution times for move history queries
