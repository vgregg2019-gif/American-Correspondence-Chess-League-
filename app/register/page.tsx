'use client';

import { useState } from 'react';
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Log runtime configuration
    console.group('[Register] Runtime Configuration');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY (first 50 chars):',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 50));
    console.log('Email:', email);
    console.log('Username:', username);
    console.groupEnd();

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

      console.log('[Register] Calling signUp...');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });

      if (signUpError) {
        console.group('[Register] Error Details');
        console.error('Message:', signUpError.message);
        console.error('Status:', signUpError.status);
        console.error('Name:', signUpError.name);
        console.error('Full error object:', JSON.stringify(signUpError, null, 2));
        console.groupEnd();
        setError(`${signUpError.message} (Status: ${signUpError.status})`);
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('[Register] Success, user ID:', data.user.id);
        if (data.session) {
          router.push('/dashboard');
        } else {
          setError('Account created! Please check your email to confirm your account before logging in.');
          setLoading(false);
        }
      }
    } catch (err) {
      console.group('[Register] Exception');
      console.error('Error:', err);
      console.error('Type:', typeof err);
      console.error('String:', String(err));
      if (err instanceof Error) {
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
      }
      console.groupEnd();
      setError(`Failed to register: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
