"use client";

import { motion } from "framer-motion";
import { ProposalCard } from "@/components/proposals/ProposalCard";
import { ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { SealedValue } from "@/components/proposals/SealedValue";
import { useProposals } from "@/hooks/useGovernor";
import { ProposalState } from "@/hooks/useProposals";
import Link from "next/link";

export default function Home() {
  const { proposals, isLoading } = useProposals();

  // Create representative 'leaked' values for the comparison column
  const leakedFor = 4782900 + (proposals.length * 100);
  const leakedAgainst = 1245300 + (proposals.length * 50);
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

    const colors = ["#FACC15", "#4ADE80", "#60A5FA", "#EC4899", "#8B5CF6"];
    
    return {
      id: p.id.toString(),
      title: p.description.split('\n')[0] || `Proposal #${p.id}`,
      description: p.description,
      status: p.state === ProposalState.ACTIVE ? "ACTIVE" as const : "PASSED" as const, 
      category: "Protocol",
      votes: totalVotes > 1000000 ? `${(totalVotes / 1000000).toFixed(1)}M` : totalVotes.toLocaleString(),
      timeLeft,
      color: colors[idx % colors.length]
    };
  });

  // Only show first 3 for home
  const topProposals = mappedProposals.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* HERO SECTION */}
      <section className="pt-32 pb-40 px-6 lg:px-20 text-center border-b-[4px] border-black bg-white">
        <div className="container max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-10"
          >
            <div className="inline-flex items-center gap-3 bg-[#E41E26] text-white px-5 py-1.5 rounded-full font-mono text-[11px] font-black uppercase mb-6 neo-border-thick neo-shadow-hard">
              <Activity className="w-4 h-4 animate-pulse" /> NETWORK_STATUS: SECURE_ENCLAVE_LIVE
            </div>

            <h1 className="group font-heading font-black text-6xl md:text-[120px] leading-[0.8] tracking-tighter text-black uppercase drop-shadow-[6px_6px_0px_#E41E26] transition-all duration-300">
              <span className="hover:text-[#FACC15] transition-colors cursor-default block mb-4">EVERY VOTE</span>
              <span className="hover:text-[#FACC15] transition-colors cursor-default block">IS <span className="text-[#E41E26] group-hover:text-[#FACC15]">SEALED.</span></span>
            </h1>
            
            <p className="font-heading font-bold text-xl md:text-2xl max-w-4xl mx-auto text-black/80 leading-tight uppercase tracking-tight italic">
              DAOs publish live tallies. Whales watch the trend and time their strike. <br className="hidden md:block" />
              SealFi seals the envelope. It opens once, when voting ends. Not before.
            </p>

            <div className="flex flex-col md:flex-row justify-center gap-8 pt-10">
              <Link href="/proposals" className="bg-black text-white px-16 py-6 rounded-full font-heading font-black text-sm uppercase neo-shadow-hard hover:bg-[#E41E26] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center">
                LAUNCH_APP
              </Link>
              <Link 
                href="https://github.com/Narayanan-D-05/Sealfi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-black px-16 py-6 rounded-full font-heading font-black text-sm uppercase neo-border-thick hover:bg-black hover:text-white transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
              >
                GITHUB
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* COMPARISON SECTION */}
      <section className="py-32 px-6 lg:px-20 border-b-[4px] border-black bg-[#fafafa]">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-[4px] border-black neo-shadow-hard">
            {/* Standard DAO */}
            <div className="p-12 border-b-[4px] md:border-b-0 md:border-r-[4px] border-black bg-white">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-red-600 border-[3px] border-black rounded-xl">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div className="font-heading font-black text-2xl tracking-tighter uppercase">Standard Governor</div>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b-2 border-black/10 pb-4">
                  <span className="font-mono text-[10px] text-black/40 uppercase">VOTES_FOR</span>
                  <span className="font-mono text-3xl font-black">{(leakedFor / 1000000).toFixed(1)}M SEAL</span>
                </div>
                <div className="flex justify-between items-end border-b-2 border-black/10 pb-4">
                  <span className="font-mono text-[10px] text-black/40 uppercase">VOTES_AGAINST</span>
                  <span className="font-mono text-3xl font-black">{(leakedAgainst / 1000000).toFixed(1)}M SEAL</span>
                </div>
                <div className="p-4 bg-red-50 font-mono text-[10px] font-bold text-red-600 uppercase text-center border-2 border-red-200">
                  ⚠️ REALTIME_LEAK_DETECTED: TRENDS_VISIBLE_TO_WHALES
                </div>
              </div>
            </div>

            {/* SealFi */}
            <div className="p-12 bg-white">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-[#E41E26] border-[3px] border-black rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="font-heading font-black text-2xl tracking-tighter uppercase">SealFi Protocol</div>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b-2 border-black/10 pb-4">
                  <span className="font-mono text-[10px] text-black/40 uppercase">VOTES_FOR</span>
                  <SealedValue className="text-3xl font-black text-[#E41E26]" />
                </div>
                <div className="flex justify-between items-end border-b-2 border-black/10 pb-4">
                  <span className="font-mono text-[10px] text-black/40 uppercase">VOTES_AGAINST</span>
                  <SealedValue className="text-3xl font-black text-[#E41E26]" />
                </div>
                <div className="p-4 bg-green-50 font-mono text-[10px] font-bold text-green-600 uppercase text-center border-2 border-green-200">
                  ✅ SECURED_BY_FHEVM: ENVELOPE_SEALED_UNTIL_CLOSE
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SECTION */}
      <section className="py-32 px-6 lg:px-20 bg-white">
        <div className="container max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
            <div>
              <h2 className="font-heading font-black text-5xl text-black uppercase tracking-tighter mb-4">
                PROPOSAL_REGISTRY
              </h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-[6px] bg-[#E41E26]" />
                <p className="font-mono text-[11px] font-black text-black/40 uppercase tracking-[0.2rem]">CONFIDENTIAL_VOTING_ACTIVE</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Link href="/proposals" className="bg-black text-white px-8 py-4 rounded-full font-heading font-black text-xs uppercase neo-shadow-hard hover:bg-[#E41E26] transition-all">
                ALL_PROPOSALS
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {isLoading ? (
              <div className="col-span-3 text-center py-20 font-mono animate-pulse">FETCHING_BLOCKCHAIN_STATE...</div>
            ) : topProposals.length > 0 ? (
              topProposals.map((p) => (
                <ProposalCard key={p.id} {...p} />
              ))
            ) : (
              <div className="col-span-3 text-center py-20 font-mono opacity-40">NO_ACTIVE_PROPOSALS_FOUND</div>
            )}
          </div>
        </div>
      </section>

      {/* PROTOCOL STEPS */}
      <section className="py-32 px-6 lg:px-20 border-t-[4px] border-black bg-[#fafafa]">
        <div className="container max-w-7xl mx-auto">
          <h2 className="font-heading font-black text-4xl mb-20 uppercase tracking-tighter">System Protocol</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 border-[4px] border-black neo-shadow-hard bg-white">
            {[
              { num: "01", label: "CAST", desc: "You vote. Direction is encrypted using Zama fhEVM." },
              { num: "02", label: "ACCUMULATE", desc: "Your vote accumulates into an encrypted tally." },
              { num: "03", label: "SEAL", desc: "Nobody sees the tally during voting." },
              { num: "04", label: "REVEAL", desc: "At end, Gateway decrypts the final count." },
              { num: "05", label: "EXECUTE", desc: "Result executes automatically." },
            ].map((step, i) => (
              <div key={i} className={`p-8 ${i !== 4 ? 'md:border-r-[4px]' : ''} border-b-[4px] md:border-b-0 border-black hover:bg-black hover:text-white transition-all group`}>
                <div className="font-mono text-lg font-black mb-6 text-[#E41E26] group-hover:text-white">{step.num}</div>
                <h4 className="font-heading font-black text-xl mb-4 uppercase leading-none">{step.label}</h4>
                <p className="font-sans text-xs font-bold opacity-60 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-24 px-6 lg:px-20 border-t-[4px] border-black bg-white">
        <div className="container max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="font-heading font-black text-3xl">SEAL<span className="text-[#E41E26]">FI.</span></div>
          <div className="flex gap-12 font-mono text-[10px] font-black uppercase tracking-[0.3rem]">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#E41E26]">Twitter</a>
            <a href="https://github.com/Narayanan-D-05/Sealfi" target="_blank" rel="noopener noreferrer" className="hover:text-[#E41E26]">Github</a>
            <a href="/doc.md" className="hover:text-[#E41E26]">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
