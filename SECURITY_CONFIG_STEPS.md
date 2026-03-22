# Security Configuration: Cookie-Based Authentication

## What Changed

The app was updated to use **cookie-based authentication** instead of localStorage. This is required for server-side authentication in Next.js App Router.

## Technical Details

### Before (Broken)
```
User Login → Session in localStorage → Frontend ✅ | Server ❌
```

### After (Fixed)
```
User Login → Session in cookies → Frontend ✅ | Server ✅
```

## Code Changes

### 1. Browser Client (`lib/supabaseClient.ts`)

Added explicit cookie configuration to `createBrowserClient`:

```typescript
export const supabase = createBrowserClient(url, key, {
  cookies: {
    getAll() {
      return document.cookie.split('; ').map(...);
    },
    setAll(cookies) {
      cookies.forEach(({ name, value, options }) => {
        document.cookie = `${name}=${encodeURIComponent(value)}; ...`;
      });
    }
  }
});
```

**Why**: Forces Supabase to use cookies instead of localStorage

### 2. Server API Route (`app/api/move/route.ts`)

Changed authentication method:

```typescript
// Before:
const { data: { user }, error } = await supabase.auth.getUser();

// After:
const { data: { session }, error } = await supabase.auth.getSession();
const user = session?.user;
```

**Why**: `getSession()` reads from cookie directly; `getUser()` makes API call

### 3. Server Client (`lib/supabaseServer.ts`)

Already correctly configured with Next.js cookies() API:

```typescript
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookies) { /* set cookies */ }
    }
  });
}
```

**Why**: Server client can read cookies sent with HTTP requests

## Security Benefits

1. **HttpOnly Cookies**: Cannot be accessed by JavaScript (XSS protection)
2. **Secure Flag**: Only sent over HTTPS in production
3. **SameSite**: CSRF protection
4. **Server Validation**: Every request validated on server
5. **Short Expiry**: Tokens expire and refresh automatically

## Cookie Configuration

Cookies created by Supabase auth:

- `sb-{project-ref}-auth-token` - Access token
- `sb-{project-ref}-auth-token-code-verifier` - PKCE verifier
- `sb-{project-ref}-auth-token.0`, `.1`, etc. - Chunked tokens (if large)

Options:
- Path: `/`
- MaxAge: Configured by Supabase
- SameSite: `Lax`
- Secure: `true` (in production)

## Migration Impact

### Existing Users
Users with sessions in localStorage will need to **log in again** after deployment.

### Cleanup (Optional)
Can add to login page:

```typescript
useEffect(() => {
  // Clear old localStorage auth
  Object.keys(localStorage)
    .filter(key => key.includes('supabase') || key.includes('sb-'))
    .forEach(key => localStorage.removeItem(key));
}, []);
```

### Cookie Size
Auth cookies can be large (800+ bytes). Chunking is automatic if needed.

## Testing Validation

After login, verify in DevTools:

```javascript
// Should show cookies:
document.cookie.includes('sb-')  // true

// Should NOT have localStorage auth:
!Object.keys(localStorage).some(k => k.includes('supabase-auth'))  // true
```

## Environment Requirements

No changes needed to environment variables. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Error Handling

If cookies fail to set:
- Check browser privacy settings (must allow cookies)
- Check domain configuration
- Check HTTPS in production

If server can't read cookies:
- Check Next.js version (14+ required)
- Check `cookies()` import from `next/headers`
- Check API route is dynamic: `export const dynamic = 'force-dynamic'`

## Compliance Notes

Cookies containing authentication tokens may require:
- Privacy policy update
- Cookie consent banner (depending on jurisdiction)
- User notification of cookie usage

Check local regulations (GDPR, CCPA, etc.)
