const { JsonRpcProvider, Wallet, formatEther } = require("ethers");

async function main() {
    console.log("--- 🧊 進入純淨隔離空間 ---");
    const provider = new JsonRpcProvider("http://127.0.0.1:8545");
    
    // Besu 預設富翁私鑰
    const pk = "0x8f2a464817fdb56037f59f6d333010b91e9227c65f97371f46327e3845920d31";
    const wallet = new Wallet(pk, provider);

    console.log("當前錢包地址:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 實際餘額:", formatEther(balance), "ETH");

    if (balance > 0n) {
        console.log("✅ 成功！在隔離環境中，我們終於拿回了身分掌控權。");
    }
}
main().catch(console.error);
