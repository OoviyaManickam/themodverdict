export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
  targetId: string | null;
  targetType: 'post' | 'comment' | null;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type ModHistoryEntry = {
  action: string;
  date: string;
  description: string;
  mod: string;
};

export type ReporterSignal = {
  username: string;
  totalReports: number;
  actionedReports: number;
  accuracyRate: number;
};

export type UserSignals = {
  username: string;
  accountAgeDays: number;
  isFirstPost: boolean;
  recentPostCount: number;
  recentRemovalCount: number;
  recentApprovalCount: number;
  removalRate: number;
  postingAccelerating: boolean;
  uniqueDomains: string[];
};

export type VerdictSummary = {
  riskLevel: 'low' | 'medium' | 'high';
  riskReason: string;
  plainEnglish: string;
};

export type VerdictData = {
  targetId: string;
  targetType: 'post' | 'comment';
  targetContent: string;
  reportReasons: string[];
  reporters: ReporterSignal[];
  userSignals: UserSignals;
  modHistory: ModHistoryEntry[];
  summary: VerdictSummary;
};

export type VerdictResponse = {
  type: 'verdict';
  data: VerdictData;
};

export type VerdictActionRequest = {
  targetId: string;
  action: 'approve' | 'remove' | 'ban' | 'mute';
  banDays?: number;
  note?: string;
};

export type VerdictActionResponse = {
  type: 'action';
  success: boolean;
  message: string;
};
