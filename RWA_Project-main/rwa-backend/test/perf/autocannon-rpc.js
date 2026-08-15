const autocannon = require('autocannon');

const url = 'https://rwa-blockchain-node.onrender.com';

const instance = autocannon({
  url: url,
  connections: 20, // 20 併發連線
  duration: 20,    // 持續 20 秒
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1,
  }),
}, console.log);

console.log(`Running 20s test @ ${url} with 20 connections...`);

autocannon.track(instance, { renderProgressBar: true });
