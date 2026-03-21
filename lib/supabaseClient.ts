import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('[Supabase Client] Initialization:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlValue: supabaseUrl || 'NOT SET',
  urlHost: supabaseUrl ? new URL(supabaseUrl).host : 'N/A',
  keyLength: supabaseAnonKey?.length || 0,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'NOT SET',
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client] CRITICAL: Missing environment variables!', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'present' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'present' : 'MISSING',
  });
}

export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          white_player_id: string;
          black_player_id: string;
          current_fen: string;
          status: 'active' | 'finished';
          turn: 'white' | 'black';
          white_time_remaining_seconds: number;
          black_time_remaining_seconds: number;
          last_move_at: string;
          timeout_at: string | null;
          winner_id: string | null;
          end_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          white_player_id: string;
          black_player_id: string;
          current_fen?: string;
          status?: 'active' | 'finished';
          turn?: 'white' | 'black';
          white_time_remaining_seconds?: number;
          black_time_remaining_seconds?: number;
          last_move_at?: string;
          timeout_at?: string | null;
          winner_id?: string | null;
          end_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          white_player_id?: string;
          black_player_id?: string;
          current_fen?: string;
          status?: 'active' | 'finished';
          turn?: 'white' | 'black';
          white_time_remaining_seconds?: number;
          black_time_remaining_seconds?: number;
          last_move_at?: string;
          timeout_at?: string | null;
          winner_id?: string | null;
          end_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      moves: {
        Row: {
          id: string;
          game_id: string;
          move_number: number;
          move: string;
          fen: string;
          player_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          move_number: number;
          move: string;
          fen: string;
          player_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          move_number?: number;
          move?: string;
          fen?: string;
          player_id?: string;
          created_at?: string;
        };
      };
    };
  };
};
