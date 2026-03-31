"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlusCircle, Info, FileText, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useCreateProposal } from "@/hooks/useGovernor";
import { useToken } from "@/hooks/useToken";
import Link from "next/link";

export default function GovPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const { createProposal, isPending } = useCreateProposal();
  const { votes, balance } = useToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || isPending) return;

    try {
      await createProposal(description);
      setIsSuccess(true);
      setDescription("");
      // Redirect to proposals after delay
      setTimeout(() => router.push("/proposals"), 3000);
    } catch (err) {
      console.error("Failed to create proposal:", err);
    }
  };

  return (
    <div className="container px-6 lg:px-12 py-20 max-w-full min-h-screen bg-white">
      <div className="flex flex-col gap-16">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs text-[#888888] uppercase tracking-[0.4em]">GOVERNANCE_LABS_v2</span>
            <h1 className="text-6xl font-heading font-black tracking-tighter uppercase leading-[0.9] text-black">
              CREATE_NEW_<span className="text-primary">PROPOSAL</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 bg-[#fafafa] p-4 neo-border-thick font-mono text-[9px] font-black uppercase">
            <Info className="w-4 h-4 text-primary" />
            <span>PROTOCOL_DELAY: ~15-30 SECONDS (TALLY)</span>
          </div>
        </div>

        {/* FORM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-end">
                   <div className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-primary" />
                     <label className="font-heading font-black text-xs uppercase tracking-widest text-black">
                       PROPOSAL_SPECIFICATION_MARKDOWN
                     </label>
                   </div>
                   <span className="font-mono text-[10px] text-black/40 font-black uppercase">
                     {description.length} / 2000 CHARS
                   </span>
                </div>
                
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter the proposal details, goals, and execution parameters..."
                  className="w-full h-80 bg-white p-10 neo-border-thick neo-shadow-hard font-heading font-bold text-xl uppercase italic focus:outline-none focus:bg-primary/5 transition-all placeholder:text-black/10"
                />
              </div>

              <div className="flex flex-col gap-8">
                <div className="p-8 bg-[#fafafa] border-[3px] border-black flex flex-col gap-4">
                   <h4 className="font-heading font-black text-xs uppercase tracking-tighter">PRE_FLIGHT_CHECKLIST</h4>
                   <ul className="space-y-3 font-mono text-[10px] font-black uppercase">
                     <li className={cn("flex items-center gap-3", votes > BigInt(0) ? "text-green-600" : "text-primary")}>
                       <CheckCircle2 className="w-4 h-4" /> {votes > BigInt(0) ? "VOTES_ACTIVATED" : "ZERO_VOTING_POWER_DETECTED"}
                     </li>
                     <li className={cn("flex items-center gap-3", balance > BigInt(0) ? "text-green-600" : "text-primary")}>
                       <CheckCircle2 className="w-4 h-4" /> {balance > BigInt(0) ? "TOKEN_RESERVES_DETECTED" : "NO_TOKENS_FOUND"}
                     </li>
                     <li className="flex items-center gap-3 opacity-40"><div className="w-4 h-4 rounded-full border-2 border-black" /> NETWORK_FEES_READY</li>
                   </ul>
                </div>

                {isSuccess ? (
                  <div className="p-8 bg-green-50 border-[3px] border-green-600 text-center font-heading font-black text-green-600 uppercase flex flex-col gap-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
                    <span>PROPOSAL_SUBMITTED_SUCCESSFULLY</span>
                    <span className="text-[10px] opacity-60">REDIRECTING_TO_REGISTRY...</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!description || isPending}
                    className={cn(
                      "group w-full py-8 font-heading font-black text-2xl uppercase tracking-tighter transition-all",
                      (!description || isPending)
                        ? "bg-black/10 text-black/20 border-black/10 neo-border-thick cursor-not-allowed"
                        : "bg-black text-white neo-shadow-hard hover:bg-primary hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-x-2 active:translate-y-2"
                    )}
                  >
                    {isPending ? (
                      <div className="flex items-center justify-center gap-4">
                        <Loader2 className="w-6 h-6 animate-spin" /> BROADCASTING...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-4">
                        PUBLISH_PROPOSAL <Send className="w-6 h-6 rotate-[-45deg] group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
                      </div>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="bg-primary text-white p-10 neo-border-thick neo-shadow-hard flex flex-col gap-6">
               <h3 className="font-heading font-black text-sm uppercase tracking-widest bg-black text-white inline-block px-4 py-1 self-start">IMPORTANT_NOTICE</h3>
               <p className="font-heading font-bold text-lg leading-tight uppercase italic">
                 Once published, a proposal cannot be modified. <br/><br/> Ensure all parameters and the description provided are accurate before broadcasting to the network.
               </p>
               <div className="h-px bg-white/20 w-full" />
               <div className="flex flex-col gap-2 font-mono text-[9px] font-black uppercase opacity-60">
                 <span>TX_TYPE: GOVERNANCE_PROPOSAL</span>
                 <span>GAS_EST: HIGH_PRIORITY</span>
               </div>
            </div>

            <div className="bg-white neo-border-thick p-8 flex flex-col gap-4">
               <span className="font-mono text-[9px] font-black uppercase text-black/40">COMMUNITY_RESOURCES</span>
               <div className="flex flex-col gap-3 font-heading font-black text-[11px] uppercase">
                 <Link href="#" className="hover:text-primary underline">PROPOSAL_TEMPLATE.md</Link>
                 <Link href="#" className="hover:text-primary underline">GOVERNANCE_RULES</Link>
                 <Link href="#" className="hover:text-primary underline">DAO_CONSTITUTION</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
