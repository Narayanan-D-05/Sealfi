"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Settings, Shield as ShieldIcon, Zap, Coins } from "lucide-react";
import { useToken } from "@/hooks/useToken";
import { useState, useEffect } from "react";

export function LandingNav() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { votes, balance, effectiveVotes, delegate, mint, refetch } = useToken();
  const [isActivating, setIsActivating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const connectWallet = () => {
    // Default to the first connector (usually injected/MetaMask)
    if (connectors && connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      console.warn("No connectors found. Is a wallet injected?");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="sticky top-0 z-50 py-4 px-6 lg:px-12 bg-white border-b-[4px] border-black">
      <div className="container max-w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-[#E41E26] p-2 neo-border-thick transition-transform group-hover:rotate-12">
            <ShieldIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-black text-2xl tracking-tighter text-black uppercase">
            SEAL<span className="text-[#E41E26]">FI</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {["PROPOSALS", "VOTE", "GOV"].map((item) => (
            <Link 
              key={item} 
              href={`/${item.toLowerCase()}`}
              className="font-mono text-[11px] font-black text-black hover:text-[#E41E26] transition-colors tracking-widest"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {mounted && isConnected && (
            <div className="hidden lg:flex items-center gap-2 mr-4">
              {votes === BigInt(0) && balance > BigInt(0) && (
                <button
                  onClick={async () => {
                    setIsActivating(true);
                    try { await delegate(); } catch (e) {}
                    setIsActivating(false);
                  }}
                  disabled={isActivating}
                  className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 border-[3px] border-black font-heading font-black text-[10px] uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                >
                  <Zap className="w-3 h-3" />
                  {isActivating ? "ACTIVATING..." : "ACTIVATE_VOTING"}
                </button>
              )}
              {balance === BigInt(0) && (
                <button
                  onClick={async () => {
                    setIsMinting(true);
                    try { await mint(); } catch (e) {}
                    setIsMinting(false);
                  }}
                  disabled={isMinting}
                  className="flex items-center gap-2 bg-blue-400 text-black px-4 py-2 border-[3px] border-black font-heading font-black text-[10px] uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                >
                  <Coins className="w-3 h-3" />
                  {isMinting ? "MINTING..." : "GET_TEST_TOKENS"}
                </button>
              )}
              {votes > BigInt(0) && (
                <div className="flex flex-col items-end mr-4 leading-none">
                  <span className="font-mono text-[8px] text-black/40 uppercase font-black mb-1 tracking-tighter">QUAD_POWER</span>
                  <span className="font-heading font-black text-xs text-[#E41E26] uppercase">
                    {(Number(effectiveVotes) / 1e18).toFixed(1)} SEAL
                  </span>
                </div>
              )}
            </div>
          )}

          {(!mounted || !isConnected) ? (
            <button 
              onClick={connectWallet}
              className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-full font-heading font-black text-[10px] uppercase neo-shadow-hard hover:bg-[#E41E26] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              CONNECT_WALLET
            </button>
          ) : (
            <button 
              onClick={() => disconnect()}
              className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-full font-heading font-black text-[10px] uppercase neo-shadow-hard hover:bg-[#E41E26] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {formatAddress(address!)}
            </button>
          )}
          
          <button className="p-2.5 bg-white neo-border-thick rounded-full hover:bg-black group transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Settings className="w-4 h-4 text-black group-hover:text-white" />
          </button>
        </div>
      </div>
    </nav>
  );
}
