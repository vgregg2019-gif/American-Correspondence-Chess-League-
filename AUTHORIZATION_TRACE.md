# Authentication Flow Trace - Move API

## Current Status
**ISSUE**: Server returns "Not authenticated" when processing moves, even though user is logged in and can access the game page.

## Expected Behavior
1. User logs in → Auth cookie is set in browser
2. User navigates to game page → Page reads cookie, shows user info ✅ WORKING
3. User makes a move → API route reads same cookie, validates user ❌ FAILING

## Key Finding
The frontend correctly validates the session before calling the API:
- `[Frontend Move] ✓ Session valid` appears in console
- This means the cookie EXISTS in the browser
- The cookie is being SENT with `credentials: 'include'`
- But the server cannot READ the cookie

## Root Cause
Most likely: **Supabase is storing the session in localStorage, not cookies**

The `@supabase/ssr` browser client has TWO storage options:
1. **localStorage** (default in some configs) - Server cannot access
2. **cookies** (required for SSR) - Server can access

## Solution
Ensure the Supabase browser client uses cookie storage, not localStorage.

## Diagnostic Steps
1. Run app and attempt a move
2. Check console for: `[Move API] Request cookies`
3. If `count: 0` or no `sb-` cookies → Session is in localStorage
4. If cookies present but auth fails → Cookie reading issue

## Fix Options

### Option 1: Use getSession() instead of getUser()
```typescript
// Current (fails):
const { data: { user }, error } = await supabase.auth.getUser();

// Better:
const { data: { session }, error } = await supabase.auth.getSession();
const user = session?.user;
```

### Option 2: Verify Cookie Storage
Ensure `lib/supabaseClient.ts` is configured for cookies, not localStorage.
