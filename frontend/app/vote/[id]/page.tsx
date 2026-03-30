"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { SealedValue } from "@/components/ui/SealedValue";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useVote, VoteDirection } from "@/hooks/useVote";
import { useCastVote } from "@/hooks/useGovernor";
import { ProposalState } from "@/hooks/useProposals";

// Demo proposal data
const DEMO_PROPOSAL = {
  id: 3,
  title: "Increase treasury allocation to 12%",
  description:
    "This proposal increases the protocol treasury allocation from 8% to 12% of all protocol fees. Funds will be used for grants, security audits, and ecosystem development initiatives.\n\nThe increased allocation will be automatically directed to the treasury contract and managed by the DAO through subsequent proposals.",
  proposer: "0x3f...a912",
  voteStart: Math.floor(Date.now() / 1000) - 86400,
  voteEnd: Math.floor(Date.now() / 1000) + 172800,
  state: ProposalState.ACTIVE,
  voterCount: 847,
  votingPower: 500000,
};

function VoteButton({
  direction,
  selected,
  onClick,
}: {
  direction: VoteDirection;
  selected: boolean;
  onClick: () => void;
}) {
  const labels: Record<VoteDirection, string> = {
    for: "FOR",
    against: "AGAINST",
    abstain: "ABSTAIN",
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-8 px-4 font-grotesk font-bold text-lg uppercase tracking-wider transition-all ${
        selected
          ? "border-2 border-yellow text-yellow"
          : "border border-gray-border text-gray hover:border-white hover:text-white"
      }`}
    >
      {labels[direction]}
    </button>
  );
}

export default function VotePage() {
  const params = useParams();
  const proposalId = Number(params.id);
  const { selectedVote, selectVote, canSubmit, encryptVote, sealingState, getSealingMessage, error } = useVote();
  const { castVote, isPending } = useCastVote();
  const [hasVoted, setHasVoted] = useState(false);

  const handleCastVote = async () => {
    if (!selectedVote) return;
    
    const encrypted = await encryptVote(selectedVote);
    // encryptVote already updates the sealingState to "error" if it fails
    if (!encrypted) return;
    
    try {
      await castVote(proposalId, encrypted.ciphertext, encrypted.proof);
      setHasVoted(true);
    } catch (err) {
      console.error("Failed to cast vote:", err);
    }
  };

  if (hasVoted) {
    return (
      <main className="min-h-screen bg-black">
        <Navbar />
        <div className="pt-32 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-lg mb-6">VOTE RECORDED</h2>
            <p className="font-mono text-gray mb-8">
              Your sealed vote was recorded. The tally remains sealed until{" "}
              {new Date(DEMO_PROPOSAL.voteEnd * 1000).toLocaleString()}.
            </p>
            <a href="/proposals" className="btn-primary">
              Back to Proposals
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Proposal Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-gray">#{proposalId}</span>
              <StatusBadge state={DEMO_PROPOSAL.state} />
            </div>
            <h1 className="heading-lg mb-4">{DEMO_PROPOSAL.title}</h1>
            <div className="flex items-center gap-6 font-mono text-sm text-gray">
              <span>Proposed by {DEMO_PROPOSAL.proposer}</span>
              <span>Closes {new Date(DEMO_PROPOSAL.voteEnd * 1000).toLocaleString()}</span>
            </div>
          </div>

          {/* Description */}
          <div className="border border-gray-border p-6 mb-8">
            <h3 className="label mb-4">DESCRIPTION</h3>
            <p className="font-mono text-sm text-gray leading-relaxed whitespace-pre-line">
              {DEMO_PROPOSAL.description}
            </p>
          </div>

          {/* Current Tally */}
          <div className="border border-gray-border p-6 mb-8">
            <h3 className="label mb-4">CURRENT TALLY</h3>
            <div className="grid grid-cols-3 gap-8 mb-4">
              <div>
                <span className="text-gray text-sm block mb-2">FOR</span>
                <SealedValue value={undefined} />
              </div>
              <div>
                <span className="text-gray text-sm block mb-2">AGAINST</span>
                <SealedValue value={undefined} />
              </div>
              <div>
                <span className="text-gray text-sm block mb-2">ABSTAIN</span>
                <SealedValue value={undefined} />
              </div>
            </div>
            <p className="font-mono text-sm text-gray">
              {DEMO_PROPOSAL.voterCount} addresses have voted
            </p>
            <p className="font-mono text-xs text-gray mt-2">
              Tally reveals at close. Sealed until{" "}
              {new Date(DEMO_PROPOSAL.voteEnd * 1000).toLocaleString()}.
            </p>
          </div>

          {/* Cast Your Vote */}
          <div className="border border-gray-border p-6">
            <h3 className="label mb-4">CAST YOUR VOTE</h3>

            <div className="mb-6">
              <span className="text-gray text-sm block mb-2">Your voting power</span>
              <span className="font-mono text-xl text-white">
                {DEMO_PROPOSAL.votingPower.toLocaleString()} SEAL
              </span>
            </div>

            <div className="flex gap-4 mb-6">
              <VoteButton
                direction="for"
                selected={selectedVote === "for"}
                onClick={() => selectVote("for")}
              />
              <VoteButton
                direction="against"
                selected={selectedVote === "against"}
                onClick={() => selectVote("against")}
              />
              <VoteButton
                direction="abstain"
                selected={selectedVote === "abstain"}
                onClick={() => selectVote("abstain")}
              />
            </div>

            <p className="font-mono text-xs text-gray mb-6">
              Your vote is encrypted before it leaves your browser. Nobody can see how
              you voted — not during voting, not after.
            </p>

            <button
              onClick={handleCastVote}
              disabled={!canSubmit || isPending || sealingState !== "idle"}
              className={`w-full py-4 font-grotesk font-bold uppercase tracking-wider transition-colors ${
                canSubmit && !isPending && sealingState === "idle"
                  ? "bg-yellow text-black hover:bg-white"
                  : "bg-gray-border text-gray cursor-not-allowed"
              }`}
            >
              {isPending ? "DEPOSITING INTO ENVELOPE..." : sealingState !== "idle" ? getSealingMessage() : "Cast Sealed Vote"}
            </button>
            {error && <p className="font-mono text-white mt-4">{error}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
