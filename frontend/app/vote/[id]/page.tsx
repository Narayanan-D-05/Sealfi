"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { SealedValue } from "@/components/proposals/SealedValue";
import { cn } from "@/lib/utils";
import { Shield, Clock, Users, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useProposal, useCastVote } from "@/hooks/useGovernor";
import { useVote, type VoteDirection } from "@/hooks/useVote";
import { ProposalState } from "@/hooks/useProposals";
import Link from "next/link";

export default function VotePage() {
  const { id } = useParams();
  const router = useRouter();
  const proposalId = Number(id);
  
  const { proposal, isLoading: isLoadingProposal } = useProposal(proposalId);
  const { 
    selectedVote, 
    selectVote, 
    sealingState, 
    setSealingState,
    getSealingMessage, 
    encryptVote, 
    isReady: isFhevmReady,
    error: encryptionError 
  } = useVote();
  
  const { castVote, isPending: isSubmitting } = useCastVote();
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleVoteSubmission = async () => {
    if (!selectedVote || !isFhevmReady) return;

    try {
      // 1. Encrypt the vote
      const encrypted = await encryptVote(selectedVote);
      if (!encrypted) return;

      // 2. Submit to blockchain
      setSealingState("submitting");
      const hash = await castVote(proposalId, encrypted.ciphertext, encrypted.proof);
      setTxHash(hash || null);
      setSealingState("confirmed");
      
      // Optional: redirect after success
      // setTimeout(() => router.push('/proposals'), 4000);
    } catch (err) {
      console.error("Voting failed:", err);
      // setSealingState("error"); occurs in useVote if encryption fails
    }
  };

  if (isLoadingProposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen font-mono text-xs uppercase opacity-50">
        <Loader2 className="w-6 h-6 animate-spin mb-4" />
        LOADING_SECURE_ENCLAVE...
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen font-mono text-xs uppercase text-primary">
        <AlertCircle className="w-8 h-8 mb-4" />
        PROPOSAL_NOT_FOUND_OR_INVALID_ID
        <Link href="/proposals" className="mt-8 text-black underline">BACK_TO_REGISTRY</Link>
      </div>
    );
  }

  const isActive = proposal.state === ProposalState.ACTIVE;
  const isPending = proposal.state === ProposalState.PENDING;
  const isClosed = !isActive && !isPending;

  return (
    <div className="container px-6 lg:px-12 py-20 max-w-full min-h-screen bg-white">
      <Link href="/proposals" className="inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase mb-12 hover:text-primary transition-colors">
        <ArrowLeft className="w-3 h-3" /> BACK_TO_REGISTRY
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* LEFT COLUMN: INFORMATION */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-12">
          <div className="flex flex-col gap-4">
             <span className="font-mono text-xs text-primary font-black uppercase tracking-[0.2em]">
               {isActive ? "PROPOSAL_UNDER_SEAL" : "ARCHIVED_PROPOSAL"}
             </span>
             <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter uppercase leading-[0.9] text-black">
               {proposal.description.split('\n')[0]}
             </h1>
          </div>

          <div className="flex flex-wrap gap-8 border-y-[3px] border-black py-10 font-mono text-[10px] text-black/60 uppercase font-black">
            <div className="flex items-center gap-2">
              <span className="text-black/30">PROPOSER:</span> {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-black/30">CLOSES:</span> {new Date(proposal.voteEnd * 1000).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-black/30">STATUS:</span> 
              <span className={cn(isActive ? "text-green-600" : "text-primary")}>
                {ProposalState[proposal.state]}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-1 bg-primary" />
              <h3 className="font-heading font-black text-xs text-black uppercase tracking-widest">SPECIFICATION</h3>
            </div>
            <div className="bg-[#fafafa] p-12 neo-border-thick neo-shadow-hard">
               <p className="text-2xl font-heading font-bold text-black leading-tight italic uppercase">
                 "{proposal.description}"
               </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VOTING PANEL */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-8">
          <div className="bg-white neo-border-thick p-10 neo-shadow-hard flex flex-col gap-10 border-t-[12px] border-t-primary">
            <div className="flex justify-between items-start">
              <h2 className="text-4xl font-heading font-black uppercase tracking-tighter text-black">CAST_VOTE</h2>
              <Shield className="w-6 h-6 text-primary" />
            </div>

            <div className="flex flex-col gap-10">
              {/* CURRENT TALLY (SEALED) */}
              <div className="flex flex-col gap-4">
                 <div className="flex justify-between items-end">
                   <span className="font-mono text-[9px] font-black text-black/40 uppercase tracking-widest">ENCRYPTED_TALLY</span>
                   <div className="flex items-center gap-2 text-[9px] font-mono text-primary animate-pulse">
                     <Clock className="w-3 h-3" />
                     <span>LIVE_COUNT_MASKED</span>
                   </div>
                 </div>
                 <div className="grid grid-cols-3 gap-0 border-[3px] border-black text-center">
                    <div className="border-r-[3px] border-black p-4 flex flex-col gap-1">
                      <span className="font-mono text-[8px] text-black/40 font-black">FOR</span>
                      <SealedValue isSealed={isActive} className="text-sm font-black" />
                    </div>
                    <div className="border-r-[3px] border-black p-4 flex flex-col gap-1">
                      <span className="font-mono text-[8px] text-black/40 font-black">AGST</span>
                      <SealedValue isSealed={isActive} className="text-sm font-black" />
                    </div>
                    <div className="p-4 flex flex-col gap-1">
                      <span className="font-mono text-[8px] text-black/40 font-black">ABS</span>
                      <SealedValue isSealed={isActive} className="text-sm font-black" />
                    </div>
                 </div>
              </div>

              {/* ACTION AREA */}
              <div className="flex flex-col gap-6">
                 <div className="flex justify-between font-heading font-black items-end uppercase text-[10px]">
                   <span className="text-black/40">SELECT_DIRECTION</span>
                   <span className="text-black">POWER: 12.4K SEAL</span>
                 </div>
                 
                 <div className="flex flex-col gap-4">
                    {(["for", "against", "abstain"] as VoteDirection[]).map((v) => (
                      <button 
                        key={v} 
                        onClick={() => selectVote(v)}
                        disabled={!isActive || sealingState !== "idle"}
                        className={cn(
                          "w-full p-6 text-left font-heading font-black uppercase transition-all neo-border-thick text-sm",
                          selectedVote === v 
                            ? "bg-primary text-white translate-x-[-2px] translate-y-[-2px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" 
                            : "bg-white text-black/40 hover:text-black hover:bg-[#fafafa]"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                 </div>
              </div>

              {/* SUBMISSION STATUS */}
              {sealingState === "confirmed" ? (
                <div className="p-8 bg-green-50 border-[3px] border-green-600 text-center font-heading font-black text-green-600 uppercase flex flex-col gap-2">
                  <span className="text-sm">VOTE_SUCCESSFULLY_SEALED</span>
                  {txHash && (
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${txHash}`} 
                      target="_blank" 
                      className="text-[9px] font-mono underline opacity-60"
                    >
                      VIEW_ON_ETHERSCAN
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleVoteSubmission} 
                    disabled={!selectedVote || sealingState !== "idle" || !isFhevmReady || !isActive} 
                    className={cn(
                      "w-full py-6 font-heading font-black text-lg uppercase tracking-tight transition-all",
                      (!selectedVote || sealingState !== "idle" || !isFhevmReady || !isActive)
                        ? "bg-black/10 text-black/20 border-black/10 neo-border-thick cursor-not-allowed"
                        : "bg-black text-white neo-shadow-hard hover:bg-primary hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-x-2 active:translate-y-2"
                    )}
                  >
                    {sealingState === "submitting" ? (
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" /> DEPOSITING...
                      </div>
                    ) : sealingState === "sealing" ? (
                      "ENCRYPTING_BALLOT..."
                    ) : !isFhevmReady ? (
                      "INITIALIZING_FHE..."
                    ) : !isActive ? (
                      "VOTING_CLOSED"
                    ) : (
                      "CAST_SEALED_VOTE"
                    )}
                  </button>
                  
                  {encryptionError && (
                    <span className="font-mono text-[9px] text-primary text-center font-black uppercase">
                      Error: {encryptionError}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-6 py-4 bg-[#fafafa] neo-border-thick font-mono text-[9px] font-black uppercase">
            <Users className="w-4 h-4 text-primary" />
            <span>PARTICIPATION_STRENGTH: HIGH (847 VOTES)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
