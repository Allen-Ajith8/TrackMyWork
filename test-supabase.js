const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mkianwpqavyknyjfipob.supabase.co';
const ANON_KEY = 'sb_publishable_bQR0wZ-6l1ng69A5wEGdfQ_UM_3EO_s';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
  console.log('Testing Supabase connection...');
  
  // Test with a realistic email
  try {
    const testEmail = `test.user+${Date.now()}@gmail.com`;
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPass123!',
      options: {
        data: { username: 'testuser' },
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    
    if (error) {
      console.log('Signup error:', error.message, 'Code:', error.code);
    } else {
      console.log('Signup success:', data.user?.email, 'Confirmed:', data.user?.email_confirmed_at);
    }
  } catch (e) {
    console.log('Signup exception:', e.message);
  }
  
  // Test with another email format
  try {
    const testEmail = `test${Date.now()}@test.com`;
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPass123!',
      options: {
        data: { username: 'testuser2' },
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    
    if (error) {
      console.log('Signup2 error:', error.message, 'Code:', error.code);
    } else {
      console.log('Signup2 success:', data);
    }
  } catch (e) {
    console.log('Signup2 exception:', e.message);
  }
}

test();