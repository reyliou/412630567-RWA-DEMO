const http = require('https');

// This is just to check if the Render server responds with anything about idempotency.
// We will send a request with a fake JWT to see if it even reaches the idempotency check or fails auth first.
const req = http.request('https://rwa-backend-c4y8.onrender.com/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Body:', body));
});
req.write(JSON.stringify({
  user_id: 3,
  property_id: 140249,
  tx_type: "BUY",
  order_type: "MARKET",
  token_amount: 1,
  price_per_token: 192.5106,
  idempotency_key: "4715b5a8-5395-4dda-9961-c58b5a0734a4"
}));
req.end();
