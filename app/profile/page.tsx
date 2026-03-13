'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface Profile {
  id: string;
  username: string;
  rating: number;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      setProfile(profileData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-accl-red hover:text-accl-red-light transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="card">
          <h1 className="text-3xl font-bold mb-6">Player Profile</h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username</label>
              <p className="text-xl font-semibold">{profile?.username}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Rating</label>
              <p className="text-3xl font-bold text-accl-red">{profile?.rating}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Member Since</label>
              <p className="text-lg">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
