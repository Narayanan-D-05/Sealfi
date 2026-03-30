import { ProposalState } from "@/hooks/useProposals";

interface StatusBadgeProps {
  state: ProposalState;
}

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.PENDING]: "PENDING",
  [ProposalState.ACTIVE]: "ACTIVE",
  [ProposalState.TALLYING]: "TALLYING",
  [ProposalState.SUCCEEDED]: "PASSED",
  [ProposalState.DEFEATED]: "DEFEATED",
  [ProposalState.EXECUTED]: "EXECUTED",
};

const stateStyles: Record<ProposalState, string> = {
  [ProposalState.PENDING]: "border-gray text-gray",
  [ProposalState.ACTIVE]: "border-yellow text-yellow",
  [ProposalState.TALLYING]: "border-white text-white",
  [ProposalState.SUCCEEDED]: "border-green-500 text-green-500",
  [ProposalState.DEFEATED]: "border-red-500 text-red-500",
  [ProposalState.EXECUTED]: "border-green-500 text-green-500 bg-green-500/10",
};

export function StatusBadge({ state }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block border px-3 py-1 font-mono text-xs ${stateStyles[state]}`}
    >
      {stateLabels[state]}
    </span>
  );
}
