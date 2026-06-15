const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const TOKEN_ADDR = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
  
  // 取得合約實例
  const token = await hre.ethers.getContractAt("MySimpleRWA", TOKEN_ADDR);

  console.log("\n--- 🕵️ 深度診斷中 ---");
  
  try {
    // 1. 先確認地址對不對
    const name = await token.name();
    console.log("📍 確認合約名稱:", name);
    if (name !== "Tainan Estate") {
      console.log("❌ 警告：地址指向了錯誤的合約！");
    }

    // 2. 檢查 mint 的參數結構
    const fragment = token.interface.getFunction("mint");
    console.log("🧩 偵測到 mint 函式特徵:", fragment.format());

    // 3. 執行鑄造
    console.log("\n🚀 正在嘗試發送鑄造交易...");
    const amount = hre.ethers.parseUnits("1000", 18);
    
    // 使用更穩定的呼叫方式
    const tx = await token.mint(deployer.address, amount);
    console.log("⏳ 交易已發出，雜湊值:", tx.hash);
    
    await tx.wait();
    console.log("✅ 鑄造成功！");

    const balance = await token.balanceOf(deployer.address);
    console.log("💰 管理員餘額:", hre.ethers.formatUnits(balance, 18));

  } catch (error) {
    console.log("\n🚨 診斷發現問題：");
    console.error(error.message);
    
    if (error.message.includes("recognized")) {
      console.log("\n💡 最終解決方案：嘗試使用 batchMint（這是 T-REX 的另一個常見鑄造函式）");
      // 如果 mint 真的不行，自動嘗試 batchMint
      try {
        const amount = hre.ethers.parseUnits("1000", 18);
        const tx = await token.batchMint([deployer.address], [amount]);
        await tx.wait();
        console.log("✅ 使用 batchMint 成功發行代幣！");
      } catch (innerError) {
        console.log("🚨 batchMint 也失敗了:", innerError.message);
      }
    }
  }
}

main().catch(console.error);