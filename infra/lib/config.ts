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
  github: { owner: 'Tyler-Jacob-F', repo: 'Tyler-personal', deployBranch: 'main' },
  billing: { alarmEmail: 'tyler.fuqua+aws@icloud.com', monthlyLimitUsd: 5 },
  /** Fixed so the account stack can grant CI access to it without a cross-stack reference. */
  siteBucketName: 'the-keep-site-697941679713',
} as const;
