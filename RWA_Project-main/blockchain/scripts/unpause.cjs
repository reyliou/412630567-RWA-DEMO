const { ethers } = require("hardhat");

async function main() {
  // 這是從你報錯訊息中抓到的 TOKEN 地址
  const tokenAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; 
  
  // 取得合約實例 (ERC-3643 Token 通常繼承了 Pausable)
  const Token = await ethers.getContractAt("Token", tokenAddress);

  console.log(`🔓 正在嘗試解除合約暫停: ${tokenAddress}`);

  try {
    const tx = await Token.unpause();
    console.log("⏳ 正在等待交易確認...");
    await tx.wait();
    console.log("✅ 成功！合約已啟用。");
  } catch (error) {
    if (error.message.includes("not paused")) {
      console.log("ℹ️ 合約其實已經是開啟狀態了。");
    } else {
      console.error("❌ 發生錯誤:", error.reason || error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});