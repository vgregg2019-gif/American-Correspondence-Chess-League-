'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('REGISTER BUILD CHECK LOADED');
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[Register] Environment check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'loaded' : 'MISSING',
      urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'loaded' : 'MISSING',
      keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    });

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      console.log('[Register] Checking for existing username:', username);
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        setError('Username already taken');
        setLoading(false);
        return;
      }

      console.log('[Register] Attempting sign-up for email:', email);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });

      console.log('[Register] Sign-up response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        userId: data?.user?.id,
        hasSession: !!data?.session,
        hasError: !!signUpError,
        errorMessage: signUpError?.message,
      });

      if (signUpError) {
        console.error('[Register] Sign-up error:', signUpError);
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('[Register] Updating profile username for user:', data.user.id);
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: username
          })
          .eq('id', data.user.id);

        if (profileError) {
          console.error('[Register] Profile update error:', profileError);
          setError('Failed to update profile');
          setLoading(false);
          return;
        }

        console.log('[Register] Registration successful, redirecting to dashboard');
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('[Register] Network/exception failure:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        type: typeof err,
      });
      setError(`Network error: ${err instanceof Error ? err.message : 'An unexpected error occurred'}`);
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
          <div className="text-xs text-yellow-400 mb-2">REGISTER BUILD CHECK</div>
          <h2 className="text-2xl font-semibold mb-6 text-center">Create Account</h2>

          {error && (
            <div className="bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                required
                disabled={loading}
                minLength={3}
              />
            </div>

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
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-accl-red hover:text-accl-red-light">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
