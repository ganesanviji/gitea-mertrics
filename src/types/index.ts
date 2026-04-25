// Gitea API types
export interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
  created: string;
}

export interface GiteaCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    added: number;
    deleted: number;
  };
  author: GiteaUser | null;
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: GiteaUser;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged: boolean;
  review_comments: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: Array<{ name: string; color: string }>;
}

export interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GiteaUser;
  description: string;
  private: boolean;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  created: string;
  updated: string;
}

export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: GiteaUser;
  created_at: string;
  closed_at: string | null;
  comments: number;
}

export interface GiteaReview {
  id: number;
  user: GiteaUser;
  body: string;
  state: 'APPROVED' | 'REQUEST_CHANGES' | 'COMMENT' | 'PENDING';
  submitted_at: string;
}

/** A PR with the source repo attached, stored per-engineer */
export interface EngineerPREntry {
  pr: GiteaPullRequest;
  repoKey: string; // "owner/repo"
}

/** A commit with the source repo attached, stored per-engineer */
export interface EngineerCommitEntry {
  commit: GiteaCommit;
  repoKey: string; // "owner/repo"
}

/** PR classification derived from labels + title heuristics */
export type PrType = 'feature' | 'bug' | 'chore' | 'docs' | 'refactor' | 'test' | 'other';

export const PR_TYPE_COLORS: Record<PrType, string> = {
  feature: '#22c55e',
  bug:     '#ef4444',
  chore:   '#94a3b8',
  docs:    '#60a5fa',
  refactor:'#a78bfa',
  test:    '#f59e0b',
  other:   '#475569',
};

export const PR_TYPE_LABELS_MAP: Record<PrType, string[]> = {
  feature:  ['feature', 'feat', 'enhancement', 'new feature', 'feature request'],
  bug:      ['bug', 'fix', 'hotfix', 'bugfix', 'defect', 'patch'],
  chore:    ['chore', 'maintenance', 'deps', 'dependencies', 'ci', 'build', 'release'],
  docs:     ['docs', 'documentation', 'doc'],
  refactor: ['refactor', 'refactoring', 'cleanup', 'clean-up', 'technical debt'],
  test:     ['test', 'tests', 'testing', 'coverage'],
  other:    [],
};

export const EMPTY_PR_BY_TYPE: Record<PrType, number> = {
  feature: 0, bug: 0, chore: 0, docs: 0, refactor: 0, test: 0, other: 0,
};

// Analytics types
export interface DailyActivity {
  date: string; // YYYY-MM-DD
  commits: number;
  additions: number;
  deletions: number;
  prs: number;
}

export interface EngineerStats {
  user: GiteaUser;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  reviewsGiven: number;
  avgPRMergeTimeHours: number;
  activeDays: number;
  commitStreak: number;
  longestStreak: number;
  dailyActivity: DailyActivity[];
  weeklyCommits: number[];
  reposContributed: string[];
  /** Number of PRs that carry the configured AI-IDE label (default: cs_used) */
  csAiUsageCount: number;
  /** PR count broken down by classified type */
  prsByType: Record<PrType, number>;
  /** Full PR objects for this engineer (created within the selected date range) */
  prs: EngineerPREntry[];
  /** Full commit objects for this engineer (within the selected date range) */
  commits: EngineerCommitEntry[];
  score: number;
  rank: number;
}

export interface TeamStats {
  engineers: EngineerStats[];
  totalCommits: number;
  totalPRs: number;
  totalMergedPRs: number;
  activePeriod: { start: string; end: string };
  mostActiveDay: string;
  topContributor: EngineerStats | null;
  /** Total PRs across the whole team that carry the AI-IDE label */
  totalCsAiUsage: number;
  /** Team-wide PR type breakdown */
  teamPrsByType: Record<PrType, number>;
  /** All org members (contributors + non-contributors) — populated when orgName is configured */
  allMembers: GiteaUser[];
  /** All repos in the org — populated when orgName is configured */
  availableRepos: string[]; // "owner/repo"
}

export interface AppSettings {
  giteaUrl: string;
  token: string;
  /** Gitea organisation name — used to fetch all members and auto-discover repos */
  orgName: string;
  repos: string[]; // format: "owner/repo" — leave empty to auto-use all org repos
  /**
   * Gitea usernames of team members to track even if they have no commits/PRs.
   * These are merged with org members for non-contributor detection.
   */
  teamMembers: string[];
  dateRange: '7d' | '30d' | '90d' | '180d' | '1y';
  /** Label name used to flag AI-IDE-assisted PRs. Defaults to 'cs_used'. */
  csAiLabel: string;
  scoringWeights: {
    commits: number;
    additions: number;
    prsCreated: number;
    prsMerged: number;
    reviewsGiven: number;
    activeDays: number;
    /** Bonus per PR carrying the AI-IDE label */
    csAiUsage: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  giteaUrl: '',
  token: '',
  orgName: '',
  repos: [],
  teamMembers: [],
  dateRange: '30d',
  csAiLabel: 'cs_used',
  scoringWeights: {
    commits: 3,
    additions: 0.01,
    prsCreated: 5,
    prsMerged: 8,
    reviewsGiven: 4,
    activeDays: 2,
    csAiUsage: 6,
  },
};
