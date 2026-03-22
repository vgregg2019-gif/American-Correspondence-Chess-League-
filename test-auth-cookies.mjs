#!/usr/bin/env node

/**
 * Test script to check if auth cookies are being sent with requests
 * Run this after logging in to see what cookies exist
 */

import { readFileSync } from 'fs';

// Load environment variables
const env = readFileSync('.env', 'utf-8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      acc[key.trim()] = valueParts.join('=').trim();
    }
    return acc;
  }, {});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Auth Cookie Test');
console.log('===================\n');
console.log('This script helps diagnose authentication issues');
console.log('You need to provide your auth tokens from the browser\n');

console.log('📋 Instructions:');
console.log('1. Open your browser');
console.log('2. Open DevTools (F12)');
console.log('3. Go to Application > Cookies');
console.log('4. Look for cookies starting with "sb-" or containing "supabase"');
console.log('5. Copy the cookie values and test them\n');

console.log('Expected cookie names:');
console.log('- sb-<project-ref>-auth-token');
console.log('- sb-<project-ref>-auth-token-code-verifier\n');

console.log('Supabase URL:', SUPABASE_URL);
console.log('Project Ref:', SUPABASE_URL?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] || 'unknown');
