const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uowremtggfpoxxruiccw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
);
async function run() {
  const { data, error } = await supabase.storage.from('kyc-documents').list();
  if(error) { console.error(error); return; }
  const kyctestFiles = data.filter(f => f.name.includes('kyctest'));
  console.log(kyctestFiles.map(f => f.name));
}
run();
