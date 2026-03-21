#!/usr/bin/env node

/**
 * Test script to reproduce move authorization on Bolt-hosted runtime
 * This makes actual HTTP requests to capture real server-side logs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hzrazduivfpebugxjspb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmF6ZHVpdmZwZWJ1Z3hqc3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDAwNzYsImV4cCI6MjA4OTY3NjA3Nn0.k3Husj5JxBXablj7fpJp08uQ8Y4zzWoyN9sdJanFR-A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const apiUrl = process.argv[2];

  if (!apiUrl) {
    console.error('Usage: node test-hosted-move.mjs <API_BASE_URL>');
    console.error('Example: node test-hosted-move.mjs https://vgregg2019-gif-ameri-pqoc.bolt.host');
    process.exit(1);
  }

  const moveEndpoint = `${apiUrl}/api/move`;

  console.log('Testing move authorization on:', moveEndpoint);
  console.log('');

  // Sign in
  const email = 'test@example.com';
  const password = 'password123';

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Sign in failed:', authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log('✓ Signed in');
  console.log('User ID:', userId);
  console.log('');

  // Get latest game for this user
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (gamesError || !games || games.length === 0) {
    console.error('❌ No games found');
    return;
  }

  const game = games[0];
  console.log('Test Game:');
  console.log('  Game ID:', game.id);
  console.log('  White Player:', game.white_player_id);
  console.log('  Black Player:', game.black_player_id);
  console.log('  Status:', game.status);
  console.log('  Current FEN:', game.current_fen);
  console.log('');

  // Attempt first move
  const movePayload = {
    gameId: game.id,
    playerId: userId,
    from: 'e2',
    to: 'e4',
    promotion: undefined
  };

  console.log('Making move e2-e4...');
  console.log('Request payload:', JSON.stringify(movePayload, null, 2));
  console.log('');

  try {
    const response = await fetch(moveEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`,
      },
      body: JSON.stringify(movePayload),
    });

    const responseData = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(responseData, null, 2));
    console.log('');

    if (!response.ok) {
      console.log('❌ MOVE FAILED');
      console.log('');
      console.log('=== AUTHORIZATION FAILURE ===');
      console.log('Error:', responseData.error);
      console.log('Message:', responseData.message);
      console.log('Step:', responseData.step);

      if (responseData.details) {
        console.log('');
        console.log('Details from server:');
        console.log(JSON.stringify(responseData.details, null, 2));
      }

      if (responseData.debug) {
        console.log('');
        console.log('Debug info:');
        console.log(JSON.stringify(responseData.debug, null, 2));
      }

      console.log('');
      console.log('Expected server logs in deployment logs:');
      console.log('  [Move API] Authenticated user.id from cookies: <value>');
      console.log('  [Move API] playerId from request body: <value>');
      console.log('  [Move API] game.white_player_id from database: <value>');
      console.log('  [Move API] game.black_player_id from database: <value>');
      console.log('  [Move API] All comparison results');
    } else {
      console.log('✓ MOVE SUCCEEDED');
      console.log('New FEN:', responseData.fen);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

main().catch(console.error);
