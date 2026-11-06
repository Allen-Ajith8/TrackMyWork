const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mkianwpqavyknyjfipob.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_3u3MvbzlGd4uiJPWYdcWdQ_wvFcZlYD';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkTables() {
  const tables = [
    'users', 'rooms', 'room_rules', 'room_members', 'tasks', 
    'hardware_bom', 'artifacts', 'notifications', 'nim_logs',
    'ghost_sessions', 'vibe_heartbeats', 'file_locks', 'vibe_rollbacks',
    'master_integrations', 'room_integrations'
  ];

  console.log('Checking tables...\n');
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists (${count || 0} rows)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }
}

checkTables();