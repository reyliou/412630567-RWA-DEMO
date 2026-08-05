const http = require('https');
const req = http.request('https://rwa-backend-c4y8.onrender.com/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  console.log(res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req.write(JSON.stringify({username: 'reyliou', password: '123'}));
req.end();
