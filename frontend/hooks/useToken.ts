"use client";

import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { SealTokenABI, CONTRACTS } from "@/lib/contracts";
import { sepolia } from "wagmi/chains";

function bigIntSqrt(value: bigint): bigint {
  if (value < 0n) return 0n;
  if (value < 2n) return value;
  let x = value / 2n + 1n;
  let y = (x + value / x) / 2n;
  while (y < x) { x = y; y = (x + value / x) / 2n; }
  return x;
}

export function useToken() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: sepolia.id });

  // Auto-refreshes every 8 seconds — no hard reload needed
  const { data: votes, refetch: refetchVotes } = useReadContract({
    address: CONTRACTS.sealToken as `0x${string}`,
    abi: SealTokenABI,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.sealToken as `0x${string}`,
    abi: SealTokenABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const refetch = async () => {
    await Promise.all([refetchVotes(), refetchBalance()]);
  };

  /**
   * Waits for a tx to confirm on-chain, then re-reads balance/votes.
   * Called fire-and-forget so the button unblocks immediately after MetaMask approval.
   */
  const waitAndRefetch = async (txHash: `0x${string}`) => {
    try {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        await new Promise(r => setTimeout(r, 8000));
      }
    } catch {}
    await refetch();
  };

  const delegate = async () => {
    if (!address) return;
    const tx = await writeContractAsync({
      address: CONTRACTS.sealToken as `0x${string}`,
      abi: SealTokenABI,
      functionName: "delegate",
      args: [address],
    });
    waitAndRefetch(tx as `0x${string}`); // fire-and-forget
    return tx;
  };

  const mint = async () => {
    if (!address) return;
    const tx = await writeContractAsync({
      address: CONTRACTS.sealToken as `0x${string}`,
      abi: SealTokenABI,
      functionName: "mint",
      args: [address, BigInt(1000) * BigInt(10 ** 18)],
    });
    waitAndRefetch(tx as `0x${string}`); // fire-and-forget
    return tx;
  };

  return {
    votes:          votes   ? BigInt(votes.toString())   : BigInt(0),
    balance:        balance ? BigInt(balance.toString()) : BigInt(0),
    effectiveVotes: balance ? bigIntSqrt(BigInt(balance.toString()) * BigInt(10 ** 18)) : BigInt(0),
    delegate,
    mint,
    refetch,
  };
}
