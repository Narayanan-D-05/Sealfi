"use client";

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
    proposer: "0x3f...a912",
    voteEnd: Math.floor(Date.now() / 1000) + 172800, // 2 days
    state: ProposalState.ACTIVE,
    voterCount: 847,
  },
  {
    id: 2,
    title: "Add HBAR as accepted collateral",
    proposer: "0x7a...c031",
    voteEnd: Math.floor(Date.now() / 1000) + 86400, // 1 day
    state: ProposalState.ACTIVE,
    voterCount: 1203,
  },
  {
    id: 1,
    title: "Adjust protocol fee from 0.30% to 0.25%",
    proposer: "0x1b...f220",
    voteEnd: Math.floor(Date.now() / 1000) - 86400, // closed
    state: ProposalState.SUCCEEDED,
    forVotes: 2104221,
    againstVotes: 891044,
    abstainVotes: 112003,
    voterCount: 1547,
  },
];

function ProposalRow({ proposal }: { proposal: typeof DEMO_PROPOSALS[0] }) {
  const isActive = proposal.state === ProposalState.ACTIVE;

  return (
    <div className="border-b border-gray-border py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-gray">#{proposal.id}</span>
            <h3 className="font-grotesk text-lg font-medium">{proposal.title}</h3>
          </div>
          <p className="font-mono text-sm text-gray mb-4">
            Proposed by {proposal.proposer}
          </p>

          <div className="flex flex-wrap items-center gap-6 text-sm">
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
        </div>

        <div className="flex flex-col items-end gap-3">
          <StatusBadge state={proposal.state} />
          {isActive ? (
            <div className="font-mono text-sm text-gray">
              <CountdownTimer targetDate={proposal.voteEnd} />
            </div>
          ) : (
            <span className="font-mono text-sm text-gray">CLOSED</span>
          )}
          {isActive && (
            <a
              href={`/vote/${proposal.id}`}
              className="border border-yellow text-yellow px-4 py-2 font-grotesk text-xs uppercase tracking-wider hover:bg-yellow hover:text-black transition-colors"
            >
              Vote
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="heading-xl mb-8">
            EVERY VOTE
            <br />
            IS SEALED.
          </h1>
          <p className="body max-w-2xl text-gray mb-12">
            DAOs publish live tallies. Whales watch the trend and time their strike.
            Vote buyers verify delivery. SealFi seals the envelope. It opens once,
            when voting ends. Not before.
          </p>
          <a href="/proposals" className="btn-primary inline-block">
            Launch Governance
          </a>
        </div>
      </section>

      {/* Proof Section - Side by Side Comparison */}
      <section className="py-20 px-6 border-y border-gray-border">
        <div className="max-w-7xl mx-auto">
          <h2 className="heading-lg mb-12">PROOF.</h2>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Compound Governor */}
            <div className="border border-gray-border p-8">
              <h3 className="label mb-6 text-gray">Compound Governor (Live)</h3>
              <div className="space-y-4 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray">FOR:</span>
                  <span className="text-white">4,821,304</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray">AGAINST:</span>
                  <span className="text-white">1,203,901</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray">ABSTAIN:</span>
                  <span className="text-white">94,021</span>
                </div>
              </div>
            </div>

            {/* SealFi */}
            <div className="border border-yellow p-8">
              <h3 className="label mb-6 text-yellow">SealFi (Same Proposal)</h3>
              <div className="space-y-4 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray">FOR:</span>
                  <SealedValue value={undefined} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray">AGAINST:</span>
                  <SealedValue value={undefined} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray">ABSTAIN:</span>
                  <SealedValue value={undefined} />
                </div>
              </div>
            </div>
          </div>

          <p className="body mt-8 text-gray">
            Both protocols are counting the same votes. Only one of them tells you the score.
          </p>
        </div>
      </section>

      {/* Active Proposals */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="heading-lg mb-12">ACTIVE PROPOSALS</h2>
          <div className="border-t border-gray-border">
            {DEMO_PROPOSALS.map((proposal) => (
              <ProposalRow key={proposal.id} proposal={proposal} />
            ))}
          </div>
          <p className="body mt-8 text-gray">
            Active proposals show [sealed]. Closed proposals reveal the tally.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-t border-gray-border">
        <div className="max-w-7xl mx-auto">
          <h2 className="heading-lg mb-12">HOW IT WORKS</h2>
          <div className="grid md:grid-cols-5 gap-8">
            {[
              "You vote. Direction is encrypted using Zama fhEVM.",
              "Your vote accumulates into an encrypted tally.",
              "Nobody sees the tally during voting. Not even the protocol.",
              "When voting ends, the Gateway decrypts the final count.",
              "Result executes. Envelope opened once.",
            ].map((step, i) => (
              <div key={i} className="flex flex-col">
                <span className="font-mono text-yellow text-2xl mb-4">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-mono text-sm text-gray leading-relaxed">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
