import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlValue: supabaseUrl ? 'present' : 'missing',
    keyValue: supabaseAnonKey ? 'present' : 'missing',
  });
}

export const supabase = createClient(
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
