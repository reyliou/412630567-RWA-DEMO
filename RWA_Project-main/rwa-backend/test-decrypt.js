const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  'https://uowremtggfpoxxruiccw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
);

const ENCRYPTION_KEY = crypto.createHash('sha256').update('DEFAULT_RWA_SECRET_KEY_FOR_DEMO').digest();
const ALGORITHM = 'aes-256-cbc';

function decryptImage(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, 16);
  const encrypted = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

async function run() {
  const fileName = 'kyc_kyctest_1785909635175.jpg';
  const { data, error } = await supabase.storage.from('kyc-documents').download(fileName);
  if (error) { console.error('Download error:', error); return; }
  const arrayBuf = await data.arrayBuffer();
  const downloadedBuffer = Buffer.from(arrayBuf);
  console.log('Downloaded bytes:', downloadedBuffer.length);
  
  try {
    const decrypted = decryptImage(downloadedBuffer);
    console.log('Decrypted successfully! Bytes:', decrypted.length);
    console.log('Decrypted Hex Signature:', decrypted.subarray(0, 10).toString('hex'));
  } catch (e) {
    console.error('Decryption failed!', e.message);
  }
}
run();
