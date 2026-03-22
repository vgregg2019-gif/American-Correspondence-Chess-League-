# Quick Debug Checklist - /api/move Auth

## Before Making a Move

### 1. Login Check
- [ ] Login successful (no error message)
- [ ] Redirected to dashboard after login
- [ ] Check browser cookies (Dev Tools → Application → Cookies)
- [ ] Should see: `sb-wksfkmecrqwnovjybbna-auth-token`

### 2. Game Page Check
- [ ] Game page loads without errors
- [ ] Board displays correctly
- [ ] "Your Turn" indicator shows (if it's your turn)

## During Move Attempt

### 3. Browser Console Check
Look for these logs after dragging a piece:

```
✅ [Frontend Move] ===== CLIENT COOKIE DEBUG =====
✅ [Frontend Move] Supabase cookies: [1 or more items]
✅ [Frontend Move] ✓ Server confirmed move
```

**Red flags:**
```
❌ [Frontend Move] Supabase cookies: []  ← NO COOKIES IN BROWSER
❌ Server rejected move - rolling back     ← API RETURNED 401
```

### 4. Server Console Check
Look for middleware logs:

```
✅ [Middleware] Auth cookies: 1
✅ [Middleware] ✓ Session is valid and refreshed
```

Look for API route logs:

```
✅ [Move API] Auth-related cookies: 1
✅ [Move API] Session check result: { hasSession: true, sessionUserId: '...' }
✅ [Move API] ✓ Move processed successfully
```

**Red flags:**
```
❌ [Middleware] Auth cookies: 0           ← COOKIES NOT SENT
❌ [Move API] No session object returned  ← SESSION NOT FOUND
❌ [Move API] 🚫 RETURNING 401           ← AUTH FAILED
```

## If Move Fails

### Check 1: Are cookies present in browser?
```bash
# In browser console:
document.cookie
# Should contain: sb-wksfkmecrqwnovjybbna-auth-token
```

**If NO:**
- Login is broken
- Try logging out and back in
- Check that login page doesn't show errors

### Check 2: Are cookies being sent to server?
```bash
# In server logs, look for:
[Middleware] Total cookies: X
[Move API] Total cookies: X
```

**If 0:**
- Browser is blocking cookies
- Check fetch has `credentials: 'include'` (already added)
- Check cookie domain matches app domain

### Check 3: Is middleware running?
```bash
# In server logs, look for:
[Middleware] ===== REQUEST PROCESSING =====
```

**If NOT FOUND:**
- Middleware file not deployed
- Rebuild: `npm run build`
- Check `middleware.ts` exists at project root

### Check 4: Does session exist?
```bash
# In server logs, look for:
[Move API] Session check result: { hasSession: true }
```

**If hasSession: false:**
- Session expired (re-login)
- Middleware not refreshing session
- Check middleware logs for errors

## Quick Fixes

### Fix 1: Re-login
```
1. Click logout (if logged in)
2. Go to /login
3. Login again
4. Check cookies are set
5. Try move again
```

### Fix 2: Clear cookies and re-login
```
1. Dev Tools → Application → Cookies
2. Delete all cookies
3. Refresh page
4. Login again
5. Try move again
```

### Fix 3: Rebuild
```bash
npm run build
# Then restart the dev server
```

### Fix 4: Check middleware exists
```bash
ls -la middleware.ts
# Should show the file
```

## Success Criteria

✅ Login successful
✅ Cookies present in browser
✅ Middleware logs show session
✅ API route logs show session
✅ Move completes successfully
✅ Board updates immediately
✅ No error messages

## Still Not Working?

1. Collect logs from:
   - Browser console (all output)
   - Server console (all output)

2. Check specifically:
   - Did login succeed?
   - Are cookies in browser?
   - Is middleware running?
   - What error does API return?

3. Share the logs with error context
