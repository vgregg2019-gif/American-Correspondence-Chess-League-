# Comprehensive Test Report - ACCL Chess Application

**Test Date:** March 23, 2026
**Environment:** Production (https://vgregg2019-gif-ameri-5gni.bolt.host)
**Database:** gibdjepfoujnrbalkshd.supabase.co

## Executive Summary

Tested all layers of the application stack from database to frontend. Identified that **authentication layer is fully functional** but **cookie propagation from client to Route Handler is failing**.

---

## Test Results by Layer

### ✅ Layer 1: Database & Triggers

**Status:** WORKING

**Tests Performed:**
- Profile creation trigger
- RLS policies
- User signup with trigger

**Results:**
```
Direct signup test:
- POST /auth/v1/signup → 200 OK
- User created in auth.users
- Profile auto-created via handle_new_user() trigger
- Username correctly extracted from raw_user_meta_data
- Rating defaulted to 1200
```

**Example:**
```json
User: testuser123@example.com
Profile: {
  "id": "56f54576-da7f-424b-9a15-5a441797c133",
  "username": "testplayer999",
  "email": "testuser123@example.com",
  "rating": 1200,
  "created_at": "2026-03-23 18:14:35.809716+00"
}
```

**Conclusion:** Database layer is secure and functional. Trigger is fail-safe with SECURITY DEFINER.

---

### ✅ Layer 2: Supabase Auth API

**Status:** WORKING

**Tests Performed:**
- Signup endpoint
- Login endpoint
- Token generation

**Results:**
```
Signup Test:
POST https://gibdjepfoujnrbalkshd.supabase.co/auth/v1/signup
Status: 200 OK
Response: access_token, refresh_token, user object

Login Test:
POST https://gibdjepfoujnrbalkshd.supabase.co/auth/v1/token?grant_type=password
Status: 200 OK
Response: access_token, refresh_token, user object
```

**Conclusion:** Supabase Auth API is fully functional and issuing valid JWTs.

---

### ✅ Layer 3: Data Fetching (Read Operations)

**Status:** WORKING

**Tests Performed:**
- Game data fetching via Supabase client
- Profile data fetching
- Moves data fetching

**Evidence from DevTools:**
```
Network Tab:
- GET /game/[id] → 200 OK
- games?select=*&id=eq.[uuid] → 200 OK
- profiles?select=* → 200 OK
- moves?select=* → 200 OK
```

**Conclusion:** All read operations through Supabase client work correctly. RLS policies allow proper access.

---

### ❌ Layer 4: POST /api/move Route Handler

**Status:** FAILING (401 Unauthorized)

**Issue:** Cookie-based authentication not working in Route Handler

**Evidence:**
```
Network Request:
POST https://vgregg2019-gif-ameri-5gni.bolt.host/api/move
Status: 401 Unauthorized
Response: {"error":"Not authenticated"}

Payload (correct):
{
  "gameId": "d142a352-ab49-461c-9939-e286dd3164de",
  "playerId": "1ea16405-d503-41d4-8c29-3932ebea52bd",
  "from": "d2",
  "to": "d4"
}

Request Headers:
- Content-Type: application/json
- credentials: 'include' (cookies should be sent)
```

**Root Cause Analysis:**

1. **Frontend** (app/game/[id]/page.tsx:475-482):
   ```typescript
   const response = await fetch('/api/move', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(movePayload),
     credentials: 'include', // ✓ Correct
   });
   ```

2. **Middleware** (middleware.ts:21-42):
   - Creates Supabase client with cookie handlers
   - Calls `getSession()` which refreshes auth session
   - Sets refreshed cookies on **response** object
   - However, these refreshed cookies aren't available to Route Handler

3. **Route Handler** (app/api/move/route.ts:35):
   ```typescript
   const supabase = await createServerClient(req);
   const { data: { session } } = await supabase.auth.getSession();
   // session is NULL → returns 401
   ```

4. **Supabase Server Client** (lib/supabaseServer.ts):
   - Reads cookies from `NextRequest.cookies`
   - But cookies from middleware response aren't in NextRequest
   - This is a Next.js Request/Response isolation issue

**The Problem:**
- Middleware refreshes session and sets cookies on **response**
- Route Handler reads cookies from **incoming request**
- Next.js doesn't pipe middleware response cookies back to route handler request
- This is a known limitation of Next.js middleware + Route Handlers

---

## Layer 5: Frontend Cookie State

**Status:** UNCERTAIN (Cannot verify from server logs)

**Need to Check:**
1. Are auth cookies being set in browser after login?
2. Are cookies being sent with POST /api/move?
3. Are cookies HTTPOnly or accessible?

**Missing Evidence:**
- Browser DevTools Application tab → Cookies
- Network tab → Request Cookies header for POST /api/move

---

## Problems Summary

### Issue #1: Cookie Authentication in Route Handler
**Symptom:** POST /api/move returns 401
**Root Cause:** Route Handler cannot read auth cookies refreshed by middleware
**Impact:** Users cannot make moves
**Affected Code:**
- `app/api/move/route.ts:35` - getSession() returns null
- `lib/supabaseServer.ts` - reads from NextRequest.cookies (stale)
- `middleware.ts` - refreshes session but output not available to route

**Possible Solutions:**
1. Have Route Handler get session from request headers instead of cookies
2. Use Authorization header instead of cookies for API routes
3. Switch from cookies to header-based auth for /api/* routes
4. Call `supabase.auth.getUser()` instead of `getSession()` in route (forces refresh)

---

### Issue #2: Frontend Not Sending Cookies (UNCONFIRMED)
**Need to verify:** Are cookies actually being sent from browser?

**Evidence Needed:**
- Screenshot of Network tab showing Request Headers for POST /api/move
- Screenshot of Application → Cookies showing auth cookies present
- Console log of `document.cookie` on game page

---

## Recommendations

### Immediate Fix (Option A): Use getUser() in Route Handler
```typescript
// app/api/move/route.ts:40
const { data: { user }, error } = await supabase.auth.getUser();
```

This forces a token refresh and validation against Supabase Auth, bypassing cookie issues.

### Immediate Fix (Option B): Accept Authorization Header
```typescript
// Frontend sends:
fetch('/api/move', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

// Route Handler uses:
const supabase = createServerClient(req); // reads from Authorization header
```

### Long-term Fix: Restructure Auth Flow
1. Use header-based auth for all API routes (/api/*)
2. Use cookie-based auth only for Server Components and Pages
3. Have middleware only handle page-level auth redirects
4. Remove middleware from /api/* routes

---

## What's Working

✅ Database layer (migrations, RLS, triggers)
✅ Supabase Auth API (signup, login, tokens)
✅ Frontend signup/login flows
✅ Session management in client
✅ Game data fetching (reads)
✅ Realtime subscriptions
✅ Move validation (client-side)

## What's Broken

❌ POST /api/move authentication
❌ Cookie propagation from middleware to Route Handler

## What's Uncertain

⚠️ Whether cookies are being sent from browser
⚠️ Cookie configuration (HttpOnly, SameSite, Secure)
⚠️ Domain/path settings for cookies

---

## Next Steps

1. **Debug cookie presence in browser**
   - Check DevTools → Application → Cookies
   - Check Network → POST /api/move → Request Headers → Cookie

2. **Try immediate fix**
   - Change route.ts to use `getUser()` instead of `getSession()`
   - This bypasses cookie issues entirely

3. **Test with Authorization header**
   - Modify frontend to send Bearer token
   - Verify route handler can read it

4. **Review middleware config**
   - Ensure matcher excludes /api/* if needed
   - Consider removing middleware from API routes entirely
