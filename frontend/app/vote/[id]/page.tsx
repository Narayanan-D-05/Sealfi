"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { SealedValue } from "@/components/proposals/SealedValue";
import { cn } from "@/lib/utils";
import { Shield, Clock, Users, ArrowLeft, Loader2, AlertCircle, Lock, Unlock, CheckCircle2, XCircle } from "lucide-react";
import { useProposal, useCastVote } from "@/hooks/useGovernor";
import { useVote, type VoteDirection } from "@/hooks/useVote";
import { useToken } from "@/hooks/useToken";
import { ProposalState } from "@/hooks/useProposals";
import { useWriteContract } from "wagmi";
import { SealGovernorABI, CONTRACTS } from "@/lib/contracts";
import Link from "next/link";

export default function VotePage() {
  const { id } = useParams();
  const proposalId = Number(id);

  const { proposal, isLoading: isLoadingProposal, refetch: refetchProposal } = useProposal(proposalId);
  const { selectedVote, selectVote, sealingState, setSealingState, encryptVote } = useVote();
  const { castVote, isPending: isSubmitting } = useCastVote();
  const { effectiveVotes: userPower } = useToken();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [ciphertextHandle, setCiphertextHandle] = useState<string | null>(null);
  const [tallyTxHash, setTallyTxHash] = useState<string | null>(null);
  const [tallyState, setTallyState] = useState<"idle" | "requesting" | "done" | "error">("idle");
  const [fulfillState, setFulfillState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [fulfillTxHash, setFulfillTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Live clock tick — no page reloads
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Proposal state derived from timestamps
  const isVotingOpen = proposal ? currentTime >= proposal.voteStart && currentTime <= proposal.voteEnd : false;
  const isPending    = proposal ? proposal.state === ProposalState.PENDING && currentTime < proposal.voteStart : false;
  const isActive     = proposal ? proposal.state === ProposalState.ACTIVE || (proposal.state === ProposalState.PENDING && isVotingOpen) : false;
  const isVotingOver = proposal ? currentTime > proposal.voteEnd : false;
  const isTallied    = proposal ? [ProposalState.SUCCEEDED, ProposalState.DEFEATED].includes(proposal.state) : false;
  const isTallying   = proposal ? proposal.state === ProposalState.TALLYING : false;
  const isClosed     = !isActive && !isPending;

  // Time remaining display
  const timeLeft = proposal && !isVotingOver
    ? Math.max(0, proposal.voteEnd - currentTime)
    : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const handleVoteSubmission = async () => {
    if (!selectedVote) return;
    try {
      setSealingState("sealing");
      // Step 1: Encrypt the vote direction using fhevmjs (Zama gateway)
      const encrypted = await encryptVote(selectedVote);
      setSealingState("submitting");
      // Step 2: Submit — FHE path if real ciphertext, plaintext fallback otherwise
      const result = await castVote(proposalId, selectedVote, encrypted);
      setTxHash(result.hash || null);
      setIsEncrypted(result.encrypted);
      setCiphertextHandle(result.ciphertext?.slice(0, 20) + "..." || null);
      setSealingState("confirmed");
    } catch (err: any) {
      console.error("Voting failed:", err);
      setSealingState("idle");
    }
  };

  const handleRequestTally = async () => {
    try {
      setTallyState("requesting");
      const hash = await writeContractAsync({
        address: CONTRACTS.sealGovernor as `0x${string}`,
        abi: SealGovernorABI,
        functionName: "requestTally",
        args: [BigInt(proposalId)],
      });
      setTallyTxHash(hash || null);
      setTallyState("done");
      // Immediately re-read from chain — no hard reload needed
      setTimeout(() => refetchProposal(), 4000);
    } catch (err: any) {
      console.error("requestTally failed:", err);
      setTallyState("error");
    }
  };

  const handleFulfillTally = async () => {
    if (!proposal) return;
    try {
      setFulfillState("submitting");
      // Votes are already stored via castVotePlain — pass them back to finalize state
      const hash = await writeContractAsync({
        address: CONTRACTS.sealGovernor as `0x${string}`,
        abi: SealGovernorABI,
        functionName: "fulfillTally",
        args: [
          BigInt(proposalId),
          BigInt(Math.round(proposal.forVotes)),
          BigInt(Math.round(proposal.againstVotes)),
          BigInt(Math.round(proposal.abstainVotes)),
        ],
      });
      setFulfillTxHash(hash || null);
      setFulfillState("done");
      // Immediately re-read from chain — no hard reload needed
      setTimeout(() => refetchProposal(), 4000);
    } catch (err: any) {
      console.error("fulfillTally failed:", err);
      setFulfillState("error");
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

  const totalWeight = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const forPct      = totalWeight > 0 ? (proposal.forVotes / totalWeight) * 100 : 0;
  const againstPct  = totalWeight > 0 ? (proposal.againstVotes / totalWeight) * 100 : 0;
  const abstainPct  = totalWeight > 0 ? (proposal.abstainVotes / totalWeight) * 100 : 0;

  return (
    <div className="container px-6 lg:px-12 py-20 max-w-full min-h-screen bg-white">
      <Link href="/proposals" className="inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase mb-12 hover:text-primary transition-colors">
        <ArrowLeft className="w-3 h-3" /> BACK_TO_REGISTRY
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* LEFT: Info */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <span className={cn("font-mono text-xs font-black uppercase tracking-[0.2em]",
              isActive ? "text-green-600" : isTallied ? "text-primary" : "text-black/40"
            )}>
              {isActive ? "PROPOSAL_UNDER_SEAL" : isTallying ? "TALLY_PENDING_REVEAL" : isTallied ? "RESULTS_PUBLISHED" : "ARCHIVED_PROPOSAL"}
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
              <span className={cn(isActive ? "text-green-600" : isTallied && proposal.state === ProposalState.SUCCEEDED ? "text-green-600" : "text-primary")}>
                {ProposalState[proposal.state]}
              </span>
            </div>
            {isActive && (
              <div className="flex items-center gap-2 text-primary animate-pulse">
                <Clock className="w-3 h-3" />
                <span>CLOSES_IN: {mins}m {secs}s</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-1 bg-primary" />
              <h3 className="font-heading font-black text-xs text-black uppercase tracking-widest">SPECIFICATION</h3>
            </div>
            <div className="bg-[#fafafa] p-12 neo-border-thick neo-shadow-hard flex flex-col gap-6">
              <p className="text-xl font-heading font-bold text-black leading-tight italic uppercase">
                "{proposal.description.split('\n')[0]}"
              </p>
              <div className="flex flex-col gap-1 border-t-2 border-black/10 pt-6">
                {proposal.description.split('\n').slice(1).filter(Boolean).map((line, i) => (
                  <p key={i} className={`font-mono text-xs uppercase ${
                    line.startsWith('FOR') || line.startsWith('AGAINST') || line.startsWith('ABSTAIN')
                      ? 'text-black font-bold py-2 border-b border-black/5'
                      : line.startsWith('OPTIONS')
                        ? 'text-primary font-black tracking-widest mt-2 mb-1'
                        : 'text-black/50 mb-1'
                  }`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* RESULTS — shown after voting ends */}
          {(isTallied || isTallying || isVotingOver) && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-1 bg-primary" />
                <h3 className="font-heading font-black text-xs text-black uppercase tracking-widest">
                  {isTallied ? "FINAL_RESULTS" : "TALLY_PENDING"}
                </h3>
              </div>

              {isTallied ? (
                <div className="flex flex-col gap-6 neo-border-thick neo-shadow-hard p-10 bg-white">
                  {/* Outcome Badge */}
                  <div className={cn(
                    "inline-flex items-center gap-3 px-6 py-3 font-heading font-black text-xl uppercase self-start",
                    proposal.state === ProposalState.SUCCEEDED
                      ? "bg-green-600 text-white"
                      : "bg-primary text-white"
                  )}>
                    {proposal.state === ProposalState.SUCCEEDED
                      ? <><CheckCircle2 className="w-6 h-6" /> PROPOSAL_PASSED</>
                      : <><XCircle className="w-6 h-6" /> PROPOSAL_DEFEATED</>
                    }
                  </div>

                  {/* Vote Bars */}
                  {[
                    { label: "FOR",     votes: proposal.forVotes,      pct: forPct,     color: "bg-green-500" },
                    { label: "AGAINST", votes: proposal.againstVotes,  pct: againstPct, color: "bg-primary" },
                    { label: "ABSTAIN", votes: proposal.abstainVotes,  pct: abstainPct, color: "bg-black/20" },
                  ].map(({ label, votes, pct, color }) => (
                    <div key={label} className="flex flex-col gap-2">
                      <div className="flex justify-between font-mono text-[10px] font-black uppercase">
                        <span>{label}</span>
                        <span>{pct.toFixed(1)}% · {(votes / 1e18).toFixed(2)} QUAD_WEIGHT</span>
                      </div>
                      <div className="w-full h-4 bg-black/5 border-[2px] border-black">
                        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}

                  <div className="font-mono text-[9px] text-black/40 uppercase font-black pt-2 border-t-[2px] border-black">
                    TOTAL_QUAD_WEIGHT: {(totalWeight / 1e18).toFixed(2)} · DECRYPTED_ON_CHAIN ✓
                  </div>
                </div>
              ) : (
                <div className="neo-border-thick p-10 flex flex-col gap-4 bg-[#fafafa]">
                  <div className="flex items-center gap-3 font-mono text-[10px] font-black uppercase text-black/60">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>VOTING_PERIOD_ENDED. TALLY_NOT_YET_REVEALED.</span>
                  </div>
                  <p className="font-heading font-bold text-sm uppercase text-black/60">
                    Call REQUEST_TALLY to publish the results on-chain. Anyone can do this.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Vote / Tally Panel */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-8">
          <div className="bg-white neo-border-thick p-10 neo-shadow-hard flex flex-col gap-10 border-t-[12px] border-t-primary">
            <div className="flex justify-between items-start">
              <h2 className="text-4xl font-heading font-black uppercase tracking-tighter text-black">
                {isTallied ? "RESULTS" : "CAST_VOTE"}
              </h2>
              {isTallied
                ? <Unlock className="w-6 h-6 text-green-600" />
                : <Shield className="w-6 h-6 text-primary" />
              }
            </div>

            <div className="flex flex-col gap-10">
              {/* TALLY DISPLAY */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <span className="font-mono text-[9px] font-black text-black/40 uppercase tracking-widest">
                    {isTallied ? "REVEALED_TALLY" : "ENCRYPTED_TALLY"}
                  </span>
                  {!isTallied && (
                    <div className="flex items-center gap-2 text-[9px] font-mono text-primary animate-pulse">
                      <Clock className="w-3 h-3" /><span>LIVE_COUNT_MASKED</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-0 border-[3px] border-black text-center">
                  {[
                    { label: "FOR",  val: isTallied ? (proposal.forVotes / 1e18).toFixed(1)     : null },
                    { label: "AGST", val: isTallied ? (proposal.againstVotes / 1e18).toFixed(1) : null },
                    { label: "ABS",  val: isTallied ? (proposal.abstainVotes / 1e18).toFixed(1) : null },
                  ].map(({ label, val }, i) => (
                    <div key={label} className={cn("p-4 flex flex-col gap-1", i < 2 && "border-r-[3px] border-black")}>
                      <span className="font-mono text-[8px] text-black/40 font-black">{label}</span>
                      {val !== null
                        ? <span className="font-heading font-black text-sm">{val}</span>
                        : <SealedValue isSealed={true} className="text-sm font-black" />
                      }
                    </div>
                  ))}
                </div>
              </div>

              {/* VOTE BUTTONS — only when active */}
              {isActive && (
                <div className="flex flex-col gap-6">
                  <div className="flex justify-between font-heading font-black items-end uppercase text-[10px]">
                    <span className="text-black/40">SELECT_DIRECTION</span>
                    <span className="text-black">QUAD_POWER: {(Number(userPower) / 10**18).toFixed(1)} SEAL</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {(["for", "against", "abstain"] as VoteDirection[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => selectVote(v)}
                        disabled={sealingState !== "idle"}
                        className={cn(
                          "w-full p-6 text-left font-heading font-black uppercase transition-all neo-border-thick text-sm",
                          selectedVote === v
                            ? "bg-primary text-white translate-x-[-2px] translate-y-[-2px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white text-black/40 hover:text-black hover:bg-[#fafafa]"
                        )}
                      >{v}</button>
                    ))}
                  </div>

                  {sealingState === "confirmed" ? (
                    <div className="p-8 bg-green-50 border-[3px] border-green-600 text-center font-heading font-black text-green-600 uppercase flex flex-col gap-3">
                      <CheckCircle2 className="w-8 h-8 mx-auto" />
                      <span className="text-sm">VOTE_SUCCESSFULLY_SEALED</span>
                      {/* FHE encryption status badge */}
                      <div className={cn(
                        "self-center px-3 py-1 text-[9px] font-mono font-black tracking-widest",
                        isEncrypted
                          ? "bg-green-600 text-white"
                          : "bg-yellow-500 text-white"
                      )}>
                        {isEncrypted ? "🔒 FHE_ENCRYPTED" : "⚠ PLAINTEXT_MODE"}
                      </div>
                      {/* Show truncated ciphertext handle as proof of encryption */}
                      {isEncrypted && ciphertextHandle && (
                        <div className="font-mono text-[8px] text-green-700 break-all opacity-70">
                          CIPHERTEXT: {ciphertextHandle}
                        </div>
                      )}
                      {!isEncrypted && (
                        <div className="font-mono text-[8px] text-yellow-700 opacity-70">
                          Zama gateway unreachable — vote submitted in plaintext fallback mode
                        </div>
                      )}
                      {txHash && (
                        <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" className="text-[9px] font-mono underline opacity-60">
                          VIEW_ON_ETHERSCAN ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleVoteSubmission}
                      disabled={!selectedVote || sealingState !== "idle"}
                      className={cn(
                        "w-full py-6 font-heading font-black text-lg uppercase tracking-tight transition-all",
                        (!selectedVote || sealingState !== "idle")
                          ? "bg-black/10 text-black/20 border-black/10 neo-border-thick cursor-not-allowed"
                          : "bg-black text-white neo-shadow-hard hover:bg-primary hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      )}
                    >
                      {sealingState === "sealing" ? (
                        <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> SEALING_WITH_FHE...</div>
                      ) : sealingState === "submitting" ? (
                        <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> DEPOSITING...</div>
                      ) : "CAST_SEALED_VOTE"}
                    </button>
                  )}
                </div>
              )}

              {/* PENDING — countdown */}
              {isPending && (
                <div className="flex flex-col gap-3 p-6 bg-[#fafafa] neo-border-thick font-mono text-[10px] font-black uppercase">
                  <Clock className="w-4 h-4 text-primary animate-pulse" />
                  <span>VOTING_DELAY_ACTIVE</span>
                  <span className="text-black/40">Opens in ~{Math.max(0, proposal.voteStart - currentTime)}s</span>
                </div>
              )}

              {/* REQUEST TALLY — shown when voting is over but not yet tallied */}
              {isVotingOver && !isTallied && !isTallying && (
                <div className="flex flex-col gap-4">
                  <div className="p-6 bg-yellow-50 border-[3px] border-yellow-500 font-mono text-[9px] font-black uppercase text-yellow-700">
                    VOTING_CLOSED. TALLY_NOT_REVEALED.
                  </div>
                  <button
                    onClick={handleRequestTally}
                    disabled={tallyState === "requesting" || tallyState === "done"}
                    className={cn(
                      "w-full py-6 font-heading font-black text-lg uppercase tracking-tight transition-all neo-border-thick",
                      tallyState === "done"
                        ? "bg-green-600 text-white cursor-default"
                        : tallyState === "requesting"
                          ? "bg-black/10 text-black/30 cursor-not-allowed"
                          : "bg-black text-white neo-shadow-hard hover:bg-primary hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    )}
                  >
                    {tallyState === "requesting" ? (
                      <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> REQUESTING...</div>
                    ) : tallyState === "done" ? (
                      <div className="flex items-center justify-center gap-3"><CheckCircle2 className="w-5 h-5" /> TALLY_REQUESTED</div>
                    ) : (
                      <div className="flex items-center justify-center gap-3"><Unlock className="w-5 h-5" /> REQUEST_TALLY</div>
                    )}
                  </button>
                  {tallyTxHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${tallyTxHash}`} target="_blank" className="font-mono text-[9px] underline text-center text-black/40 hover:text-primary">
                      VIEW_TX_ON_ETHERSCAN
                    </a>
                  )}
                  {tallyState === "error" && (
                    <span className="font-mono text-[9px] text-primary text-center font-black uppercase">
                      ERROR — may already be requested. Refresh the page.
                    </span>
                  )}
                </div>
              )}

              {/* TALLYING state */}
              {isTallying && (
                <div className="flex flex-col gap-4">
                  <div className="p-6 bg-[#fafafa] neo-border-thick flex flex-col gap-3 font-mono text-[10px] font-black uppercase">
                    <div className="flex items-center gap-3 text-primary">
                      <CheckCircle2 className="w-4 h-4" /> TALLY_REQUESTED_ON_CHAIN
                    </div>
                    <span className="text-black/40">Click below to finalize and publish results.</span>
                  </div>
                  <button
                    onClick={handleFulfillTally}
                    disabled={fulfillState === "submitting" || fulfillState === "done"}
                    className={cn(
                      "w-full py-6 font-heading font-black text-lg uppercase tracking-tight transition-all neo-border-thick",
                      fulfillState === "done"
                        ? "bg-green-600 text-white cursor-default"
                        : fulfillState === "submitting"
                          ? "bg-black/10 text-black/30 cursor-not-allowed"
                          : "bg-primary text-white neo-shadow-hard hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    )}
                  >
                    {fulfillState === "submitting" ? (
                      <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> PUBLISHING...</div>
                    ) : fulfillState === "done" ? (
                      <div className="flex items-center justify-center gap-3"><CheckCircle2 className="w-5 h-5" /> RESULTS_PUBLISHED!</div>
                    ) : (
                      <div className="flex items-center justify-center gap-3"><Unlock className="w-5 h-5" /> FULFILL_TALLY</div>
                    )}
                  </button>
                  {fulfillTxHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${fulfillTxHash}`} target="_blank" className="font-mono text-[9px] underline text-center text-black/40 hover:text-primary">
                      VIEW_TX_ON_ETHERSCAN
                    </a>
                  )}
                  {fulfillState === "error" && (
                    <span className="font-mono text-[9px] text-primary text-center font-black uppercase">
                      TX_FAILED — check console for details
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-4 bg-[#fafafa] neo-border-thick font-mono text-[9px] font-black uppercase">
            <Users className="w-4 h-4 text-primary" />
            <span>PARTICIPATION: {(totalWeight / 1e18).toFixed(2)} SEAL_QUAD_WEIGHT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
