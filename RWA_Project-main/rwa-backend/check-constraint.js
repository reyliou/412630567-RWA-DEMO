const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uowremtggfpoxxruiccw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
);
async function run() {
  const { data, error } = await supabase.rpc('get_constraints');
  // Since we don't have a custom RPC, we can't query pg_constraint easily.
  // Instead, let's try to insert a duplicate to see if it fails!
  const { data: insert, error: err } = await supabase.from('user_holdings').insert([
    { user_id: 3, property_id: 140249, holder_type: 'INVESTOR', balance: 1 },
    { user_id: 3, property_id: 140249, holder_type: 'INVESTOR', balance: 2 }
  ]);
  if (err) {
    console.log('Error inserting duplicate:', err);
  } else {
    console.log('Inserted duplicate successfully! Oh no, constraint is missing.');
    // clean it up
    await supabase.from('user_holdings').delete().in('balance', [1, 2]);
  }
}
run();
