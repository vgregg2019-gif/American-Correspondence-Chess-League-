# Runtime Authentication Trace Guide

## What To Look For When Testing

### 1. After Login
**Open DevTools → Application → Cookies**

✅ **Success**: You should see cookies like:
```
sb-gmnmqimbghfaxcprjwxg-auth-token
sb-gmnmqimbghfaxcprjwxg-auth-token-code-verifier
```

❌ **Problem**: If you don't see these cookies, auth is still in localStorage

### 2. When Making a Move
**Open DevTools → Console**

✅ **Success**: You should see:
```
[Frontend Move] ✓ Move validated locally: e4
[Frontend Move] ✓ Session valid
[Move API] ===== NEW MOVE REQUEST =====
[Move API] Request cookies: {
  count: 3,
  names: ['sb-...', 'sb-...'],
  authCookies: [{ name: 'sb-...', valueLength: 800 }]
}
[Move API] Session check: { hasSession: true, sessionUserId: '...' }
[Move API] Auth validated: { userId: '...', match: true }
[Move API] ✓ Move processed successfully
[Frontend Move] ✓ Server confirmed move
```

❌ **Problem**: If you see:
```
[Move API] Request cookies: { count: 0, names: [], authCookies: [] }
[Move API] Session check: { hasSession: false }
[Frontend Move] X Server rejected move - rolling back: Not authenticated
```

This means cookies are not being sent or stored.

### 3. After Page Reload
**Navigate away, then return to game**

✅ **Success**: 
- Board shows the position after your move
- Move list contains your moves
- Clock shows updated time
- Console shows correct FEN (not starting FEN)

❌ **Problem**:
- Board resets to starting position
- Move list is empty
- Clock shows starting time (e.g., 5:00:00)
- Console shows: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`

## Diagnostic Decision Tree

```
Can you log in?
├─ NO → Check credentials, Supabase connection
└─ YES → Do you see auth cookies in DevTools?
    ├─ NO → Browser client not using cookies (check lib/supabaseClient.ts)
    └─ YES → Does the move API log show cookies?
        ├─ NO → Cookies not sent with request (check credentials: 'include')
        └─ YES → Does session check show hasSession: true?
            ├─ NO → Server can't read cookies (check lib/supabaseServer.ts)
            └─ YES → Does move get saved?
                ├─ NO → Check database permissions, RLS policies
                └─ YES → SUCCESS! Everything working ✅
```

## Quick Test Script

1. Log in
2. Go to dashboard
3. Create or join a game
4. Open Console (F12)
5. Make a move: e2 → e4
6. Look for "Server confirmed move"
7. Click "← Back to Dashboard"
8. Click the game again
9. Verify board shows e4 move

## Common Issues and Solutions

### Issue: Cookies Not Created
**Symptom**: No `sb-` cookies in DevTools
**Cause**: Browser client using localStorage
**Fix**: Already fixed in `lib/supabaseClient.ts` - explicit cookie config

### Issue: Cookies Not Sent
**Symptom**: API logs `count: 0`
**Cause**: Missing `credentials: 'include'` in fetch
**Fix**: Already fixed in `app/game/[id]/page.tsx:483`

### Issue: Cookies Not Read
**Symptom**: Cookies present but API says "Not authenticated"
**Cause**: Server client not reading cookies correctly
**Fix**: Already fixed in `lib/supabaseServer.ts` - proper cookie handlers

### Issue: Wrong Auth Method
**Symptom**: Cookies present, read correctly, but auth still fails
**Cause**: Using `getUser()` which makes API call instead of reading cookie
**Fix**: Already fixed in `app/api/move/route.ts` - use `getSession()`

## Success Indicators

✅ Console shows: `[Move API] Session check: { hasSession: true }`
✅ Console shows: `[Move API] ✓ Move processed successfully`
✅ Board persists position after reload
✅ No "Not authenticated" errors
✅ Moves appear in database
✅ Clock updates correctly

## Files to Check If Issues Persist

1. `/lib/supabaseClient.ts` - Cookie storage config
2. `/lib/supabaseServer.ts` - Server cookie reading
3. `/app/api/move/route.ts` - Session validation
4. `/app/game/[id]/page.tsx` - Credentials include
