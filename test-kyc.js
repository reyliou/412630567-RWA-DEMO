const http = require('https');
const req = http.request('https://rwa-backend-c4y8.onrender.com/api/users/2/kyc', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});
req.end();
