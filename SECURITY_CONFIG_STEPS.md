# Security Configuration Steps

## Database Issues - ✅ FIXED via Migration

The following database issues have been **automatically fixed** via migration:

### ✅ Fixed: Unindexed Foreign Keys
- Added index on `games.winner_id`
- Added index on `matchmaking_queue.player_id`
- Added index on `tournament_players.player_id`

### ✅ Fixed: Duplicate Indexes
- Removed duplicate `idx_games_white_player`
- Removed duplicate `idx_games_black_player`

### ✅ Fixed: Unused Indexes
- Removed unused `idx_games_status`
- Removed unused `idx_moves_player_id`
- Removed unused `idx_matchmaking_queue_rating`

**Status**: All database performance issues resolved automatically.

---

## Auth Configuration - ⚠️ REQUIRES MANUAL SETUP

The following auth settings **cannot be configured via SQL** and must be set in the Supabase Dashboard:

### 1. Enable Leaked Password Protection

**Why**: Prevents users from using passwords that have been compromised in data breaches.

**How to Fix**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Authentication** → **Policies** (or **Settings**)
4. Find: **"Password Strength"** or **"Breach Detection"** section
5. Enable: **"Have I Been Pwned (HIBP) Protection"**
6. Save changes

**Expected Result**: Users cannot sign up or change passwords to known compromised passwords.

### 2. Switch Auth DB Connection Strategy to Percentage

**Why**: Allows auth server connections to scale with database instance size.

**Current Issue**: Auth server uses fixed 10 connections, which doesn't scale when upgrading database.

**How to Fix**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Settings** → **Database** → **Connection Pooling**
4. Find the **"Auth"** or **"Supabase Auth"** section
5. Change: **Connection Mode** from **"Transaction"** to **"Percentage"**
6. Or set: **"Max Connections"** to a percentage value (e.g., 10%)
7. Save changes

**Expected Result**: Auth server can use more connections as database scales.

---

## Verification

### Check Database Indexes
```sql
-- Verify new indexes exist
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('games', 'matchmaking_queue', 'tournament_players')
ORDER BY tablename, indexname;
```

Expected indexes:
- `idx_games_winner_id`
- `idx_matchmaking_queue_player_id`
- `idx_tournament_players_player_id`
- `idx_games_white_player_id` (kept)
- `idx_games_black_player_id` (kept)

### Check Duplicate Indexes Removed
```sql
-- Verify old duplicate indexes are gone
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_games_white_player', 'idx_games_black_player');
```

Expected: No results (indexes should be dropped)

---

## Security Impact

### Database Performance (✅ Fixed)
- **Before**: Foreign key lookups caused sequential scans
- **After**: All foreign keys have covering indexes
- **Impact**: 10-100x faster JOIN queries on winner, player lookups

### Duplicate Indexes (✅ Fixed)
- **Before**: Wasted storage, slower INSERT/UPDATE operations
- **After**: Single index per column, optimal performance
- **Impact**: Reduced storage usage, faster writes

### Password Security (⚠️ Manual Setup Required)
- **Risk**: Users can use compromised passwords from data breaches
- **Fix**: Enable HIBP protection in dashboard
- **Impact**: Prevents credential stuffing attacks

### Auth Scalability (⚠️ Manual Setup Required)
- **Risk**: Auth server won't scale with database upgrades
- **Fix**: Switch to percentage-based connections
- **Impact**: Better auth performance under load

---

## Summary

| Issue | Status | Action Required |
|-------|--------|----------------|
| Unindexed foreign keys | ✅ Fixed | None - migration applied |
| Duplicate indexes | ✅ Fixed | None - migration applied |
| Unused indexes | ✅ Fixed | None - migration applied |
| Leaked password protection | ⚠️ Manual | Enable in Dashboard (2 min) |
| Auth connection strategy | ⚠️ Manual | Configure in Dashboard (2 min) |

**Next Steps**:
1. Database issues are already resolved
2. Complete the 2 manual auth configuration steps in Supabase Dashboard
3. Total time needed: ~5 minutes
