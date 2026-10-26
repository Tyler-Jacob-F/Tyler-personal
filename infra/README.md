# infra

AWS CDK (TypeScript) for The Keep. Local sessions run `synth`, `diff` and tests only;
`cdk deploy` happens from `main` through GitHub Actions. The two exceptions below are
one-time account setup, run by Tyler with admin credentials for the account.

## Stacks

| Stack            | What                                                                             | Deployed by          |
| ---------------- | -------------------------------------------------------------------------------- | -------------------- |
| `TheKeepAccount` | GitHub OIDC provider, PR (read-only) and deploy roles, $5 budget                 | Tyler, once, locally |
| `TheKeepData`    | Aurora Serverless v2 (PostgreSQL, 0–2 ACU) with the Data API, secret, SSM params | GitHub Actions       |
| `TheKeepAuth`    | Cognito user pool, admin user, custom-auth trigger Lambdas, SES identities       | GitHub Actions       |
| `TheKeepApi`     | HTTP API with a Cognito JWT authorizer, one Lambda per resource, dashboard       | GitHub Actions       |
| `TheKeepSite`    | S3 bucket, CloudFront (with `/api/*` to the API), SPA rewrite, ACM, Route 53     | GitHub Actions       |

Deploy order follows the dependencies: Data and Auth, then Api, then Site. After the
stacks, the workflow applies pending migrations from `apps/api/migrations` through the Data
API, builds the SPA with the Cognito ids from stack outputs, and publishes it.

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

### Cached lookups

The site and auth stacks look up the Route 53 zone, and the VPC in the data stack checks
its availability zones against the account's list. Both answers live in
`infra/cdk.context.json` so synth, `cdk diff` and tests need no AWS calls. If the account's
AZ list ever changes, edit that file by hand or run a synth with credentials.

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
