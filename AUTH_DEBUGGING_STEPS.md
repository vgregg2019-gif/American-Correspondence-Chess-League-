# Authentication Debugging - Move API

## Problem
Frontend shows: `[Frontend Move] X Server rejected move - rolling back: Not authenticated`

## Evidence
1. User can access the game page (auth works for page load)
2. Frontend shows correct player color (White) and "Your Turn"
3. Board renders correctly
4. When move is attempted, server returns 401: "Not authenticated"
5. Frontend validates session before API call: `[Frontend Move] ✓ Session valid`
6. API call includes `credentials: 'include'` for cookies

## Key Question
Why does the server-side auth work for page load but fail for the API route?

## Files Involved

### 1. Frontend: `/app/game/[id]/page.tsx`
- Line 434: Checks session before API call
- Line 477-484: Sends move to API with cookies

```typescript
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
// ... validates session exists

const response = await fetch('/api/move', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(movePayload),
  credentials: 'include',  // ✅ CORRECT: Sends cookies
});
```

### 2. Server: `/app/api/move/route.ts`
- Line 25: Creates server client
- Line 27: Attempts to get user
- Line 36-42: Returns 401 if no user

```typescript
const supabase = await createServerClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return NextResponse.json(
    { error: 'Not authenticated' },
    { status: 401 }
  );
}
```

### 3. Server Client: `/lib/supabaseServer.ts`
- Uses `@supabase/ssr` with cookie handling
- Should automatically read auth cookies

## Hypothesis

The `createServerClient` function is correctly set up to read cookies, but there might be an issue with:

1. **Cookie names**: Supabase auth cookies might have a different name or path
2. **Cookie availability**: Cookies might not be accessible in the API route context
3. **Timing issue**: `cookies()` is async, might need different handling
4. **Session vs User**: Using `getUser()` instead of `getSession()`

## Next Steps

1. Add detailed logging to see what cookies are available
2. Check if auth cookies are present in the request
3. Compare cookie handling between page routes (working) and API routes (broken)
4. Test with explicit cookie reading
