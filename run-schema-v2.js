const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://mkianwpqavyknyjfipob.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_3u3MvbzlGd4uiJPWYdcWdQ_wvFcZlYD';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const schema = fs.readFileSync('Y:/programs folder/TeamWork/schema.sql', 'utf-8');

const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Executing ${statements.length} SQL statements...`);

async function run() {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt.trim()) continue;
    
    try {
      const { error } = await supabase.rpc('exec', { sql: stmt + ';' });
      
      if (error) {
        if (!error.message.includes('already exists') && 
            !error.message.includes('duplicate') && 
            !error.message.includes('relation') && 
            !error.message.includes('constraint') &&
            !error.message.includes('function') &&
            !error.message.includes('type')) {
          console.error(`Statement ${i+1} failed:`, error.message.substring(0, 300));
        }
      } else {
        console.log(`✓ Statement ${i+1}/${statements.length}`);
      }
    } catch (e) {
      console.error(`Statement ${i+1} error:`, e.message);
    }
  }
  
  console.log('Schema execution complete!');
}

run();