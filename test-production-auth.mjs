#!/usr/bin/env node

/**
 * Test production auth against the deployed Vercel URL
 * This will show us the EXACT runtime configuration and error responses
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const DEPLOYED_URL = 'https://vgregg2019-gif-ameri-f00s.bolt.host';
const TEST_EMAIL = 'admin.test.accl.1.2026@gmail.com';
const TEST_PASSWORD = 'test1234';

console.log('\n=== Production Auth Test ===\n');

// Read the .env file
const envContent = readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n');
let envUrl = '';
let envKey = '';

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    envUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    envKey = line.split('=')[1].trim();
  }
}

console.log('Local .env configuration:');
console.log('  NEXT_PUBLIC_SUPABASE_URL:', envUrl);
console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY (first 50):', envKey.substring(0, 50));
console.log('  Supabase Project:', envUrl.match(/https:\/\/([^.]+)/)?.[1] || 'unknown');

// Test 1: Direct Supabase auth from Node.js
console.log('\n--- Test 1: Direct Supabase Auth (Node.js) ---');
const supabase = createClient(envUrl, envKey);

try {
  console.log('Attempting login with:', TEST_EMAIL);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    console.error('❌ Login failed:');
    console.error('  Status:', error.status);
    console.error('  Message:', error.message);
    console.error('  Name:', error.name);
    console.error('  Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Login successful!');
    console.log('  User ID:', data.user?.id);
    console.log('  Email:', data.user?.email);
    console.log('  Has session:', !!data.session);
  }
} catch (err) {
  console.error('❌ Exception during login:', err.message);
}

// Test 2: Check what the browser would see
console.log('\n--- Test 2: Fetch Deployed App Login Page ---');
try {
  const response = await fetch(`${DEPLOYED_URL}/login`);
  console.log('Status:', response.status);
  console.log('Content-Type:', response.headers.get('content-type'));

  if (response.ok) {
    const html = await response.text();

    // Try to extract any inline script with env vars
    const envMatch = html.match(/NEXT_PUBLIC_SUPABASE_URL[^"']*["']([^"']+)/);
    if (envMatch) {
      console.log('\n🔍 Found NEXT_PUBLIC_SUPABASE_URL in HTML:', envMatch[1]);
    } else {
      console.log('\n⚠️  Could not find NEXT_PUBLIC_SUPABASE_URL in HTML');
    }
  }
} catch (err) {
  console.error('❌ Failed to fetch login page:', err.message);
}

// Test 3: Simulate browser auth request
console.log('\n--- Test 3: Raw HTTP Auth Request ---');
try {
  const authUrl = `${envUrl}/auth/v1/token?grant_type=password`;
  console.log('Requesting:', authUrl);

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': envKey,
      'Authorization': `Bearer ${envKey}`,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  console.log('Response Status:', response.status);
  console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

  const responseBody = await response.text();
  console.log('\n📄 Response Body:');
  try {
    const json = JSON.parse(responseBody);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(responseBody);
  }
} catch (err) {
  console.error('❌ Raw auth request failed:', err.message);
}

// Test 4: Try signup
console.log('\n--- Test 4: Signup Test ---');
const testSignupEmail = `test-${Date.now()}@example.com`;
try {
  const { data, error } = await supabase.auth.signUp({
    email: testSignupEmail,
    password: 'testpass123',
    options: {
      data: { username: 'testuser' }
    }
  });

  if (error) {
    console.error('❌ Signup failed:');
    console.error('  Status:', error.status);
    console.error('  Message:', error.message);
    console.error('  Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Signup successful!');
    console.log('  User ID:', data.user?.id);
    console.log('  Email:', data.user?.email);
  }
} catch (err) {
  console.error('❌ Exception during signup:', err.message);
}

console.log('\n=== Test Complete ===\n');
