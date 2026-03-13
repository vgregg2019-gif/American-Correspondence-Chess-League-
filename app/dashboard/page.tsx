'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calculateClock } from '@/lib/timeControl';

interface Profile {
  id: string;
  username: string;
  rating: number;
}

interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  status: string;
  turn: 'white' | 'black';
  white_time_remaining_seconds: number;
  black_time_remaining_seconds: number;
  last_move_at: string;
  winner_id: string | null;
  end_reason: string | null;
  created_at: string;
  white_player: Profile;
  black_player: Profile;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [completedGames, setCompletedGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchmaking, setMatchmaking] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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

      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          *,
          white_player:profiles!games_white_player_id_fkey(*),
          black_player:profiles!games_black_player_id_fkey(*)
        `)
        .or(`white_player_id.eq.${session.user.id},black_player_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false });

      if (gamesData) {
        const active = gamesData.filter((g) => g.status === 'active');
        const completed = gamesData.filter((g) => g.status === 'finished');
        setActiveGames(active);
        setCompletedGames(completed);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setLoading(false);
    }
  }

  async function findOpponent() {
    if (!profile) return;

    setMatchmaking(true);

    try {
      const { data: waitingPlayers } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('player_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (waitingPlayers && waitingPlayers.length > 0) {
        const opponent = waitingPlayers[0];

        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('id', opponent.id);

        const isWhite = Math.random() < 0.5;
        const whiteId = isWhite ? profile.id : opponent.player_id;
        const blackId = isWhite ? opponent.player_id : profile.id;

        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert({
            white_player_id: whiteId,
            black_player_id: blackId,
            timeout_at: new Date(Date.now() + 172800 * 1000).toISOString(),
          })
          .select()
          .single();

        if (!gameError && newGame) {
          router.push(`/game/${newGame.id}`);
        } else {
          setMatchmaking(false);
        }
      } else {
        const { error: queueError } = await supabase
          .from('matchmaking_queue')
          .insert({
            player_id: profile.id,
            rating: profile.rating,
          });

        if (!queueError) {
          alert('You have been added to the matchmaking queue. You will be notified when an opponent is found.');
        }

        setMatchmaking(false);
      }
    } catch (err) {
      console.error('Matchmaking error:', err);
      setMatchmaking(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-accl-red">ACCL</h1>
            <p className="text-gray-400 mt-1">American Correspondence Chess League</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="text-gray-300 hover:text-white transition-colors"
            >
              {profile?.username} ({profile?.rating})
            </Link>
            <button
              onClick={handleLogout}
              className="btn-secondary"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="card text-center">
            <h3 className="text-gray-400 text-sm mb-2">Rating</h3>
            <p className="text-3xl font-bold text-accl-red">{profile?.rating}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-gray-400 text-sm mb-2">Active Games</h3>
            <p className="text-3xl font-bold">{activeGames.length}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-gray-400 text-sm mb-2">Completed Games</h3>
            <p className="text-3xl font-bold">{completedGames.length}</p>
          </div>
        </div>

        <div className="mb-8">
          <button
            onClick={findOpponent}
            disabled={matchmaking}
            className="btn-primary w-full text-lg py-4"
          >
            {matchmaking ? 'Finding Opponent...' : 'Find Opponent'}
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Active Games</h2>
          {activeGames.length === 0 ? (
            <div className="card text-center text-gray-500">
              No active games. Click "Find Opponent" to start a new game.
            </div>
          ) : (
            <div className="space-y-4">
              {activeGames.map((game) => {
                const isWhite = game.white_player_id === profile?.id;
                const opponent = isWhite ? game.black_player : game.white_player;
                const myColor = isWhite ? 'white' : 'black';
                const isMyTurn = game.turn === myColor;

                const clock = calculateClock({
                  turn: game.turn,
                  white_time_remaining_seconds: game.white_time_remaining_seconds,
                  black_time_remaining_seconds: game.black_time_remaining_seconds,
                  last_move_at: game.last_move_at,
                });

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <div className="card hover:border-accl-red cursor-pointer transition-colors border-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">
                            vs {opponent.username} ({opponent.rating})
                          </p>
                          <p className="text-sm text-gray-400">
                            Playing as {myColor}
                          </p>
                        </div>
                        <div className="text-right">
                          {isMyTurn ? (
                            <span className="bg-accl-red text-white px-3 py-1 rounded text-sm font-semibold">
                              Your Turn
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">
                              Opponent's Turn
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Completed Games</h2>
          {completedGames.length === 0 ? (
            <div className="card text-center text-gray-500">
              No completed games yet.
            </div>
          ) : (
            <div className="space-y-4">
              {completedGames.map((game) => {
                const isWhite = game.white_player_id === profile?.id;
                const opponent = isWhite ? game.black_player : game.white_player;
                const won = game.winner_id === profile?.id;
                const draw = !game.winner_id;

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <div className="card hover:border-accl-gray cursor-pointer transition-colors border-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">
                            vs {opponent.username} ({opponent.rating})
                          </p>
                          <p className="text-sm text-gray-400">
                            {game.end_reason}
                          </p>
                        </div>
                        <div>
                          {draw ? (
                            <span className="text-gray-400 font-semibold">Draw</span>
                          ) : won ? (
                            <span className="text-green-400 font-semibold">Won</span>
                          ) : (
                            <span className="text-red-400 font-semibold">Lost</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
