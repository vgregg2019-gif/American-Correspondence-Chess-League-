#!/usr/bin/env node

/**
 * Test script to verify the complete auth flow:
 * 1. Login and capture session cookies
 * 2. Make a move using those cookies
 * 3. Verify the move was successful
 */

import { createClient } from '@supabase/supabase-js';

// CRITICAL: These MUST match your .env file
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukdoozqwekwlupxurswt.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG9venF3ZWt3bHVweHVyc3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTA2MDEsImV4cCI6MjA4ODQyNjYwMX0.bNAY7bwEF6C20wTCCAYGUJZy9b8etuJ-e3Ug92okWKM';

// For deployed testing, change this to your deployed URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Testing Auth Flow for Move API\n');
console.log('Configuration:');
console.log('- Supabase URL:', SUPABASE_URL);
console.log('- Base URL:', BASE_URL);
console.log('');

async function main() {
  // Step 1: Create test users if they don't exist
  console.log('📝 Step 1: Setting up test users...');

  const testEmail1 = `test-player-${Date.now()}@example.com`;
  const testEmail2 = `test-player-${Date.now() + 1}@example.com`;
  const testPassword = 'TestPassword123!';

  const { data: signUpData1, error: signUpError1 } = await supabase.auth.signUp({
    email: testEmail1,
    password: testPassword,
  });

  if (signUpError1) {
    console.error('❌ Failed to create user 1:', signUpError1.message);
    process.exit(1);
  }

  const user1Id = signUpData1.user?.id;
  console.log('✅ Created user 1:', user1Id);

  const { data: signUpData2, error: signUpError2 } = await supabase.auth.signUp({
    email: testEmail2,
    password: testPassword,
  });

  if (signUpError2) {
    console.error('❌ Failed to create user 2:', signUpError2.message);
    process.exit(1);
  }

  const user2Id = signUpData2.user?.id;
  console.log('✅ Created user 2:', user2Id);
  console.log('');

  // Step 2: Create profiles
  console.log('📝 Step 2: Creating profiles...');

  await supabase.from('profiles').insert({
    id: user1Id,
    username: 'TestPlayer1',
    rating: 1200,
  });

  await supabase.from('profiles').insert({
    id: user2Id,
    username: 'TestPlayer2',
    rating: 1200,
  });

  console.log('✅ Profiles created');
  console.log('');

  // Step 3: Create a test game
  console.log('📝 Step 3: Creating test game...');

  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .insert({
      white_player_id: user1Id,
      black_player_id: user2Id,
      current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
    })
    .select()
    .single();

  if (gameError) {
    console.error('❌ Failed to create game:', gameError.message);
    process.exit(1);
  }

  const gameId = gameData.id;
  console.log('✅ Game created:', gameId);
  console.log('');

  // Step 4: Login as user 1
  console.log('📝 Step 4: Logging in as user 1...');

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail1,
    password: testPassword,
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
    process.exit(1);
  }

  const session = loginData.session;
  const accessToken = session?.access_token;

  console.log('✅ Login successful');
  console.log('   User ID:', loginData.user?.id);
  console.log('   Access Token:', accessToken?.substring(0, 20) + '...');
  console.log('');

  // Step 5: Test move API with session cookies
  console.log('📝 Step 5: Testing move API...');
  console.log('');

  // Simulate browser-like cookie handling
  const cookies = [];
  if (session) {
    // Construct the Supabase auth cookies that would be set by the browser client
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
    cookies.push(`sb-${projectRef}-auth-token=${JSON.stringify(session)}`);
  }

  console.log('📤 Making move request...');
  console.log('   Method: POST /api/move');
  console.log('   Game ID:', gameId);
  console.log('   Player ID:', user1Id);
  console.log('   Move: e2->e4');
  console.log('   Auth: Session cookies');
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies.join('; '),
      },
      body: JSON.stringify({
        gameId: gameId,
        playerId: user1Id,
        from: 'e2',
        to: 'e4',
      }),
    });

    const result = await response.json();

    console.log('📥 Response received:');
    console.log('   Status:', response.status, response.statusText);
    console.log('   Body:', JSON.stringify(result, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ SUCCESS! Move was accepted by the API');
      console.log('');
      console.log('🎉 Auth flow is working correctly!');
      console.log('   - Middleware refreshed the session');
      console.log('   - API route read the session from cookies');
      console.log('   - Move was validated and saved');
    } else {
      console.log('❌ FAILED! Move was rejected');
      console.log('   Error:', result.error);
      console.log('');
      console.log('🔍 Check the server logs for detailed debugging information');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    process.exit(1);
  }

  // Cleanup
  console.log('');
  console.log('🧹 Cleaning up test data...');

  await supabase.from('moves').delete().eq('game_id', gameId);
  await supabase.from('games').delete().eq('id', gameId);
  await supabase.from('profiles').delete().in('id', [user1Id, user2Id]);

  console.log('✅ Cleanup complete');
}

main().catch(console.error);
