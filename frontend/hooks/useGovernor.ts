"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { SealGovernorABI, CONTRACTS } from "@/lib/contracts";
import type { Proposal, ProposalState } from "@/hooks/useProposals";

export function useProposals() {
  const { data: proposalCount } = useReadContract({
    address: CONTRACTS.sealGovernor as `0x${string}`,
    abi: SealGovernorABI,
    functionName: "proposalCount",
  });

  return { proposalCount: proposalCount ? Number(proposalCount) : 0 };
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
  const { writeContract, isPending } = useWriteContract();

  const castVote = async (proposalId: number, encVote: `0x${string}`, proof: `0x${string}`) => {
    return writeContract({
      address: CONTRACTS.sealGovernor as `0x${string}`,
      abi: SealGovernorABI,
      functionName: "castVote",
      args: [BigInt(proposalId), encVote, proof],
    });
  };

  return { castVote, isPending };
}
