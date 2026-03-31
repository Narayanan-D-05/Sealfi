"use client";

import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { SealGovernorABI, CONTRACTS } from "@/lib/contracts";
import type { Proposal, ProposalState } from "@/hooks/useProposals";

export function useProposals() {
  const { data: proposalCount, refetch: refetchCount } = useReadContract({
    address: CONTRACTS.sealGovernor as `0x${string}`,
    abi: SealGovernorABI,
    functionName: "proposalCount",
    query: { refetchInterval: 10_000 },
  });

  const count = proposalCount ? Number(proposalCount) : 0;

  const { data: results, isLoading, refetch } = useReadContracts({
    contracts: Array.from({ length: count }).map((_, i) => ({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI as any,
      functionName: "getProposal",
      args: [BigInt(i + 1)],
    })),
    query: { refetchInterval: 10_000 },
  });

  const proposals: Proposal[] = results
    ? results.map((res: any, i: number) => {
        const d = res.result as any;
        return {
          id: i + 1,
          proposer: d[0],
          description: d[1],
          voteStart: Number(d[2]),
          voteEnd: Number(d[3]),
          state: d[4] as ProposalState,
          forVotes: Number(d[5]),
          againstVotes: Number(d[6]),
          abstainVotes: Number(d[7]),
          target: "0x0000000000000000000000000000000000000000",
          callData: "0x",
          tallyRequested: false,
          executed: false,
        };
      })
    : [];

  return { proposals, isLoading, refetch };
}

export function useProposal(id: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACTS.sealGovernor as `0x${string}`,
    abi: SealGovernorABI,
    functionName: "getProposal",
    args: [BigInt(id)],
    query: { refetchInterval: 10_000 },
  });

  const proposal: Proposal | null = data
    ? {
        id,
        proposer: data[0],
        description: data[1],
        voteStart: Number(data[2]),
        voteEnd: Number(data[3]),
        state: data[4] as ProposalState,
        forVotes: Number(data[5]),
        againstVotes: Number(data[6]),
        abstainVotes: Number(data[7]),
        target: "0x0000000000000000000000000000000000000000",
        callData: "0x",
        tallyRequested: false,
        executed: false,
      }
    : null;

  return { proposal, isLoading, refetch };
}

export function useCastVote() {
  const { writeContractAsync, isPending } = useWriteContract();

  /**
   * Tries the real FHE castVote path first (uses fhevmjs to encrypt the vote
   * direction before it leaves the browser — the contract sees only ciphertext).
   * Falls back to castVotePlain if the Zama gateway is unreachable.
   *
   * Returns { hash, encrypted } where encrypted is the hex ciphertext handle
   * so the UI can display proof of encryption.
   */
  const castVote = async (
    proposalId: number,
    direction: string,
    encryptedVote?: { ciphertext: `0x${string}`; proof: `0x${string}` } | null
  ): Promise<{ hash: string; encrypted: boolean; ciphertext?: string }> => {
    const directionMap: Record<string, number> = { for: 1, against: 0, abstain: 2 };
    const directionValue = directionMap[direction] ?? 1;

    // ── FHE path: use the encrypted ciphertext if available ──────────────────
    if (encryptedVote?.ciphertext && encryptedVote?.proof) {
      // Validate it's a real fhevmjs ciphertext (not our plaintext fallback).
      // A real ciphertext is 32 bytes of random-looking data, not a padded uint8.
      const isRealCiphertext = encryptedVote.ciphertext.length > 66; // > 32 bytes

      if (isRealCiphertext) {
        try {
          const hash = await writeContractAsync({
            address: CONTRACTS.sealGovernor as `0x${string}`,
            abi: SealGovernorABI,
            functionName: "castVote",
            args: [BigInt(proposalId), BigInt(encryptedVote.ciphertext), encryptedVote.proof],
          });
          return { hash, encrypted: true, ciphertext: encryptedVote.ciphertext };
        } catch (err: any) {
          console.warn("[castVote] FHE path failed, falling back to plaintext:", err?.message);
        }
      }
    }

    // ── Plaintext fallback (testnet only) ────────────────────────────────────
    const hash = await writeContractAsync({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI,
      functionName: "castVotePlain",
      args: [BigInt(proposalId), directionValue],
    });
    return { hash, encrypted: false };
  };

  return { castVote, isPending };
}
export function useCreateProposal() {
  const { writeContractAsync, isPending } = useWriteContract();

  const createProposal = async (description: string) => {
    return writeContractAsync({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI,
      functionName: "propose",
      args: [
        description,
        "0x0000000000000000000000000000000000000000", // Target
        "0x", // callData
      ],
    });
  };

  return { createProposal, isPending };
}
