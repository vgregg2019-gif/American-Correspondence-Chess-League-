# Supabase Project Configuration Fix

## Summary

Fixed the 401 Unauthorized error on POST /api/move by correcting the Supabase project configuration.

## Root Cause

The `.env` file was pointing to the wrong Supabase project (`biakfxjkrwojkmiggknr`), while all migrations and data were in project `ukdoozqwekwlupxurswt`. This caused authentication cookies to be created for one project but validated against a different project, resulting in "No session" errors.

## Changes Made

### File Modified: `.env`

**Before:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://biakfxjkrwojkmiggknr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWtmeGprcndvamttaWdna25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjIzNzksImV4cCI6MjA4OTkzODM3OX0.302tu-L7EiHopttCNa8QfLU02XsuiXd5-0Tuiy0LTZo
```

**After:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://ukdoozqwekwlupxurswt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG9venF3ZWt3bHVweHVyc3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTA2MDEsImV4cCI6MjA4ODQyNjYwMX0.bNAY7bwEF6C20wTCCAYGUJZy9b8etuJ-e3Ug92okWKM
```

## Verification

### 1. Environment Configuration
✅ `.env` file now points to `https://ukdoozqwekwlupxurswt.supabase.co`
✅ ANON_KEY JWT contains correct project ref: `"ref":"ukdoozqwekwlupxurswt"`

### 2. Code Scan
✅ No hardcoded references to old project IDs (`0ec90b57d6e95fcbda19832f`, `biakfxjkrwojkmiggknr`) found in source code
✅ All test files already use correct project URL
✅ No .bolt directory or Bolt-managed overrides found

### 3. Build Verification
✅ Production build successful
✅ Build logs confirm: `urlHost: 'ukdoozqwekwlupxurswt.supabase.co'`

### 4. Authentication Flow (No Changes Needed)
✅ Fetch call already includes `credentials: 'include'` (line 481, app/game/[id]/page.tsx)
✅ API route correctly uses `createServerClient(req)` to read cookies
✅ Middleware correctly refreshes session

## Final Active Configuration

**Supabase Project ID:** `ukdoozqwekwlupxurswt`
**Supabase URL:** `https://ukdoozqwekwlupxurswt.supabase.co`
**Project Status:** Active and configured correctly

## Old Project IDs Removed

- ❌ `0ec90b57d6e95fcbda19832f` - Not found in any active configuration
- ❌ `biakfxjkrwojkmiggknr` - Removed from .env file

## Expected Result

The 401 Unauthorized error should now be resolved. Users can:
1. Log in successfully
2. View games and profiles
3. Make moves in active games
4. All authenticated API routes work correctly

## Notes

- No code changes were required - the authentication logic was already correct
- The issue was purely a configuration mismatch between environment and database
- All database migrations are in the correct project (`ukdoozqwekwlupxurswt`)
- The fix ensures cookies and session validation use the same Supabase project
