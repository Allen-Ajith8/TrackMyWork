const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mkianwpqavyknyjfipob.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_3u3MvbzlGd4uiJPWYdcWdQ_wvFcZlYD';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createBuckets() {
  const buckets = [
    { id: 'artifacts', public: false },
    { id: 'avatars', public: true },
    { id: 'room-assets', public: false }
  ];

  console.log('Creating storage buckets...\n');
  
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
      });
      
      if (error && !error.message.includes('already exists')) {
        console.log(`❌ ${bucket.id}: ${error.message}`);
      } else {
        console.log(`✅ ${bucket.id}: ${bucket.public ? 'public' : 'private'}`);
      }
    } catch (e) {
      console.log(`❌ ${bucket.id}: ${e.message}`);
    }
  }
  
  // List buckets to verify
  const { data: buckets_list } = await supabase.storage.listBuckets();
  console.log('\nAll buckets:', buckets_list.map(b => `${b.id} (${b.public ? 'public' : 'private'})`).join(', '));
}

createBuckets();