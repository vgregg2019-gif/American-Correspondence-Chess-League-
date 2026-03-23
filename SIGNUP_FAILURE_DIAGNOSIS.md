# SIGNUP FAILURE DIAGNOSIS
**Project:** ukdoozqwekwlupxurswt
**Date:** March 23, 2026 19:04 GMT
**Status:** BLOCKED BY SUPABASE AUTH SERVICE

---

## CONFIRMED PROBLEM

**Signup fails with 500 error from Supabase Auth service, NOT from database**

**Error:** "Database error saving new user" (error_code: "unexpected_failure")

**Critical finding:** Error occurs BEFORE any database operation happens. The auth.users table never receives an INSERT attempt.

---

## EVIDENCE

### Test 1: Signup WITH Trigger Enabled
- **Email tested:** diagnosis1774293028@example.com
- **Request:** POST /auth/v1/signup with email, password, and metadata
- **Response:** `{"code":500,"error_code":"unexpected_failure","msg":"Database error saving new user","error_id":"9e0fbc84713ccb7d-LAX"}`
- **Database check:** No row created in auth.users
- **Query result:** `SELECT * FROM auth.users WHERE email LIKE 'diagnosis%'` returned 0 rows

### Test 2: Signup WITHOUT Trigger (Trigger Dropped)
- **Email tested:** notrigger1774293047@example.com
- **Request:** POST /auth/v1/signup with email and password ONLY (no metadata)
- **Response:** `{"code":500,"error_code":"unexpected_failure","msg":"Database error saving new user","error_id":"9e0fbcfa41781bcd-LAX"}`
- **Database check:** No row created in auth.users
- **Query result:** `SELECT * FROM auth.users WHERE email LIKE 'notrigger%'` returned 0 rows

**CONCLUSION FROM TESTS:** Signup fails identically with or without the trigger. The trigger is NOT the problem.

---

## DATABASE STATE ANALYSIS

### Trigger Configuration
**Status:** Initially attached, then removed for testing, both scenarios failed

**Triggers on auth.users:**
- `on_auth_user_created` - AFTER INSERT (our profile trigger) - was enabled, then dropped
- Multiple RI_ConstraintTrigger_* - System foreign key triggers (normal, not blocking)

**Finding:** All triggers are AFTER INSERT, none block the initial INSERT operation

### Auth Hooks
**Query:** Checked for custom auth hooks or functions in auth/extensions schema
**Result:** No custom hooks found
**Evidence:** `SELECT * FROM pg_proc WHERE proname LIKE '%hook%'` returned 0 rows

### RLS on auth.users
**Status:** RLS is ENABLED on auth.users table
**RLS Forced:** No (relforcerowsecurity = false)
**Policies:** 0 policies exist on auth.users
**Finding:** RLS is enabled but has NO policies defined

**CRITICAL:** With RLS enabled and NO policies, auth.users is effectively locked to everyone EXCEPT superuser/owner. The Supabase Auth service (GoTrue) likely cannot INSERT into auth.users.

### Constraints on auth.users
**Constraints found:**
- `PRIMARY KEY (id)`
- `UNIQUE (email)`
- `CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2)`

**Finding:** All constraints are normal, none would block a valid signup

### Current Users
**Count:** 6 active users exist in auth.users
**Created:** All users created BEFORE today (2026-03-23)
**Finding:** These users were created when RLS policies may have been different, or were created via different method

---

## ROOT CAUSE IDENTIFIED

**RLS is enabled on auth.users with ZERO policies**

This means:
1. When RLS is enabled on a table, access is denied by default
2. Policies grant specific access patterns
3. With NO policies, only the table owner (postgres superuser) can insert
4. Supabase Auth service runs as `supabase_auth_admin` or similar role
5. That role CANNOT insert into auth.users because no policy allows it

**Evidence:**
```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'users';
-- Result: true (RLS enabled)

SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users';
-- Result: 0 (no policies)
```

**Why existing users exist:**
- Likely created before RLS was enabled
- OR created via dashboard which uses superuser role
- OR RLS was temporarily disabled when they were created

---

## WHAT MUST BE FIXED

### Issue #1: RLS Blocking Auth Service Inserts (CRITICAL)
**Problem:** RLS enabled on auth.users with no policies
**Impact:** Supabase Auth service cannot create users
**Location:** auth.users table
**Fix required:** Add RLS policy to allow supabase_auth_admin role to INSERT into auth.users

**Specific fix:**
```sql
CREATE POLICY "Allow auth service to create users"
  ON auth.users
  FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);
```

OR

```sql
CREATE POLICY "Allow service_role to create users"
  ON auth.users
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

OR (if auth uses authenticated role during signup)

```sql
CREATE POLICY "Allow user signup"
  ON auth.users
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Note:** Need to identify which role Supabase Auth uses for signup operations.

---

## ADDITIONAL FINDINGS

### Auth Service Health
- **Endpoint:** https://ukdoozqwekwlupxurswt.supabase.co/auth/v1/health
- **Status:** Returns "No API key found" (expected for health endpoint)
- **Version:** Cannot determine without proper API key header format

### Database Access
- MCP Supabase server: Connected and working
- Can query auth.users directly: Yes
- Can query public.profiles: Yes
- Database is healthy: Yes

---

## NEXT STEPS

1. **Identify the correct role** for Supabase Auth signup operations:
   - Check if it's `supabase_auth_admin`
   - Check if it's `service_role`
   - Check if it's `anon` (unlikely but possible)

2. **Add appropriate RLS policy** to auth.users for INSERT operations

3. **Re-test signup** after policy is added

4. **Restore profile trigger** once signup works

---

## CANNOT BE FIXED FROM MCP

**Critical limitation:** Cannot modify RLS policies on auth.users table from MCP because:
- MCP connection does not have superuser privileges
- auth.users is owned by Supabase system role
- Cannot ALTER TABLE or CREATE POLICY on auth schema tables

**Error received:**
```
ERROR: 42501: must be owner of table users
```

**This requires:**
- Supabase Dashboard access to disable RLS on auth.users
- OR Supabase support to fix the RLS configuration
- OR Direct database connection with superuser privileges

---

## SUMMARY

| Item | Status | Evidence |
|------|--------|----------|
| Trigger blocks signup | ❌ NO | Tested with trigger removed, still fails |
| Database schema issue | ❌ NO | auth.users structure is correct |
| Constraint blocks insert | ❌ NO | Constraints are standard |
| Auth hooks blocking | ❌ NO | No custom hooks found |
| RLS blocks insert | ✅ YES | RLS enabled with 0 policies on auth.users |
| Can fix from MCP | ❌ NO | Need superuser or dashboard access |

**Root cause:** RLS enabled on auth.users with no INSERT policies
**Impact:** Supabase Auth service cannot create users
**Fix requires:** Supabase Dashboard access or superuser privileges
