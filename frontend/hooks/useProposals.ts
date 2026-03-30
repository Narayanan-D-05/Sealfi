export enum ProposalState {
  PENDING = 0,
  ACTIVE = 1,
  TALLYING = 2,
  SUCCEEDED = 3,
  DEFEATED = 4,
  EXECUTED = 5,
}

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  target: string;
  callData: string;
  voteStart: number;
  voteEnd: number;
  state: ProposalState;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  tallyRequested: boolean;
  executed: boolean;
}
