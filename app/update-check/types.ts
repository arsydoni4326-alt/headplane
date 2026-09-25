export interface UpdateCheckResult {
  /** Short commit hash of the current build (e.g. "a1b2c3d") */
  currentCommit: string;
  /** Short commit hash of the remote main branch */
  remoteCommit: string;
  /** URL to the remote repository commits page */
  repoUrl: string;
  /** Human-readable project name */
  projectName: string;
}

export interface VersionInfo {
  headplaneCommit: string;
  headplaneVersion: string;
  headscaleVersion: string;
  /** Base URL of the headscale server (e.g. "https://headscale.example.com") */
  headscaleBaseUrl: string;
}

export interface UpdateCheckState {
  isChecking: boolean;
  headplaneUpdate: UpdateCheckResult | null;
  headscaleUpdate: UpdateCheckResult | null;
  error: string | null;
}