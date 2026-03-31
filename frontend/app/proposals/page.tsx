"use client";

import { useState } from "react";
import { ProposalCard } from "@/components/proposals/ProposalCard";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useProposals } from "@/hooks/useGovernor";
import { ProposalState } from "@/hooks/useProposals";
import Link from "next/link";

export default function ProposalsPage() {
  const { proposals, isLoading } = useProposals();
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "CLOSED">("ALL");

  // Map real proposals to UI format
  const mappedProposals = proposals.map((p, idx) => {
    const isClosed = [ProposalState.SUCCEEDED, ProposalState.DEFEATED, ProposalState.EXECUTED, ProposalState.TALLYING].includes(p.state);
    const totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
    
    // Calculate time left
    const now = Math.floor(Date.now() / 1000);
    const diff = p.voteEnd - now;
    let timeLeft = "CLOSED";
    if (!isClosed && diff > 0) {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      timeLeft = `${days}d ${hours}h left`;
    }

    return {
      id: p.id.toString(),
      title: p.description.split('\n')[0] || `Proposal #${p.id}`,
      description: p.description,
      state: p.state, // Preserve for internal filtering
      status: p.state === ProposalState.ACTIVE ? "ACTIVE" as const : "PASSED" as const,
      category: "PROTOCOL",
      votes: totalVotes > 1000000 ? `${(totalVotes / 1000000).toFixed(1)}M` : totalVotes.toLocaleString(),
      timeLeft,
    };
  });

  const filteredProposals = mappedProposals.filter((p) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return p.state === ProposalState.ACTIVE;
    if (filter === "CLOSED") return [ProposalState.SUCCEEDED, ProposalState.DEFEATED, ProposalState.EXECUTED].includes(p.state);
    return true;
  });

  return (
    <div className="container px-6 lg:px-12 py-20 max-w-full min-h-screen">
      <div className="flex flex-col gap-10">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs text-[#888888] uppercase tracking-[0.4em]">SEALFI_GOVERNANCE_REGISTRY</span>
            <h1 className="text-6xl font-heading font-black tracking-tighter uppercase">
              PROPOSALS
            </h1>
          </div>
          <Link href="/gov" className="flex items-center gap-2 bg-[#E41E26] text-white px-6 py-3 font-heading font-black text-xs uppercase tracking-widest neo-border-thick neo-shadow-hard hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
            <Plus className="w-4 h-4" />
            CREATE_NEW_PROPOSAL
          </Link>
        </div>

        <div className="flex gap-0 border-b border-border">
          {["ALL", "ACTIVE", "CLOSED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={cn(
                "px-8 py-4 font-heading font-black text-xs uppercase tracking-widest border-b-2 transition-all",
                filter === tab ? "border-primary text-primary bg-[#111]" : "border-transparent text-[#555] hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-8">
          {isLoading ? (
            <div className="p-20 border border-border flex flex-col items-center justify-center text-center gap-4">
               <span className="font-mono text-[#555] uppercase animate-pulse">SYNCHRONIZING_WITH_BLOCKCHAIN...</span>
            </div>
          ) : filteredProposals.length > 0 ? (
            filteredProposals.map((prop, idx) => {
              const colors = ["#E41E26", "#8B5CF6", "#10B981", "#EC4899", "#F59E0B"];
              const color = colors[idx % colors.length];
              return (
                <Link key={prop.id} href={`/vote/${prop.id}`} className="block">
                  <ProposalCard 
                    id={prop.id}
                    title={prop.title}
                    status={prop.status}
                    description={prop.description}
                    votes={prop.votes}
                    timeLeft={prop.timeLeft}
                    category={prop.category}
                    color={color}
                    className="max-w-full cursor-pointer hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all"
                  />
                </Link>
              );
            })
          ) : (
            <div className="p-20 border border-border flex flex-col items-center justify-center text-center gap-4">
              <span className="font-mono text-[#555] uppercase">ZERO_RECORDS_FOUND</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
