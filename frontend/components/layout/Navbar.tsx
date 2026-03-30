"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Link } from "next/link";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="font-grotesk font-bold text-xl tracking-tight">
            SEALFI
          </a>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="/proposals"
              className="font-grotesk text-sm uppercase tracking-wider text-gray hover:text-white transition-colors"
            >
              Proposals
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-gray">
                {formatAddress(address!)}
              </span>
              <button
                onClick={() => disconnect()}
                className="border border-gray-border px-4 py-2 font-grotesk text-xs uppercase tracking-wider hover:border-yellow hover:text-yellow transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="bg-yellow text-black px-6 py-2 font-grotesk font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
