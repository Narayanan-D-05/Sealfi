"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowUpRight } from "lucide-react";
import { SealedValue } from "./SealedValue";
import { cn } from "@/lib/utils";

export interface Proposal {
  id: string;
  title: string;
  proposer: string;
  voteStart: number;
  voteEnd: number;
  state: "ACTIVE" | "PASSED" | "FAILED" | "PENDING" | "EXECUTED" | "SUCCEEDED" | "DEFEATED";
  forVotes?: number;
  againstVotes?: number;
  abstainVotes?: number;
  voterCount: number;
}

interface ProposalCardProps {
  id?: string;
  title: string;
  status: "ACTIVE" | "PASSED" | "FAILED" | "PENDING";
  description: string;
  votes: string;
  timeLeft: string;
  category: string;
  color?: string;
  className?: string;
}

export function ProposalCard({ id = "0000", title, status, description, votes, timeLeft, category, color = "#E41E26", className }: ProposalCardProps) {
  const safeId = id ? id.toString().padStart(4, '0') : "0000";
  const isActive = status === "ACTIVE";

  return (
    <motion.div 
      whileHover={{ y: -8, x: 2 }}
      className={cn("bg-white neo-border-thick rounded-[24px] overflow-hidden neo-shadow-hard transition-all h-full flex flex-col hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]", className)}
    >
      <div 
        className="p-4 border-b-[3px] border-black flex justify-between items-center"
        style={{ backgroundColor: color }}
      >
        <span className="font-mono text-[10px] font-black text-black bg-white px-2 py-0.5 rounded-full border-[2px] border-black uppercase">
          ID_{safeId}
        </span>
        <Badge className="bg-black text-white hover:bg-black font-heading font-black text-[9px] px-3 border-none">
          {status}
        </Badge>
      </div>

      <div className="p-5 flex-1 flex flex-col bg-white">
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-[9px] font-bold text-black opacity-60 uppercase tracking-widest">{category}</span>
          <ArrowUpRight className="w-4 h-4 text-black opacity-30" />
        </div>
        
        <h3 className="font-heading font-black text-lg leading-[1.1] mb-3 text-black uppercase tracking-tight">{title}</h3>
        <p className="font-sans text-[11px] text-black/70 line-clamp-2 mb-6 flex-1 italic font-medium leading-relaxed">"{description}"</p>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t-[2px] border-black border-dashed">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-black rounded-lg"><Users className="w-3 h-3 text-white" /></div>
            <div className="flex flex-col">
              <span className="font-mono text-[8px] font-bold opacity-50 uppercase leading-none">Voting</span>
              <SealedValue value={votes} isSealed={isActive} className="font-heading font-black text-[11px] text-black animate-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white border-[2px] border-black rounded-lg"><Clock className="w-3 h-3 text-black" /></div>
            <div className="flex flex-col">
              <span className="font-mono text-[8px] font-bold opacity-50 uppercase leading-none">Remains</span>
              <span className="font-heading font-black text-[11px]">{timeLeft}</span>
            </div>
          </div>
        </div>
      </div>

      <button className="w-full py-4 font-heading font-black text-[11px] uppercase tracking-tighter bg-black text-white hover:bg-[#E41E26] transition-all border-t-[3px] border-black">
        OPEN_SECURE_ENCLAVE
      </button>
    </motion.div>
  );
}
