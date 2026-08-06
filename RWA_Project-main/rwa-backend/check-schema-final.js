const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uowremtggfpoxxruiccw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
);
async function run() {
  const { data: props, error: err1 } = await supabase.from('properties').select('*').limit(1);
  console.log('Properties columns:', props ? Object.keys(props[0]) : err1);
  
  const { data: holdings, error: err2 } = await supabase.from('user_holdings').select('*').limit(1);
  console.log('User Holdings columns:', holdings ? Object.keys(holdings[0]) : err2);
}
run();
