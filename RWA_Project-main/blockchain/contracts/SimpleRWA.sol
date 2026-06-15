// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// 引入 ERC-3643 (T-REX) 官方實作
import "@erc3643org/erc-3643/contracts/token/Token.sol";
import "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import "@onchain-id/solidity/contracts/Identity.sol";

// --- 具現化區塊：為了產生 Artifacts 並給予明確的構造函數 ---

contract MySimpleRWA is Token {}

contract MyIdentityRegistry is IdentityRegistry {
    // 繼承父類，構造函數留給 deploy 腳本處理
}

contract MyIdentityRegistryStorage is IdentityRegistryStorage {}
contract MyClaimTopicsRegistry is ClaimTopicsRegistry {}
contract MyTrustedIssuersRegistry is TrustedIssuersRegistry {}
contract MyModularCompliance is ModularCompliance {}

contract MyIdentity is Identity {
    constructor(address _initialManagementKey, bool _limitStake) 
        Identity(_initialManagementKey, _limitStake) {}
}