import { createClient } from '@supabase/supabase-js';

// CRITICAL: Use the correct Supabase project
const supabaseUrl = 'https://ukdoozqwekwlupxurswt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG9venF3ZWt3bHVweHVyc3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNTA4MzcsImV4cCI6MjA1NzgyNjgzN30.IFRoaXNJc0FQbGFjZWhvbGRlcktleUZvclRlc3RpbmdPbmx5';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('=== Testing Move Authorization Flow ===\n');

  // Get current user from environment or prompt
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'password123';

  console.log('Step 1: Sign in as test user');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Sign in failed:', authError.message);
    console.log('\nTrying to create account...');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('❌ Sign up failed:', signUpError.message);
      return;
    }

    console.log('✓ Account created');

    // Check if profile exists, create if not
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signUpData.user.id)
      .maybeSingle();

    if (!profile) {
      console.log('Creating profile...');
      const { error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          id: signUpData.user.id,
          username: `testuser_${Date.now()}`,
          rating: 1200
        });

      if (createProfileError) {
        console.error('❌ Profile creation failed:', createProfileError.message);
        return;
      }
      console.log('✓ Profile created');
    }

    // Sign in again
    const { data: retryAuth, error: retryError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (retryError) {
      console.error('❌ Retry sign in failed:', retryError.message);
      return;
    }

    authData.session = retryAuth.session;
    authData.user = retryAuth.user;
  }

  const userId = authData.user.id;
  const accessToken = authData.session.access_token;

  console.log('✓ Signed in');
  console.log('User ID:', userId);
  console.log('Access Token (first 40 chars):', accessToken.substring(0, 40) + '...\n');

  // Get or create profile
  console.log('Step 2: Get user profile');
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.log('Profile not found, creating...');
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: `testuser_${Date.now()}`,
        rating: 1200
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Profile creation failed:', createError.message);
      return;
    }
    profile = newProfile;
  }

  console.log('✓ Profile found');
  console.log('Username:', profile.username);
  console.log('Profile ID:', profile.id);
  console.log('User ID === Profile ID:', userId === profile.id, '\n');

  // Create a test game
  console.log('Step 3: Create test game');
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      white_player_id: userId,
      black_player_id: userId, // Playing against self for testing
      current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      time_control: 172800, // 48 hours in seconds
      white_time_remaining_seconds: 172800,
      black_time_remaining_seconds: 172800,
      last_move_at: new Date().toISOString()
    })
    .select()
    .single();

  if (gameError) {
    console.error('❌ Game creation failed:', gameError.message);
    console.error('Error details:', gameError);
    return;
  }

  console.log('✓ Game created');
  console.log('Game ID:', game.id);
  console.log('White Player ID:', game.white_player_id);
  console.log('Black Player ID:', game.black_player_id);
  console.log('User ID matches white:', userId === game.white_player_id);
  console.log('User ID matches black:', userId === game.black_player_id);
  console.log('Current FEN:', game.current_fen, '\n');

  // Test moves
  const testMoves = [
    { from: 'e2', to: 'e4', promotion: undefined, moveName: '1. e4' },
    { from: 'e7', to: 'e5', promotion: undefined, moveName: '1... e5' },
    { from: 'g1', to: 'f3', promotion: undefined, moveName: '2. Nf3' },
    { from: 'b8', to: 'c6', promotion: undefined, moveName: '2... Nc6' },
    { from: 'f1', to: 'c4', promotion: undefined, moveName: '3. Bc4' },
  ];

  console.log('Step 4: Making test moves\n');
  console.log('Using API endpoint: http://localhost:3000/api/move');
  console.log('Authentication: Cookie-based (session cookies)\n');

  for (let i = 0; i < testMoves.length; i++) {
    const move = testMoves[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`MOVE ${i + 1}: ${move.moveName}`);
    console.log('='.repeat(80));

    const movePayload = {
      gameId: game.id,
      playerId: userId,
      from: move.from,
      to: move.to,
      promotion: move.promotion
    };

    console.log('\n📤 Request Payload:');
    console.log(JSON.stringify(movePayload, null, 2));

    try {
      // Get session to ensure we have fresh tokens
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('http://localhost:3000/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Try to simulate cookie-based auth, though this might not work from node
          // The real test should be done from the browser
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(movePayload),
      });

      const responseData = await response.json();

      console.log('\n📥 Response Status:', response.status);
      console.log('📥 Response Data:');
      console.log(JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        console.log('\n❌ MOVE FAILED!');
        console.log('\n🔍 AUTHORIZATION FAILURE ANALYSIS:');
        console.log('Error:', responseData.error);
        console.log('Message:', responseData.message);
        console.log('Step:', responseData.step);

        if (responseData.details) {
          console.log('\n📊 Debug Details from Server:');
          console.log(JSON.stringify(responseData.details, null, 2));
        }

        if (responseData.debug) {
          console.log('\n📊 Additional Debug Info:');
          console.log(JSON.stringify(responseData.debug, null, 2));
        }

        console.log('\n🔍 STOPPING AT FIRST FAILURE');
        console.log('\nCheck the server logs (npm run dev output) for detailed authorization traces:');
        console.log('- [Move API] Authenticated user.id from cookies');
        console.log('- [Move API] playerId from request body');
        console.log('- [Move API] game.white_player_id from database');
        console.log('- [Move API] game.black_player_id from database');
        console.log('- [Move API] All comparison results');

        break;
      }

      console.log('\n✓ Move succeeded!');
      console.log('New FEN:', responseData.fen);
    } catch (error) {
      console.error('\n❌ Request failed with exception:', error.message);
      console.log('\n🔍 This likely means the dev server is not running.');
      console.log('Please run: npm run dev');
      break;
    }

    // Small delay between moves
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n=== Test Complete ===');
}

main().catch(console.error);
