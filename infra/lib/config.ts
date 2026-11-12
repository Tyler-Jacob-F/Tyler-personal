/**
 * Everything that names this deployment. Account IDs and domain names are not secrets;
 * credentials never appear here (CLAUDE.md).
 */
export const config = {
  siteName: 'The Keep',
  /** Prefix for stack names and any resource that must be globally unique. */
  stackPrefix: 'TheKeep',
  domainName: 'tylerfuqua.com',
  env: { account: '697941679713', region: 'us-east-1' },
  github: {
    owner: 'Tyler-Jacob-F',
    repo: 'Tyler-personal',
    /** Numeric IDs: GitHub's OIDC subject is now repo:<owner>@<ownerId>/<repo>@<repoId>:... */
    ownerId: 94389834,
    repoId: 1434551882,
    deployBranch: 'main',
  },
  billing: { alarmEmail: 'tyler.fuqua+aws@icloud.com', monthlyLimitUsd: 5 },
  /** Fixed so the account stack can grant CI access to it without a cross-stack reference. */
  siteBucketName: 'the-keep-site-697941679713',
  /** Fixed names so later stacks can grant the CI roles access without a cross-stack reference. */
  roles: { deploy: 'TheKeep-GitHubDeploy', pullRequest: 'TheKeep-GitHubPullRequest' },
  /** Exactly one admin (docs/phases/01-spine.md). Pre-created in Cognito and `member` by code. */
  admin: { email: 'tyler.fuqua@icloud.com', displayName: 'Tyler' },
  database: { name: 'thekeep', ssmPrefix: '/the-keep/db' },
  /**
   * The licensed translations (docs/runbooks/scripture-keys.md). The keys are SecureString
   * parameters under the prefix, put there by hand, never by CDK; the passages Lambda reads
   * them. `apiBibleIds` are API.Bible's ids for the translations it serves.
   */
  scripture: {
    ssmPrefix: '/the-keep/scripture',
    esvKeyParameter: '/the-keep/scripture/esv-key',
    apiBibleKeyParameter: '/the-keep/scripture/api-bible-key',
    apiBibleIds: { niv: '78a9f6124f344018-01' },
  },
  /** Sign-in code defaults, flagged in docs/phases/01-spine.md "Ask versus decide". */
  auth: { codeTtlMinutes: 10, maxAttempts: 3 },
  /** SES: the domain identity, its MAIL FROM subdomain, and the address codes come from. */
  email: { sender: 'keep@tylerfuqua.com', mailFromDomain: 'mail.tylerfuqua.com' },
} as const;
