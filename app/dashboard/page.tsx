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
      console.log('[Dashboard] Loading dashboard');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('[Dashboard] No session, redirecting to login');
        router.replace('/login');
        return;
      }

      console.log('[Dashboard] Logged in as user ID:', session.user.id);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      console.log('[Dashboard] Profile data:', profileData);

      if (profileError || !profileData) {
        console.error('[Dashboard] Profile error:', profileError);
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      setProfile(profileData);

      console.log('[Dashboard] Querying games for user:', session.user.id);

      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select(`
          *,
          white_player:white_player_id(id, username, rating),
          black_player:black_player_id(id, username, rating)
        `)
        .or(`white_player_id.eq.${session.user.id},black_player_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false });

      console.log('[Dashboard] Games query result:', { gamesData, gamesError });

      if (gamesData) {
        console.log('[Dashboard] Total games found:', gamesData.length);

        console.log('[Dashboard] Raw games data:', gamesData.map(g => ({
          id: g.id,
          status: g.status,
          white_player_id: g.white_player_id,
          black_player_id: g.black_player_id,
          currentUserId: session.user.id,
          isUserInGame: g.white_player_id === session.user.id || g.black_player_id === session.user.id,
        })));

        const active = gamesData.filter((g) => g.status === 'active');
        const completed = gamesData.filter((g) => g.status === 'finished');

        console.log('[Dashboard] Active games:', active.length);
        console.log('[Dashboard] Completed games:', completed.length);
        console.log('[Dashboard] Active games detail:', active);

        console.log('[Dashboard] Game status breakdown:', {
          allStatuses: gamesData.map(g => g.status),
          uniqueStatuses: [...new Set(gamesData.map(g => g.status))],
        });

        setActiveGames(active);
        setCompletedGames(completed);
      }

      setLoading(false);
    } catch (err) {
      console.error('[Dashboard] Error loading dashboard:', err);
      setLoading(false);
    }
  }

  async function findOpponent() {
    if (!profile) return;

    console.log('[Matchmaking] Starting matchmaking for player:', profile.id);
    setMatchmaking(true);

    try {
      const { data: waitingPlayers, error: queueQueryError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('player_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(1);

      console.log('[Matchmaking] Queue query result:', { waitingPlayers, queueQueryError });

      if (waitingPlayers && waitingPlayers.length > 0) {
        const opponent = waitingPlayers[0];
        console.log('[Matchmaking] Found opponent:', opponent);

        const { error: deleteError } = await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('id', opponent.id);

        console.log('[Matchmaking] Delete opponent from queue:', { deleteError });

        const isWhite = Math.random() < 0.5;
        const whiteId = isWhite ? profile.id : opponent.player_id;
        const blackId = isWhite ? opponent.player_id : profile.id;

        console.log('[Matchmaking] Creating game:', {
          currentPlayer: profile.id,
          opponentPlayer: opponent.player_id,
          whiteId,
          blackId,
          currentPlayerIsWhite: isWhite,
        });

        const gameData = {
          white_player_id: whiteId,
          black_player_id: blackId,
          status: 'active',
          current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          timeout_at: new Date(Date.now() + 172800 * 1000).toISOString(),
        };

        console.log('[Matchmaking] Inserting game with data:', gameData);

        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert(gameData)
          .select()
          .single();

        console.log('[Matchmaking] Game creation result:', { newGame, gameError });

        if (newGame) {
          console.log('[Matchmaking] Created game:', {
            id: newGame.id,
            status: newGame.status,
            current_fen: newGame.current_fen,
            time_control: newGame.time_control,
          });
        }

        if (!gameError && newGame) {
          console.log('[Matchmaking] Navigating to game:', newGame.id);
          router.push(`/game/${newGame.id}`);
        } else {
          console.error('[Matchmaking] Failed to create game');
          setMatchmaking(false);
        }
      } else {
        console.log('[Matchmaking] No opponents found, joining queue');

        const { error: queueError } = await supabase
          .from('matchmaking_queue')
          .insert({
            player_id: profile.id,
            rating: profile.rating,
          });

        console.log('[Matchmaking] Queue insert result:', { queueError });

        if (!queueError) {
          alert('You have been added to the matchmaking queue. You will be notified when an opponent is found.');
        }

        setMatchmaking(false);
      }
    } catch (err) {
      console.error('[Matchmaking] Error:', err);
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
                const whitePlayerData = Array.isArray(game.white_player) ? game.white_player[0] : game.white_player;
                const blackPlayerData = Array.isArray(game.black_player) ? game.black_player[0] : game.black_player;
                const opponent = isWhite ? blackPlayerData : whitePlayerData;
                const myColor = isWhite ? 'white' : 'black';
                const isMyTurn = game.turn === myColor;

                console.log('[Dashboard] Game card:', {
                  gameId: game.id,
                  userId: profile?.id,
                  white_player_id: game.white_player_id,
                  black_player_id: game.black_player_id,
                  isWhite,
                  myColor,
                  currentTurn: game.turn,
                  isMyTurn,
                  opponent,
                });

                const clock = calculateClock({
                  turn: game.turn,
                  white_time_remaining_seconds: game.white_time_remaining_seconds,
                  black_time_remaining_seconds: game.black_time_remaining_seconds,
                  last_move_at: game.last_move_at,
                });

                if (!opponent) {
                  console.error('[Dashboard] Missing opponent data for game:', game.id);
                  return null;
                }

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
                const whitePlayerData = Array.isArray(game.white_player) ? game.white_player[0] : game.white_player;
                const blackPlayerData = Array.isArray(game.black_player) ? game.black_player[0] : game.black_player;
                const opponent = isWhite ? blackPlayerData : whitePlayerData;
                const won = game.winner_id === profile?.id;
                const draw = !game.winner_id;

                if (!opponent) {
                  console.error('[Dashboard] Missing opponent data for completed game:', game.id);
                  return null;
                }

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
