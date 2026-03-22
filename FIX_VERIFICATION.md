# Fix Verification - Step by Step

## What Was Fixed

1. **Browser client** (`lib/supabaseClient.ts`) - Simplified to use default `@supabase/ssr` cookie handling
2. **Server API** (`app/api/move/route.ts`) - Uses `getSession()` for reliable cookie-based auth
3. **Added logging** - Detailed console output to diagnose auth flow

## Testing Steps

### 1. Clear Old Session
- DevTools → Application → Clear all storage
- Log out and log back in
- This creates fresh cookie-based session

### 2. Check Cookies After Login
- DevTools → Application → Cookies
- Look for `sb-gmnmqimbghfaxcprjwxg-auth-token`
- If missing: Login not creating cookies

### 3. Make a Move
- Open Console
- Move a piece
- Watch for these logs:

**Success**:
```
[Move API] Request cookies: {count: 3, authCookies: [...]}
[Move API] Session check: {hasSession: true}
[Move API] ✓ Move processed successfully
```

**Failure**:
```
[Move API] Request cookies: {count: 0}
[Frontend Move] X Server rejected move - rolling back: Not authenticated
```

### 4. Verify Persistence
- Navigate away
- Return to game
- Board should show your move, not starting position

## What to Check If Still Failing

Tell me:
1. Are there `sb-` cookies in DevTools after login?
2. What does `[Move API] Request cookies:` show in console?
3. Does board reset to starting position after reload?

This will pinpoint exact issue.
