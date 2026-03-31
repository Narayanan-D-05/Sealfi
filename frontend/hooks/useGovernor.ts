"use client";

import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { SealGovernorABI, CONTRACTS } from "@/lib/contracts";
import type { Proposal, ProposalState } from "@/hooks/useProposals";

export function useProposals() {
  const { data: proposalCount } = useReadContract({
    address: CONTRACTS.sealGovernor as `0x${string}`,
    abi: SealGovernorABI,
    functionName: "proposalCount",
  });

  const count = proposalCount ? Number(proposalCount) : 0;

  const { data: results, isLoading } = useReadContracts({
    contracts: Array.from({ length: count }).map((_, i) => ({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI as any,
      functionName: "getProposal",
      args: [BigInt(i + 1)],
    })),
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

  return { proposals, isLoading };
}

export function useProposal(id: number) {
  const { data, isLoading } = useReadContract({
    address: CONTRACTS.sealGovernor as `0x${string}`,
    abi: SealGovernorABI,
    functionName: "getProposal",
    args: [BigInt(id)],
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

  return { proposal, isLoading };
}

export function useCastVote() {
  const { writeContractAsync, isPending } = useWriteContract();

  const castVote = async (proposalId: number, encVote: `0x${string}`, proof: `0x${string}`) => {
    return writeContractAsync({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI,
      functionName: "castVote",
      args: [BigInt(proposalId), BigInt(encVote), proof],
    });
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
