import type { InterfaceAbi } from 'ethers';
import cajoAbi from './abi/Cajo.json';

// Compiled ABI from the Hardhat build (refresh with `npm run sync-abi`).
// The read functions used by this app, for reference:
//   groupCount() view returns (uint256)
//   feeBps() view returns (uint16)
//   groups(uint256) view returns (address creator, address token, uint256 contributionAmount,
//     uint16 memberTarget, uint16 memberCount, uint16 currentRound, uint64 roundDuration,
//     uint64 gracePeriod, uint64 roundStart, uint64 fillDeadline, uint8 state, uint8 escrowMode,
//     uint256 potBalance, uint256 dripReserve, uint16 feeBps, uint16 contributionsThisRound)
//   openSlots(uint256 groupId) view returns (bool[] taken)
//   payoutOrder(uint256, uint16) view returns (address)
//   slotDeposit(uint256 groupId, uint16 position) view returns (uint256)
//   members(uint256, address) view returns (uint8 state, uint16 payoutPosition, uint16 roundsPaid,
//     uint256 escrowBalance, bool payoutReceived)
//   withdrawable(uint256, address) view returns (uint256)
export const CAJO_ABI: InterfaceAbi = cajoAbi;

export const ERC20_ABI: InterfaceAbi = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];
