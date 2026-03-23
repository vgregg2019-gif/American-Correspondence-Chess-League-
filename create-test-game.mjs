import { createClient } from '@supabase/supabase-js';

// CRITICAL: Use the correct Supabase project
const supabaseUrl = 'https://ukdoozqwekwlupxurswt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG9venF3ZWt3bHVweHVyc3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNTA4MzcsImV4cCI6MjA1NzgyNjgzN30.IFRoaXNJc0FQbGFjZWhvbGRlcktleUZvclRlc3RpbmdPbmx5';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Creating test game for logged-in user...\n');

  // Get the email from command line or use default
  const email = process.argv[2] || 'test@example.com';
  const password = process.argv[3] || 'password123';

  console.log('1. Signing in as:', email);
  let authData;
  let authError;

  ({ data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  }));

  if (authError) {
    console.log('   Sign in failed, creating account...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('   ❌ Failed:', signUpError.message);
      return;
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: signUpData.user.id,
        username: `testuser_${Date.now()}`,
        rating: 1200
      });

    if (profileError) {
      console.error('   ❌ Profile creation failed:', profileError.message);
    }

    // Sign in
    ({ data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    }));
  }

  if (!authData || !authData.user) {
    console.error('❌ Could not authenticate');
    return;
  }

  const userId = authData.user.id;
  console.log('   ✓ Signed in');
  console.log('   User ID:', userId);

  // Ensure profile exists
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    console.log('\n2. Creating profile...');
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
      console.error('   ❌ Failed:', createError.message);
      return;
    }
    profile = newProfile;
    console.log('   ✓ Profile created');
  } else {
    console.log('\n2. Profile exists');
  }

  console.log('   Username:', profile.username);
  console.log('   Profile ID:', profile.id);

  // Create test game
  console.log('\n3. Creating test game (user vs user)...');
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      white_player_id: userId,
      black_player_id: userId, // Playing against self
      current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
      time_control: 172800,
      white_time_remaining_seconds: 172800,
      black_time_remaining_seconds: 172800,
      last_move_at: new Date().toISOString()
    })
    .select()
    .single();

  if (gameError) {
    console.error('   ❌ Failed:', gameError.message);
    console.error('   Details:', gameError);
    return;
  }

  console.log('   ✓ Game created');
  console.log('   Game ID:', game.id);
  console.log('   White Player:', game.white_player_id);
  console.log('   Black Player:', game.black_player_id);
  console.log('   Status:', game.status);

  console.log('\n' + '='.repeat(80));
  console.log('TEST GAME READY');
  console.log('='.repeat(80));
  console.log('\nGame URL: http://localhost:3000/game/' + game.id);
  console.log('\nLogin credentials:');
  console.log('  Email:', email);
  console.log('  Password:', password);
  console.log('\nInstructions:');
  console.log('1. Make sure dev server is running (npm run dev)');
  console.log('2. Open the game URL in your browser');
  console.log('3. Log in with the credentials above');
  console.log('4. Open browser DevTools Console (F12)');
  console.log('5. Make moves and watch the console logs');
  console.log('\n6. Also watch the terminal where "npm run dev" is running');
  console.log('   for server-side logs with authorization details');
  console.log('\nExpected logs to trace:');
  console.log('  - [Move API] Authenticated user.id from cookies');
  console.log('  - [Move API] playerId from request body');
  console.log('  - [Move API] game.white_player_id from database');
  console.log('  - [Move API] game.black_player_id from database');
  console.log('  - All ID comparisons and authorization results');
  console.log('='.repeat(80));
}

main().catch(console.error);
