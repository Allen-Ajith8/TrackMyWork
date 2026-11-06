const fs = require('fs');

const SUPABASE_URL = 'https://mkianwpqavyknyjfipob.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_3u3MvbzlGd4uiJPWYdcWdQ_wvFcZlYD';

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
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql: stmt + ';' })
      });
      
      if (!response.ok) {
        const error = await response.text();
        if (!error.includes('already exists') && !error.includes('duplicate') && !error.includes('relation') && !error.includes('constraint')) {
          console.error(`Statement ${i+1} failed:`, error.substring(0, 300));
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