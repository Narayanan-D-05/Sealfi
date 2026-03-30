"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { SealedValue } from "@/components/ui/SealedValue";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProposalState } from "@/hooks/useProposals";

// Demo proposals data
const DEMO_PROPOSALS = [
  {
    id: 3,
    title: "Increase treasury allocation to 12%",
    description: "This proposal increases the protocol treasury allocation from 8% to 12% of all protocol fees. Funds will be used for grants, audits, and ecosystem development.",
    proposer: "0x3f...a912",
    voteStart: Math.floor(Date.now() / 1000) - 86400,
    voteEnd: Math.floor(Date.now() / 1000) + 172800,
    state: ProposalState.ACTIVE,
    voterCount: 847,
  },
  {
    id: 2,
    title: "Add HBAR as accepted collateral",
    description: "Add Hedera (HBAR) as an accepted collateral type in the lending protocol. This will expand the range of assets users can borrow against.",
    proposer: "0x7a...c031",
    voteStart: Math.floor(Date.now() / 1000) - 172800,
    voteEnd: Math.floor(Date.now() / 1000) + 86400,
    state: ProposalState.ACTIVE,
    voterCount: 1203,
  },
  {
    id: 1,
    title: "Adjust protocol fee from 0.30% to 0.25%",
    description: "Reduce the protocol fee from 0.30% to 0.25% to remain competitive and attract more trading volume.",
    proposer: "0x1b...f220",
    voteStart: Math.floor(Date.now() / 1000) - 604800,
    voteEnd: Math.floor(Date.now() / 1000) - 259200,
    state: ProposalState.EXECUTED,
    forVotes: 2104221,
    againstVotes: 891044,
    abstainVotes: 112003,
    voterCount: 1547,
  },
];

type FilterTab = "all" | "active" | "closed";

function ProposalCard({ proposal }: { proposal: typeof DEMO_PROPOSALS[0] }) {
  const isActive = proposal.state === ProposalState.ACTIVE;
  const isClosed = !isActive;

  return (
    <div className="border border-gray-border p-6 hover:border-yellow transition-colors">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <span className="font-mono text-gray text-sm">#{proposal.id}</span>
          <h3 className="font-grotesk text-xl font-medium mt-1">{proposal.title}</h3>
        </div>
        <StatusBadge state={proposal.state} />
      </div>

      <p className="font-mono text-sm text-gray mb-6 leading-relaxed">
        {proposal.description}
      </p>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm mb-4">
        {isActive ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-gray">FOR:</span>
              <SealedValue value={undefined} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray">AGAINST:</span>
              <SealedValue value={undefined} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray">ABSTAIN:</span>
              <SealedValue value={undefined} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-gray">FOR:</span>
              <SealedValue value={proposal.forVotes} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray">AGAINST:</span>
              <SealedValue value={proposal.againstVotes} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray">ABSTAIN:</span>
              <SealedValue value={proposal.abstainVotes} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-border">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm text-gray">
            Proposed by {proposal.proposer}
          </span>
          <span className="font-mono text-sm text-gray">
            {proposal.voterCount} votes cast
          </span>
        </div>

        {isActive ? (
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-gray">
              <CountdownTimer targetDate={proposal.voteEnd} />
            </span>
            <a
              href={`/vote/${proposal.id}`}
              className="btn-secondary text-xs py-2 px-4"
            >
              Vote
            </a>
          </div>
        ) : (
          <span className="font-mono text-sm text-gray">
            Closed {new Date(proposal.voteEnd * 1000).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredProposals = DEMO_PROPOSALS.filter((p) => {
    if (filter === "active") return p.state === ProposalState.ACTIVE;
    if (filter === "closed") return p.state !== ProposalState.ACTIVE;
    return true;
  });

  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="heading-lg">PROPOSALS</h1>
            <button className="btn-secondary text-sm py-2 px-4">
              + New Proposal
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-6 mb-8 border-b border-gray-border pb-4">
            {(["all", "active", "closed"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`font-grotesk text-sm uppercase tracking-wider transition-colors ${
                  filter === tab ? "text-yellow" : "text-gray hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Proposals Grid */}
          <div className="grid gap-6">
            {filteredProposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>

          {filteredProposals.length === 0 && (
            <div className="text-center py-20">
              <p className="font-mono text-gray">No proposals found.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
