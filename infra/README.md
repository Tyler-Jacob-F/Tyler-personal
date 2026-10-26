# infra

AWS CDK (TypeScript) for The Keep. Local sessions run `synth`, `diff` and tests only;
`cdk deploy` happens from `main` through GitHub Actions. The two exceptions below are
one-time account setup, run by Tyler with admin credentials for the account.

## Stacks

| Stack            | What                                                                | Deployed by          |
| ---------------- | ------------------------------------------------------------------- | -------------------- |
| `TheKeepAccount` | GitHub OIDC provider, PR (read-only) and deploy roles, $5 budget    | Tyler, once, locally |
| `TheKeepSite`    | S3 bucket, CloudFront, SPA rewrite function, ACM cert, Route 53 DNS | GitHub Actions       |

Names, the account ID and the domain live in `lib/config.ts`.

## One-time setup

Prerequisites on your machine: Node 22, pnpm, the AWS CLI, and a profile with admin
rights in account `697941679713` (an IAM user or Identity Center user, not root).

```sh
export AWS_PROFILE=the-keep        # or whatever you named it
aws sts get-caller-identity        # confirm: Account 697941679713
pnpm install
```

### 1. Bootstrap CDK

Creates the bucket and roles CDK deploys through. Once per account and region.

```sh
pnpm -C infra cdk bootstrap aws://697941679713/us-east-1
```

### 2. Deploy the account stack

GitHub Actions cannot assume a role that does not exist yet, so this one stack is deployed
from your machine. Everything after it goes through CI.

```sh
pnpm -C infra cdk deploy TheKeepAccount
```

Copy the two role ARNs it prints into the repository's GitHub Actions variables
(Settings → Secrets and variables → Actions → Variables):

| Variable              | Value                       |
| --------------------- | --------------------------- |
| `AWS_PR_ROLE_ARN`     | `PullRequestRoleArn` output |
| `AWS_DEPLOY_ROLE_ARN` | `DeployRoleArn` output      |

Then merge to `main`. The deploy workflow creates `TheKeepSite` and publishes the SPA.
The first run takes a few minutes while ACM validates the certificate through DNS.

### Optional: cache the hosted zone lookup

`SiteStack` looks up the Route 53 zone at synth time. Running a synth locally once writes
the answer to `infra/cdk.context.json`; commit that file so CI does not need the lookup.

```sh
pnpm -C infra synth
git add infra/cdk.context.json
```

## Everyday

```sh
pnpm -C infra test          # snapshot + assertion tests
pnpm -C infra test:update   # after an intentional template change
pnpm -C infra synth
pnpm -C infra diff          # needs AWS credentials
```
