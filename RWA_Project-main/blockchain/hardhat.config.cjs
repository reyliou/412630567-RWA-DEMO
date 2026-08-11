require("@nomicfoundation/hardhat-ethers");
// 提供 expect(...).to.be.reverted / .to.emit 等斷言，供 test/ 底下的合約測試使用
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};