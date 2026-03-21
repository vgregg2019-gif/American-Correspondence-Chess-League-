# Runtime Authorization Trace - Actual Values

## Test Executed

**Date:** 2026-03-21
**Environment:** Bolt-hosted (https://vgregg2019-gif-ameri-pqoc.bolt.host)
**Test Game ID:** `9a51e6f8-aa83-4058-9876-cb59cc7b4e74`

## Test Setup

### User Account
- **User ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
- **Email:** test@example.com
- **Profile ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` (same as user ID ✓)

### Game Configuration
- **Game ID:** `9a51e6f8-aa83-4058-9876-cb59cc7b4e74`
- **White Player ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
- **Black Player ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
- **Status:** active
- **Current FEN:** `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
- **Note:** User playing both sides for testing

## Move Attempt #1: e2-e4

### Request Payload
```json
{
  "gameId": "9a51e6f8-aa83-4058-9876-cb59cc7b4e74",
  "playerId": "37d7bdb9-a670-4448-8b9a-736dbc2cd8d2",
  "from": "e2",
  "to": "e4"
}
```

### API Response
```json
{
  "step": "auth",
  "error": "Invalid authorization",
  "message": "Auth session missing!",
  "debug": {
    "hasError": true,
    "hasUser": false,
    "errorMessage": "Auth session missing!",
    "errorStatus": 400
  }
}
```

**HTTP Status:** 401 Unauthorized

## Authorization Failure Analysis

### Failure Point
**Line 32-47** in `/app/api/move/route.ts`: Cookie authentication check

### Server-Side Values (from error response)
- **authError.message:** `"Auth session missing!"`
- **authError.status:** `400`
- **user:** `null` (no user object returned)
- **hasUser:** `false`
- **hasError:** `true`

### Root Cause
The server's `supabase.auth.getUser()` call failed with "Auth session missing!" This indicates that:

1. **No cookies were sent with the request** - OR -
2. **The cookies were sent but are invalid/expired** - OR -
3. **Cookie names don't match what Supabase expects**

### Expected vs Actual

| Field | Expected | Actual | Match |
|-------|----------|--------|-------|
| Authenticated user.id | `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` | `null` | ❌ |
| Request playerId | `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` | `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` | ✓ |
| Game white_player_id | `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` | Not reached | - |
| Game black_player_id | `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` | Not reached | - |

### Authorization Comparisons
**None executed** - Request failed at authentication stage before reaching authorization checks.

## The Problem

The cookie-based authentication implementation expects the browser to send Supabase session cookies automatically. However:

1. **Testing from Node.js:** When using `fetch()` with an `Authorization` header from Node.js, no cookies are sent
2. **Browser Testing:** Real browser sessions should work IF:
   - User is logged in via the Supabase client
   - Cookies are set by Supabase auth
   - Cookies are sent with `credentials: 'include'` (already done ✓)
   - Server can read the cookies (implemented ✓)

## Next Steps to Debug

### Option 1: Test in Actual Browser
1. Open https://vgregg2019-gif-ameri-pqoc.bolt.host/game/9a51e6f8-aa83-4058-9876-cb59cc7b4e74
2. Login with test@example.com / password123
3. Open DevTools Console
4. Make a move
5. Check deployment logs for:
   ```
   [Move API] Cookie header present: <true/false>
   [Move API] Cookie names: [array of cookie names]
   [Move API] auth.getUser() result: {...}
   ```

### Option 2: Check Supabase Cookie Configuration
The Supabase SSR library expects cookies with specific names. Need to verify:
- Client-side sets cookies correctly after login
- Cookie domain/path allows them to be sent to /api/* routes
- Supabase cookie names match between client and server

### Option 3: Fallback to Authorization Header
If cookie-based auth continues to fail, consider supporting BOTH:
- Cookie-based auth (primary, for browser)
- Authorization header (fallback, for API testing)

## Current Implementation Status

✅ Server-side cookie reading implemented
✅ Frontend sends credentials: 'include'
✅ Detailed logging added
✅ ID chain verified (auth.users.id → profiles.id → games.player_id)
❌ **Cookie authentication not working** (root cause)
⏸️  Authorization comparison logic not reached

## Conclusion

The authorization comparison logic (lines 181-223) appears correct and will work once authentication succeeds. The issue is NOT with the ID comparison logic, but with obtaining the authenticated user from cookies in the first place.

**The exact mismatch:**
- **Expected:** `user.id` should be `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2` from cookies
- **Actual:** `user` is `null` because `supabase.auth.getUser()` returns error "Auth session missing!"
