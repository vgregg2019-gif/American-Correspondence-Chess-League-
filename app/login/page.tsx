'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[Auth] Environment check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'loaded' : 'MISSING',
      urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'loaded' : 'MISSING',
      keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    });

    console.log('[Auth] Attempting sign-in for email:', email);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[Auth] Sign-in response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        userId: data?.user?.id,
        hasSession: !!data?.session,
        hasError: !!signInError,
        errorMessage: signInError?.message,
        errorName: signInError?.name,
        errorStatus: signInError?.status,
      });

      if (signInError) {
        console.error('[Auth] Sign-in error details:', {
          message: signInError.message,
          name: signInError.name,
          status: signInError.status,
          fullError: signInError,
        });
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('[Auth] Sign-in successful, redirecting to dashboard');
        router.push('/dashboard');
      } else {
        console.warn('[Auth] No user in response despite no error');
        setError('Authentication succeeded but no user data returned');
        setLoading(false);
      }
    } catch (err) {
      console.error('[Auth] Network/exception failure:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        type: typeof err,
        stringified: JSON.stringify(err, null, 2),
      });
      setError(`Network error: ${err instanceof Error ? err.message : 'Failed to fetch'}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-accl-red mb-2">ACCL</h1>
          <p className="text-gray-400">American Correspondence Chess League</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-semibold mb-6 text-center">Sign In</h2>

          {error && (
            <div className="bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-accl-red hover:text-accl-red-light">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
