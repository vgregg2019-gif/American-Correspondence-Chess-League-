# Authorization Flow Trace

## Test Game Created

**Game ID:** `fe56e014-4476-4480-9fd9-719af392fe83`
**User ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
**White Player ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
**Black Player ID:** `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`

**Test URL:** http://localhost:3000/game/fe56e014-4476-4480-9fd9-719af392fe83

**Login:**
- Email: test@example.com
- Password: password123

## Authorization Check Points in `/app/api/move/route.ts`

### 1. Cookie Authentication (Lines 14-48)
```typescript
const supabase = await createServerClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
```

**Logged Values:**
- `user.id` - The authenticated user ID from the cookie session
- `user.email` - The authenticated user's email
- `authError` - Any error reading the session from cookies

**Expected:** `user.id` should equal `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`

### 2. Request Body Validation (Lines 53-62)
```typescript
const { gameId, playerId, from, to, promotion } = body;

if (user.id !== playerId) {
  return NextResponse.json({
    step: "auth",
    error: "Player ID mismatch",
    message: "Authenticated user does not match playerId in request"
  }, { status: 403 });
}
```

**Logged Values:**
- `playerId` - The player ID sent from the frontend (should be `user.id` from the session)
- `gameId` - The game ID
- `user.id` - The authenticated user ID

**Critical Check:** `user.id === playerId`

**Expected:** Both should be `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`

### 3. Game Fetch & RLS (Lines 64-161)
```typescript
const { data: game, error: gameError } = await supabase
  .from("games")
  .select(...)
  .eq("id", gameId)
  .maybeSingle();
```

**Logged Values:**
- `game.id`
- `game.white_player_id`
- `game.black_player_id`
- `game.status`
- `game.current_fen`

**Expected:**
- `game.white_player_id` = `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
- `game.black_player_id` = `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`

**RLS Policy Check:** User must be either white_player_id OR black_player_id to fetch the game.

### 4. Player Authorization (Lines 181-223)
```typescript
console.log('[Move API] Authenticated user.id from cookies:', user.id);
console.log('[Move API] playerId from request body:', playerId);
console.log('[Move API] game.white_player_id from database:', game.white_player_id);
console.log('[Move API] game.black_player_id from database:', game.black_player_id);

const isWhite = game.white_player_id === playerId;
const isBlack = game.black_player_id === playerId;

if (!isWhite && !isBlack) {
  return NextResponse.json({
    step: "auth",
    error: "User is not a player in this game",
    ...
  }, { status: 403 });
}
```

**Logged Comparisons:**
- `user.id === playerId`
- `user.id === game.white_player_id`
- `user.id === game.black_player_id`
- `playerId === game.white_player_id`
- `playerId === game.black_player_id`

**Critical Check:** `(game.white_player_id === playerId) || (game.black_player_id === playerId)`

**Expected for this test:** ALL should be TRUE since user is playing both sides.

## Database Schema Verification

From `/supabase/migrations/20260313174309_create_accl_schema.sql`:

```sql
-- Line 76: profiles.id references auth.users(id)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ...
);

-- Lines 86-87: game player IDs reference profiles(id)
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  black_player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ...
);
```

**Identity Chain:**
1. `auth.users.id` → User's authentication ID
2. `profiles.id` → SAME as `auth.users.id` (foreign key constraint)
3. `games.white_player_id` → References `profiles.id`
4. `games.black_player_id` → References `profiles.id`

**Conclusion:** All IDs in the chain should be the same UUID value.

## Frontend Request (from `/app/game/[id]/page.tsx`)

Lines 89 & 468:
```typescript
// Get user ID from session
setUserId(session.user.id);

// Send in move request
const movePayload = {
  gameId: game.id,
  playerId: userId,  // <- This is session.user.id
  from,
  to,
  promotion,
};
```

**Expected:** `playerId` in request body = `session.user.id` = `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`

## Cookie-Based Auth Implementation

From `/lib/supabaseServer.ts`:
```typescript
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}
```

This uses Next.js `cookies()` to read Supabase session cookies automatically.

## Expected Authorization Flow

1. ✅ User logs in → session stored in cookies
2. ✅ Browser sends cookies with move request
3. ✅ `createServerClient()` reads session from cookies
4. ✅ `supabase.auth.getUser()` returns user with ID `37d7bdb9-a670-4448-8b9a-736dbc2cd8d2`
5. ✅ Frontend sends `playerId: "37d7bdb9-a670-4448-8b9a-736dbc2cd8d2"`
6. ✅ API checks `user.id === playerId` (should pass)
7. ✅ API fetches game with RLS (should pass since user is both players)
8. ✅ API checks `playerId === game.white_player_id` (should pass)
9. ✅ Move processes successfully

## If Authorization Fails

Check server logs for these specific values:

```
[Move API] ===== PLAYER AUTHORIZATION CHECK =====
[Move API] Authenticated user.id from cookies: <VALUE>
[Move API] playerId from request body: <VALUE>
[Move API] game.white_player_id from database: <VALUE>
[Move API] game.black_player_id from database: <VALUE>
```

**Failure Scenarios:**

1. **"Invalid authorization" at line 32-47**
   - `user` is null or `authError` exists
   - Cookies not sent or session expired
   - Check: `fullAuthResult` in logs

2. **"Player ID mismatch" at line 58-62**
   - `user.id !== playerId`
   - Frontend sending wrong playerId
   - Check: Both values in logs

3. **"Game not found" at line 130-161**
   - `game` is null or `gameError` exists
   - RLS policy blocked access
   - User is not white_player_id or black_player_id

4. **"User is not a player in this game" at line 198-220**
   - `playerId !== game.white_player_id` AND `playerId !== game.black_player_id`
   - ID mismatch in database
   - Check: All comparison results in logs

## Testing Instructions

1. Start dev server: `npm run dev`
2. Open: http://localhost:3000/game/fe56e014-4476-4480-9fd9-719af392fe83
3. Login with test@example.com / password123
4. Open browser console (F12)
5. Make a move (e.g., e2 to e4)
6. Watch BOTH:
   - Browser console for frontend logs
   - Terminal for server logs with authorization details
7. If move fails, look for the exact failure point in server logs
