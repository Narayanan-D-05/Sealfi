"use client";

import { useState, useCallback, useEffect } from "react";
import { createInstance, type FhevmInstance } from "fhevmjs";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";

export type VoteDirection = "for" | "against" | "abstain";
export type SealingState = "idle" | "initializing" | "sealing" | "submitting" | "confirmed" | "error";

// externalEuint8 structure: [ciphertext, proof]
export type ExternalEuint8 = {
  ciphertext: `0x${string}`;
  proof: `0x${string}`;
};

export function useVote() {
  const [selectedVote, setSelectedVote] = useState<VoteDirection | null>(null);
  const [sealingState, setSealingState] = useState<SealingState>("idle");
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  // Initialize fhevmjs instance with dynamic public key
  useEffect(() => {
    const initFhevm = async () => {
      if (!publicClient) return;
      
      try {
        setSealingState("initializing");
        console.log("[fhevmjs] Initializing WASM module...");
        
        // Create instance - fhevmjs 0.6.x fetches public key from provider automatically
        const fhevmInstance = await createInstance({
          chainId: sepolia.id,
          publicRpc: process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
          gatewayRpc: process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.sepolia.zama.ai",
        });
        
        console.log("[fhevmjs] Instance created, public key synced");
        setInstance(fhevmInstance);
        setSealingState("idle");
      } catch (err) {
        console.error("[fhevmjs] Initialization failed:", err);
        setError("Failed to initialize encryption module");
        setSealingState("error");
      }
    };

    initFhevm();
  }, [publicClient]);

  const getVoteValue = useCallback((direction: VoteDirection): number => {
    switch (direction) {
      case "against": return 0;
      case "for": return 1;
      case "abstain": return 2;
      default: return 1;
    }
  }, []);

  // Encrypt vote using fhevmjs - returns externalEuint8 structure
  const encryptVote = useCallback(async (
    direction: VoteDirection
  ): Promise<ExternalEuint8 | null> => {
    if (!instance) {
      setError("Encryption module not initialized");
      return null;
    }

    try {
      setSealingState("sealing");
      console.log("[fhevmjs] SEALING VOTE...", direction);

      const voteValue = getVoteValue(direction);
      
      // Encrypt the vote value (0, 1, or 2)
      // fhevmjs 0.6.x: encrypt8 returns { ciphertext, proof }
      const encryptionResult = await instance.encrypt8(BigInt(voteValue));
      
      console.log("[fhevmjs] Vote sealed:", {
        ciphertext: encryptionResult.ciphertext.slice(0, 20) + "...",
        proof: encryptionResult.proof.slice(0, 20) + "...",
      });

      return {
        ciphertext: encryptionResult.ciphertext as `0x${string}`,
        proof: encryptionResult.proof as `0x${string}`,
      };
    } catch (err) {
      console.error("[fhevmjs] Encryption failed:", err);
      setError("Failed to seal vote");
      setSealingState("error");
      return null;
    }
  }, [instance, getVoteValue]);

  const selectVote = useCallback((direction: VoteDirection) => {
    setSelectedVote(direction);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setSelectedVote(null);
    setSealingState("idle");
    setError(null);
  }, []);

  // Helper to format sealing state for UI
  const getSealingMessage = useCallback((): string => {
    switch (sealingState) {
      case "initializing":
        return "INITIALIZING ENCRYPTION...";
      case "sealing":
        return "SEALING VOTE...";
      case "submitting":
        return "DEPOSITING INTO ENVELOPE...";
      case "confirmed":
        return "VOTE SEALED";
      case "error":
        return "ERROR - TRY AGAIN";
      default:
        return "";
    }
  }, [sealingState]);

  return {
    selectedVote,
    selectVote,
    sealingState,
    setSealingState,
    getSealingMessage,
    encryptVote,
    instance,
    error,
    reset,
    canSubmit: selectedVote !== null && sealingState === "idle" && !error,
    isReady: instance !== null,
  };
}
