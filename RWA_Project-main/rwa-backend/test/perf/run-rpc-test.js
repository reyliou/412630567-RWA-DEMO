const { JsonRpcProvider } = require('ethers');

async function measureRpcResponse(rpcUrl, label) {
    console.log(`\n================ 區塊鏈 RPC 響應測試 [${label}] ================`);
    console.log(`Connecting to: ${rpcUrl}`);

    let totalLatency = 0;
    const testCount = 10;
    let successCount = 0;

    for (let i = 1; i <= testCount; i++) {
        const start = performance.now();
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: i })
            });
            const data = await response.json();
            const latency = performance.now() - start;
            
            if (data.error) throw new Error(data.error.message);
            const blockNumber = parseInt(data.result, 16);
            
            console.log(`[Req ${i}/${testCount}] 延遲: ${latency.toFixed(2)} ms (當前區塊: ${blockNumber})`);
            totalLatency += latency;
            successCount++;
        } catch (err) {
            console.log(`[Req ${i}/${testCount}] 失敗: ${err.message}`);
        }
    }

    if (successCount > 0) {
        console.log(`\n${label} 測試完成！平均響應時間: ${(totalLatency / successCount).toFixed(2)} ms`);
    }
    console.log('=================================================================\n');
}

async function run() {
    await measureRpcResponse('http://127.0.0.1:8545', '本機 Hardhat 節點');
    await measureRpcResponse('https://rwa-blockchain-node.onrender.com', '正式雲端節點 (Render)');
}

run();
