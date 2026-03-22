# Auth Debugging Guide for /api/move

## What Was Done

### 1. Added Middleware (`middleware.ts`)
- **Purpose**: Refresh Supabase auth sessions on every request
- **Critical**: Next.js 14 with App Router requires middleware to keep cookies fresh
- **What it does**:
  - Intercepts all requests
  - Calls `supabase.auth.getSession()` to refresh the session
  - Updates response cookies with fresh tokens
  - Logs detailed cookie and session information

### 2. Enhanced Logging

#### Middleware Logs:
- Request path and method
- All cookies present in the request
- Auth-related cookies specifically
- Session validation status
- User ID and email if session exists

#### API Route (`/api/move`) Logs:
- All cookies received by the route
- Detailed session information
- Specific error messages with reasons
- Debug information in 401 responses

#### Client (`app/game/[id]/page.tsx`) Logs:
- All cookies available in the browser
- Supabase-specific cookies before making the API call

## How to Debug

### Step 1: Check Browser Console (Client-Side)
Look for these logs when you attempt to make a move:

```
[Frontend Move] ===== CLIENT COOKIE DEBUG =====
[Frontend Move] All cookies: ...
[Frontend Move] Supabase cookies: [...]
```

**Expected**: Should see cookies like `sb-xxxxx-auth-token`

**If missing**: Login is not setting cookies correctly

### Step 2: Check Server Console (Middleware)
Look for middleware logs on every request:

```
[Middleware] ===== REQUEST PROCESSING =====
[Middleware] Path: /api/move
[Middleware] Auth cookies: X
[Middleware] Session check: { hasSession: true, userId: '...' }
```

**Expected**:
- Auth cookies count > 0
- hasSession: true
- userId present

**If hasSession is false**: Cookies aren't being sent from client to server

### Step 3: Check Server Console (API Route)
Look for these logs when `/api/move` is called:

```
[Move API] ===== COOKIE DEBUG =====
[Move API] Total cookies: X
[Move API] Auth-related cookies: X

[Move API] ===== SESSION DEBUG =====
[Move API] Session check result: { hasSession: true, sessionUserId: '...' }
```

**Expected**:
- Auth cookies present
- Session object exists
- User object exists within session

**If cookies are 0**: Middleware is not forwarding cookies properly

## Common Issues & Solutions

### Issue 1: No cookies in browser
**Symptom**: `[Frontend Move] Supabase cookies: []`

**Solution**:
- Check that login is actually succeeding
- Verify that `createBrowserClient` is being used (not `createClient`)
- Check browser cookie settings (not blocking third-party cookies)

### Issue 2: Cookies in browser but not reaching middleware
**Symptom**:
- Browser has cookies
- Middleware shows `Auth cookies: 0`

**Solution**:
- Check `credentials: 'include'` in fetch call (already added)
- Verify cookie domain matches the app domain
- Check if cookies are `httpOnly` and `secure` flags are correct

### Issue 3: Cookies in middleware but not in API route
**Symptom**:
- Middleware sees cookies and session
- API route sees no cookies or session

**Solution**:
- Ensure middleware is actually running (check logs)
- Verify middleware is setting cookies on response
- Check that API route is using `createServerClient` correctly

### Issue 4: Session expired
**Symptom**: `sessionError: 'Token expired'` or similar

**Solution**:
- Middleware should automatically refresh
- Check that refresh token is present
- May need to re-login if refresh token also expired

## Testing Checklist

1. ✅ Middleware file exists at root of project
2. ✅ Middleware is logging on every request
3. ✅ Login sets cookies in browser
4. ✅ Browser sends cookies with API requests
5. ✅ Middleware receives and refreshes session
6. ✅ API route receives session from middleware
7. ✅ Move is processed successfully

## Expected Log Flow

```
# 1. User makes a move
[Frontend Move] ===== CLIENT COOKIE DEBUG =====
[Frontend Move] All cookies: sb-xxxxx-auth-token=...
[Frontend Move] Supabase cookies: ['sb-xxxxx-auth-token']

# 2. Request hits middleware
[Middleware] ===== REQUEST PROCESSING =====
[Middleware] Path: /api/move
[Middleware] Auth cookies: 1
[Middleware] ✓ Session is valid and refreshed

# 3. Request reaches API route
[Move API] ===== COOKIE DEBUG =====
[Move API] Auth-related cookies: 1
[Move API] ===== SESSION DEBUG =====
[Move API] Session check result: { hasSession: true, sessionUserId: '...' }
[Move API] ✓ Move processed successfully
```

## Quick Fix Commands

```bash
# Rebuild to ensure middleware is compiled
npm run build

# Check that middleware file exists
ls -la middleware.ts

# If using deployed version, check deployment includes middleware
```

## Next Steps

1. Try to make a move and collect the logs
2. Share the logs following the flow above
3. Identify where the chain breaks
4. Apply the corresponding solution
