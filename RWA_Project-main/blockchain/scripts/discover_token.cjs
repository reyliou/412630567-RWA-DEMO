const hre = require("hardhat");

async function main() {
  const TOKEN_ADDR = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
  const token = await hre.ethers.getContractAt("MySimpleRWA", TOKEN_ADDR);

  console.log("\n--- 🔍 Token 合約招數大檢查 (Ethers v6 版) ---");
  
  // Ethers v6 使用 fragments 來存儲函式定義
  const functions = [];
  token.interface.fragments.forEach((fragment) => {
    if (fragment.type === 'function') {
      functions.push(fragment.name);
    }
  });

  console.log("合約中所有可用的函式清單:");
  console.log(functions.sort().join("\n"));

  // 尋找關鍵字
  const keywords = ['mint', 'issue', 'supply', 'addAgent'];
  const candidates = functions.filter(name => 
    keywords.some(key => name.toLowerCase().includes(key))
  );

  console.log("\n💡 偵測到的關鍵函式候選者:");
  console.log(candidates.length > 0 ? candidates : "竟然一個都沒找到！");
  console.log("-------------------------------\n");
}

main().catch(console.error);