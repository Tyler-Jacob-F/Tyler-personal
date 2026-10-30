/**
 * The content of the Stack page: what each piece of the system is, why it is there, what it
 * costs, where to find it, and the request traces. Written against the repo after Phase 1.
 */
export interface NodeInfo {
  kicker: string;
  title: string;
  what: string;
  why: string;
  cost: string;
  where: string;
}

export interface TraceStep {
  text: string;
  nodes: string[];
  edges: string[];
}

export interface Trace {
  title: string;
  steps: TraceStep[];
}

export const NODES: Record<string, NodeInfo> = {
  browser: {
    kicker: 'Outside AWS',
    title: 'Your browser',
    what: 'The React SPA served from S3 through CloudFront. It talks to Cognito directly to sign in and to the API through the same domain it loaded from, so there is no CORS.',
    why: 'The brief chose a static SPA so there is no web server to run or patch. The refresh token is remembered in the browser so a reload restores the session; the id and access tokens stay in memory.',
    cost: 'Nothing.',
    where: 'apps/web · tylerfuqua.com',
  },
  github: {
    kicker: 'Outside AWS',
    title: 'GitHub Actions',
    what: 'Two workflows. Pull requests run tests, lint, typecheck and a read-only cdk diff posted as a comment. A merge to main runs tests, assumes the deploy role, deploys the four application stacks, applies pending migrations, builds the SPA with the Cognito ids from the stack outputs, syncs it to S3 and invalidates CloudFront.',
    why: 'Deploys happen only from main, through CI, so there is one path to production and it is recorded. No one runs cdk deploy from a laptop.',
    cost: 'Free for a public or small private repo at this volume.',
    where:
      '.github/workflows/pr.yml · .github/workflows/deploy.yml\nRepository Settings → Actions → Variables: AWS_PR_ROLE_ARN, AWS_DEPLOY_ROLE_ARN',
  },
  route53: {
    kicker: 'TheKeepSite',
    title: 'Route 53 hosted zone',
    what: 'DNS for tylerfuqua.com. Holds the alias records that point the apex and www at CloudFront, the CNAME that proved you own the domain to ACM, and the DKIM and MAIL FROM records SES needs so your sign-in emails are trusted.',
    why: 'The domain was registered in Route 53, so the zone, certificate validation and alias records all live in one place CDK can write to.',
    cost: '$0.50 a month for the zone, plus fractions of a cent per million queries.',
    where:
      'Route 53 → Hosted zones → tylerfuqua.com\ninfra/lib/site-stack.ts · infra/lib/auth-stack.ts',
  },
  cloudfront: {
    kicker: 'TheKeepSite',
    title: 'CloudFront distribution',
    what: 'The single origin your browser, and every agent, ever talks to. It terminates TLS at an edge near the visitor, serves the SPA from S3 with hashed assets cached for a year and index.html never cached, and forwards anything under /api/* or at /mcp to API Gateway with caching disabled and every viewer header except Host passed through, so the Authorization bearer arrives.',
    why: 'One domain for the page and the API means no CORS and one certificate. The brief calls it "CloudFront is the single origin."',
    cost: 'The first terabyte out per month is free; you will not approach it.',
    where: 'CloudFront → Distributions → "The Keep (tylerfuqua.com)"\ninfra/lib/site-stack.ts',
  },
  cffunction: {
    kicker: 'TheKeepSite',
    title: 'SPA rewrite function',
    what: 'A ten-line JavaScript function that runs at the edge on every viewer request to the default behavior. A path with no file extension becomes /index.html, so React Router owns URLs like /recipes/abc without S3 returning a 404.',
    why: 'The alternative, S3 error-document tricks, returns the wrong status codes. A CloudFront Function is the clean way and costs nothing at this volume.',
    cost: 'Two million invocations a month are free.',
    where: 'CloudFront → Functions\ninfra/lib/site-stack.ts, the inline code near the top',
  },
  s3: {
    kicker: 'TheKeepSite',
    title: 'Site bucket',
    what: 'A private bucket holding the built SPA. Only CloudFront can read it, through an origin access control; the bucket blocks all public access. The deploy syncs it twice: assets/* with a one-year immutable cache header, then the root files with no-cache.',
    why: "The double sync is the brief's own recipe: hashed filenames can be cached forever, index.html must not be, so a deploy is visible on the next request.",
    cost: 'A few cents for a few megabytes.',
    where: 'S3 → the-keep-site-697941679713\ninfra/lib/site-stack.ts · deploy.yml "Publish" steps',
  },
  acm: {
    kicker: 'TheKeepSite',
    title: 'ACM certificate',
    what: 'The TLS certificate for tylerfuqua.com and www. ACM issued it after CDK wrote a validation record into Route 53, and it renews itself.',
    why: 'CloudFront requires the certificate to live in us-east-1, which is why the whole project is in that region: no cross-region wiring.',
    cost: 'Free.',
    where: 'Certificate Manager (us-east-1)\ninfra/lib/site-stack.ts',
  },
  oidc: {
    kicker: 'TheKeepAccount',
    title: 'GitHub OIDC provider',
    what: "An identity provider record that tells AWS to trust tokens signed by token.actions.githubusercontent.com. When a workflow runs, GitHub mints a short-lived JWT whose subject names the repository and branch; AWS STS verifies it against GitHub's public keys before issuing any credentials.",
    why: 'No long-lived AWS keys anywhere. GitHub never stores a secret; it proves who it is on every run. The trust policy accepts only this repository, by name and by numeric id, and only main for the deploy role.',
    cost: 'Free.',
    where: 'IAM → Identity providers\ninfra/lib/account-stack.ts',
  },
  roles: {
    kicker: 'TheKeepAccount',
    title: 'Deploy role and PR role',
    what: 'Two IAM roles GitHub may assume for one hour. The PR role can only assume the CDK lookup role, enough for cdk diff. The deploy role can assume the CDK bootstrap roles, read stack outputs, write the site bucket, invalidate CloudFront, and run SQL through the Data API for migrations. Neither can create a database or a role; CloudFormation does that with its own execution role.',
    why: 'Least privilege at the boundary that faces the internet. A compromised workflow could republish the SPA; it could not reshape the account.',
    cost: 'Free.',
    where:
      'IAM → Roles → TheKeep-GitHubDeploy, TheKeep-GitHubPullRequest\ninfra/lib/account-stack.ts',
  },
  budget: {
    kicker: 'TheKeepAccount',
    title: 'Monthly budget',
    what: 'An AWS Budgets guard at $5 that emails you when actual or forecast spend crosses it.',
    why: '"Budget is a feature." Budgets needs no billing-alerts toggle, unlike a CloudWatch EstimatedCharges alarm, so it was the first resource in the account.',
    cost: 'Free.',
    where: 'Billing → Budgets → TheKeep-Monthly',
  },
  cognito: {
    kicker: 'TheKeepAuth',
    title: 'Cognito user pool',
    what: 'The identity provider: who you are. One user, created by CDK with the welcome email suppressed, no self sign-up, no password recovery, no hosted UI. It issues three JWTs on sign-in: an id token with your email, an access token, and a refresh token good for thirty days.',
    why: "Cognito is the brief's choice for people. Google federation needed nothing this phase, and Sign in with Apple needed a paid membership, so the emailed code became the primary path. The Lite plan is free to fifty thousand users.",
    cost: 'Free.',
    where: 'Cognito → User pools → TheKeep\ninfra/lib/auth-stack.ts',
  },
  appclient: {
    kicker: 'TheKeepAuth',
    title: 'App client',
    what: "The pool's registration of the SPA as a client. It allows exactly two flows, CUSTOM_AUTH and refresh; password and SRP flows are off, so even if a password existed it could not be used.",
    why: 'The web app needs an id to call InitiateAuth. Allowing only the custom flow keeps the attack surface to "guess a six-digit code within three tries in ten minutes."',
    cost: 'Free.',
    where: 'Cognito → User pools → TheKeep → App clients → web',
  },
  triggers: {
    kicker: 'TheKeepAuth',
    title: 'The custom authentication flow',
    what: 'Cognito calls three Lambdas in turn. Define decides what happens next: issue a challenge, issue tokens after a correct answer, or fail after three wrong ones or for an address the pool does not know. Create generates a six-digit code, emails it through SES, and keeps only a salted hash; a wrong answer reuses the unexpired code rather than sending another email. Verify compares the answer in constant time and checks the ten-minute expiry.',
    why: 'The code never touches the database and never sits anywhere in plain text. Cognito carries the hash between rounds in a field only these Lambdas can see.',
    cost: 'Free; a handful of invocations per sign-in.',
    where:
      'Lambda → DefineAuthChallenge, CreateAuthChallenge, VerifyAuthChallenge\napps/api/src/auth/*.ts',
  },
  ses: {
    kicker: 'TheKeepAuth',
    title: 'SES, in the sandbox',
    what: 'Sends the plain-text code email from keep@tylerfuqua.com. The domain identity has DKIM and a MAIL FROM subdomain in Route 53, and your address is a verified recipient, which is all sandbox mode needs to deliver to you.',
    why: 'Sandbox mode can only send to verified addresses, which is exactly one person right now. Production access is a Phase 3 request when real members arrive.',
    cost: 'Free at this volume.',
    where: 'SES → Identities → tylerfuqua.com, tyler.fuqua@icloud.com',
  },
  apigw: {
    kicker: 'TheKeepApi',
    title: 'API Gateway HTTP API',
    what: 'The front door for data. Twenty routes: twelve under /api behind the JWT authorizer, seven under /api/agent behind the agent token authorizer, and ANY /mcp for the MCP server, each mapped to one of the route Lambdas. It is reachable directly at its execute-api hostname, but browsers and agents only ever reach it through CloudFront.',
    why: 'HTTP APIs are the cheap, simple flavor of API Gateway with a built-in JWT authorizer, which is why no Lambda has to validate a token itself.',
    cost: 'Free tier, then about a dollar per million requests.',
    where: 'API Gateway → APIs → TheKeepApi\ninfra/lib/api-stack.ts',
  },
  authorizer: {
    kicker: 'TheKeepApi',
    title: 'JWT authorizer',
    what: "Runs before any Lambda. It fetches the user pool's public keys, verifies the token's signature, issuer, audience (the app client id) and expiry, and rejects with a 401 if any fail. The verified claims, your email among them, reach the Lambda as part of the event.",
    why: 'Authentication is outsourced to Cognito and enforced at the gateway. Handlers can trust the email claim without ever seeing a token.',
    cost: 'Free.',
    where: 'API Gateway → TheKeepApi → Authorize → CognitoAuthorizer',
  },
  lambdas: {
    kicker: 'TheKeepApi',
    title: 'The API Lambdas',
    what: "Four route functions, one per resource: me, documents, versions, admin-tokens. Each is bundled by esbuild with the SDK included, runs Node 22 on arm64 with 512 MB and a 30-second timeout (long enough to wait for a paused cluster), and has its own IAM role granting exactly the Data API and secret permissions. Inside, two middlewares run first: identity looks the verified email up in the member table, or reads the agent the authorizer identified; permission checks the document's ring and type against the caller's role or scopes.",
    why: "One Lambda per resource keeps cold starts few and deploys small. Identity and permission are separate on purpose, which is why Phase 2's agent door needed no second set of handlers: the same code answers /api/documents and /api/agent/documents.",
    cost: 'A million requests and 400,000 GB-seconds a month are free.',
    where:
      'Lambda → MeFunction, DocumentsFunction, VersionsFunction, AdminTokensFunction\napps/api/src/handlers · apps/api/src/middleware · apps/api/src/services',
  },
  agents: {
    kicker: 'Outside AWS',
    title: 'Agent clients',
    what: 'Claude Code, Cowork and, the day it can present a header, Duet. Each holds a token issued on the Tokens screen (keep_ then 43 random characters), sent as Authorization: Bearer on every request to /api/agent/* or to the MCP server at /mcp. The token names the agent and carries its scopes; the site stores only its hash.',
    why: 'Agents are first-class clients with a smaller blast radius: a token can write recipes without being able to delete one, promote one or see the member list. Revoke it on the Tokens screen and it stops working on its next request; edit its scopes there and the new set applies the same way.',
    cost: 'Nothing.',
    where: '/admin/tokens · docs/runbooks/import-recipes.md',
  },
  agentauth: {
    kicker: 'TheKeepApi',
    title: 'Agent token authorizer',
    what: "A Lambda API Gateway runs before any agent route. It takes the bearer, checks its shape, hashes it with SHA-256, looks the hash up in agent_token through the Data API, refuses a revoked or unknown token, records last_used_at, and returns the token's id, name and scopes as context for the handler. Nothing is cached: the token may arrive in Authorization or in X-Keep-Token, and a cache keyed on one header would serve the other's answer.",
    why: 'Agent authentication is a hash lookup, not Cognito, so it is our code; but it runs at the gateway like the JWT authorizer does, so no handler ever sees a secret. With no cache, a revoke or a scope change takes effect on the very next request.',
    cost: 'Free; one short invocation per agent request.',
    where: 'Lambda → AgentAuthorizerFunction\napps/api/src/auth/agent-authorizer.ts',
  },
  mcp: {
    kicker: 'TheKeepApi',
    title: 'MCP server',
    what: 'A Lambda at /mcp speaking the Model Context Protocol over Streamable HTTP, stateless: each POST carries one JSON-RPC message, a fresh server answers it, and nothing is kept between requests. Four tools, list_documents, get_document, create_document and create_version, each described in a paragraph a model can read, each taking the shared zod schema as its input schema. The tools run the same service functions the REST routes run, as the agent the authorizer identified.',
    why: 'The brief wanted the MCP server to wrap the public API. Importing the same code keeps one validation path and one cold start instead of an HTTP hop to itself; the trade is flagged in the Phase 2 directive. Stateless because Lambda is.',
    cost: 'Free tier, like the other functions.',
    where:
      'Lambda → McpFunction · https://tylerfuqua.com/mcp\napps/api/src/mcp/server.ts · apps/api/src/handlers/mcp.ts',
  },
  cloudwatch: {
    kicker: 'TheKeepApi',
    title: 'CloudWatch',
    what: 'Every function writes structured JSON log lines to its own log group, kept thirty days. One dashboard shows Lambda errors and p95 duration, API 4xx and 5xx, and Aurora capacity.',
    why: 'The brief asks for enough to debug a Lambda at 11pm and nothing more.',
    cost: 'Three dashboards and 5 GB of logs a month are free.',
    where: 'CloudWatch → Dashboards → TheKeep · Log groups → /aws/lambda/TheKeep*',
  },
  aurora: {
    kicker: 'TheKeepData',
    title: 'Aurora Serverless v2',
    what: 'PostgreSQL 16.9 as one writer instance of class db.serverless, scaling between 0 and 2 ACUs. After five idle minutes it pauses and you pay for storage alone; the next request wakes it in about fifteen seconds, which the Lambdas and the migration runner wait out. Deletion protection is on and the cluster is retained if the stack is ever deleted. Backups keep seven days.',
    why: 'The brief wanted Postgres because versioned documents and diffs are relational. Serverless v2 at zero ACU was chosen over a small RDS instance because a credits-era account would have spent most of the budget on an instance that sits idle.',
    cost: 'About $0.10 per GB-month of storage, plus $0.12 per ACU-hour only while awake.',
    where:
      'RDS → Databases → the TheKeepData cluster; status shows "Stopped" when paused\ninfra/lib/data-stack.ts',
  },
  dataapi: {
    kicker: 'TheKeepData',
    title: 'RDS Data API',
    what: 'An HTTPS endpoint that runs SQL against the cluster. Callers sign requests with IAM; the cluster fetches its own credentials from Secrets Manager. Drizzle speaks it in production through a client that retries while the cluster resumes; the migration runner in CI uses the same client.',
    why: "It is the judgment call of Phase 1. Without it every Lambda would need to live in the VPC, which means a NAT gateway (the single most expensive line item it would have added) or no internet access, plus a database password in every function's environment.",
    cost: 'Free; the per-request pricing is below rounding at this scale.',
    where: 'Enabled on the cluster ("EnableHttpEndpoint")\napps/api/src/lib/data-api.ts',
  },
  secret: {
    kicker: 'TheKeepData',
    title: 'Secrets Manager',
    what: "The cluster's master username and password, generated by CDK and never printed. The Data API reads it on your behalf; the deploy role and the Lambdas are allowed to reference it, but nothing in the repo or in GitHub ever contains it.",
    why: "The brief's rule: no credentials in code, env files or the repository. This is the only secret the system has.",
    cost: '$0.40 a month.',
    where: 'Secrets Manager → TheKeepDataClusterSecret…',
  },
  ssm: {
    kicker: 'TheKeepData',
    title: 'SSM parameters',
    what: 'Three plain parameters: the cluster ARN, the secret ARN and the database name, under /the-keep/db/. The Lambdas get these as environment variables through cross-stack references; the parameters exist so a script or a future stack can find the database without reading CloudFormation.',
    why: 'The brief says configuration comes from CDK outputs and SSM, not from committed files.',
    cost: 'Free.',
    where: 'Systems Manager → Parameter Store → /the-keep/db/*',
  },
  migrations: {
    kicker: 'TheKeepData',
    title: 'Migrations',
    what: 'SQL files in apps/api/migrations, applied in order by a small runner that goes through the Data API, each file in its own transaction, recorded in schema_migration so a rerun is a no-op. 0001 made the five tables and the trigger that makes version rows append-only; 0002 seeded the admin member; 0003 added authored_at; 0004 imported the chili lineage, the one content import, marked as the exception.',
    why: 'Migrations are append-only once shipped. Renames need a new file and your say-so.',
    cost: 'A few seconds of CI per deploy.',
    where: 'apps/api/migrations · apps/api/src/lib/migrate.ts · deploy.yml "Run migrations"',
  },
  cdk: {
    kicker: 'The translation layer',
    title: 'The CDK app',
    what: 'TypeScript under infra/ that, when run, writes CloudFormation templates into infra/cdk.out. It never calls AWS to create anything. Each stack is a class; config.ts holds every name, the account id and the domain. Snapshot tests freeze each template so an unintended change fails a test, and the PR workflow posts a cdk diff against what is deployed.',
    why: "Infrastructure as code in the same language as the app, reviewable in a pull request like any other change. The brief's rule: never cdk deploy locally.",
    cost: 'Free.',
    where:
      'infra/bin/the-keep.ts · infra/lib/*.ts · infra/test/__snapshots__\npnpm -C infra synth · pnpm -C infra test',
  },
  assets: {
    kicker: 'CDK bootstrap',
    title: 'CDK assets bucket',
    what: "An S3 bucket created by cdk bootstrap. Before a deploy, CDK uploads each Lambda's bundled zip and each template here, keyed by content hash; CloudFormation then fetches them. Unchanged assets are skipped, which is why a docs-only deploy is fast.",
    why: 'CloudFormation can only load Lambda code from S3; this is the staging area.',
    cost: 'Cents.',
    where: 'S3 → cdk-hnb659fds-assets-697941679713-us-east-1',
  },
  execrole: {
    kicker: 'CDK bootstrap',
    title: 'CloudFormation execution role',
    what: 'The administrator role bootstrap created. CloudFormation assumes it to create and modify resources. Nothing else uses it: not GitHub, not the Lambdas, not you day to day.',
    why: 'Someone has to be able to create a database. Giving that power to CloudFormation alone, rather than to CI, means the thing on the internet-facing side of the trust chain never holds it.',
    cost: 'Free.',
    where: 'IAM → Roles → cdk-hnb659fds-cfn-exec-role-…',
  },
  cfn: {
    kicker: 'CDK bootstrap',
    title: 'CloudFormation',
    what: 'The service that turns a template into resources. On each deploy it computes a change set against the current stack, applies it in dependency order, and rolls back the whole stack if anything fails. Cross-stack references, like the site stack needing the API hostname, become exports and imports, which is why Data and Auth deploy before Api, and Api before Site.',
    why: 'Declarative and transactional. The first Phase 1 deploy created forty-odd resources across four stacks in fourteen minutes and would have undone all of them on a failure.',
    cost: 'Free.',
    where:
      'CloudFormation → Stacks: TheKeepAccount, TheKeepData, TheKeepAuth, TheKeepApi, TheKeepSite',
  },
};

export const TRACES: Record<string, Trace> = {
  page: {
    title: 'Load the page',
    steps: [
      {
        text: 'The browser asks DNS for tylerfuqua.com; Route 53 answers with an alias to the CloudFront distribution.',
        nodes: ['browser', 'route53'],
        edges: ['e-r53-cf'],
      },
      {
        text: 'TLS is negotiated at a CloudFront edge with the ACM certificate. The request for /recipes/abc hits the default behavior.',
        nodes: ['cloudfront', 'acm'],
        edges: ['e-browser-cf'],
      },
      {
        text: 'The CloudFront Function rewrites the extensionless path to /index.html so React Router can take over.',
        nodes: ['cffunction'],
        edges: ['e-cf-fn'],
      },
      {
        text: 'CloudFront fetches index.html from the private bucket (never cached) and the hashed assets (cached a year), then serves them.',
        nodes: ['s3'],
        edges: ['e-cf-s3'],
      },
      {
        text: 'The SPA boots with no token in memory, so the protected route sends you to /sign-in.',
        nodes: ['browser'],
        edges: [],
      },
    ],
  },
  signin: {
    title: 'Sign in',
    steps: [
      {
        text: "You enter your email. The SPA calls Cognito's InitiateAuth with the CUSTOM_AUTH flow and the app client id.",
        nodes: ['browser', 'cognito', 'appclient'],
        edges: ['e-browser-cognito'],
      },
      {
        text: 'Cognito finds the user and calls Define, which says "issue a custom challenge."',
        nodes: ['triggers'],
        edges: ['e-cognito-triggers'],
      },
      {
        text: 'Create generates a six-digit code, hashes it with a random salt, and keeps only the hash in private parameters.',
        nodes: ['triggers'],
        edges: [],
      },
      {
        text: 'Create sends the plain-text email through SES from keep@tylerfuqua.com. DKIM in Route 53 is why it lands in the inbox.',
        nodes: ['ses', 'route53'],
        edges: ['e-create-ses'],
      },
      {
        text: "You type the code. The SPA calls RespondToAuthChallenge with Cognito's opaque session.",
        nodes: ['browser', 'cognito'],
        edges: ['e-browser-cognito'],
      },
      {
        text: 'Verify hashes your answer and compares in constant time, inside the ten-minute window. Define sees a correct answer and says "issue tokens."',
        nodes: ['triggers'],
        edges: ['e-cognito-triggers'],
      },
      {
        text: 'Cognito returns an id token (with your email), an access token, and a refresh token. They stay in memory; the id token becomes the API bearer.',
        nodes: ['browser'],
        edges: [],
      },
    ],
  },
  save: {
    title: 'Save a recipe version',
    steps: [
      {
        text: 'The SPA POSTs to /api/documents/:id/versions with Authorization: Bearer and the id token, refreshed first if within a minute of expiry.',
        nodes: ['browser', 'cloudfront'],
        edges: ['e-browser-cf'],
      },
      {
        text: 'CloudFront matches the /api/* behavior: no caching, every viewer header except Host forwarded to API Gateway.',
        nodes: ['cloudfront', 'apigw'],
        edges: ['e-cf-apigw'],
      },
      {
        text: "The JWT authorizer verifies the token against the pool's public keys: signature, issuer, audience, expiry. A failure is a 401 and no Lambda runs.",
        nodes: ['authorizer', 'cognito'],
        edges: ['e-apigw-authz', 'e-authorizer-jwks'],
      },
      {
        text: 'The versions Lambda receives the event with the verified email claim. Identity middleware looks the email up in the member table; permission middleware checks the ring.',
        nodes: ['lambdas'],
        edges: ['e-authz-lambdas'],
      },
      {
        text: "The handler validates the body against the shared zod schema, then Drizzle issues ExecuteStatement calls over https, signed with the function's IAM role.",
        nodes: ['dataapi'],
        edges: ['e-lambdas-dataapi'],
      },
      {
        text: 'If the cluster was paused, the first call returns DatabaseResumingException and the client retries for up to 45 seconds while Aurora wakes.',
        nodes: ['aurora'],
        edges: ['e-dataapi-aurora'],
      },
      {
        text: "Inside a transaction: insert the version row (number = max + 1), move the document's current pointer. The append-only trigger guarantees no version is ever changed.",
        nodes: ['aurora', 'secret'],
        edges: ['e-aurora-secret'],
      },
      {
        text: 'A 201 with the new version flows back; a structured log line lands in CloudWatch with the request id and timing.',
        nodes: ['lambdas', 'cloudwatch', 'browser'],
        edges: ['e-lambdas-logs'],
      },
    ],
  },
  agent: {
    title: 'An agent saves a recipe',
    steps: [
      {
        text: 'A Claude Code session holding the importer token calls the create_version tool. Its MCP client POSTs one JSON-RPC message to https://tylerfuqua.com/mcp with Authorization: Bearer keep_… and Accept: application/json, text/event-stream.',
        nodes: ['agents', 'cloudfront'],
        edges: ['e-agents-cf'],
      },
      {
        text: 'CloudFront matches the /mcp behavior, the twin of /api/*: nothing cached, every viewer header except Host forwarded to API Gateway.',
        nodes: ['cloudfront', 'apigw'],
        edges: ['e-cf-apigw'],
      },
      {
        text: 'API Gateway runs the agent token authorizer: the bearer is hashed with SHA-256 and looked up in agent_token through the Data API. Revoked or unknown is a 401 and no handler runs. A live token has last_used_at touched and its id, name and scopes handed on; nothing is cached, so a revoke or a scope edit bites on the next call.',
        nodes: ['agentauth', 'dataapi', 'aurora'],
        edges: ['e-apigw-agentauth'],
      },
      {
        text: 'The MCP Lambda builds a fresh, stateless server for this one request, decodes the JSON-RPC call, and runs create_version as the agent: the same service function the REST route runs, with the same identity shape the member path produces.',
        nodes: ['mcp', 'lambdas'],
        edges: ['e-agentauth-mcp', 'e-mcp-lambdas'],
      },
      {
        text: 'Permission: a write on a recipe in the me ring needs write:recipes, which the importer carries. The frontmatter is validated against the shared zod schema; a failure goes back to the model as a tool error naming the field, so it can fix the call and try again.',
        nodes: ['mcp'],
        edges: [],
      },
      {
        text: 'Inside a transaction over the Data API: a version row with author_agent_token_id set (never a member), number = max + 1, authored_at from the file’s own date; the document’s current pointer moves. History will say "importer".',
        nodes: ['dataapi', 'aurora'],
        edges: ['e-mcp-dataapi', 'e-dataapi-aurora'],
      },
      {
        text: 'The tool result goes back as JSON. The admin UI’s agent activity view lists the version under the token’s name, apart from anything a person saved; a structured log line lands in CloudWatch.',
        nodes: ['agents', 'cloudwatch'],
        edges: ['e-lambdas-logs'],
      },
    ],
  },
  deploy: {
    title: 'Deploy from main',
    steps: [
      {
        text: 'A merge to main starts the Deploy workflow. It installs, then runs every test; a failure here stops before anything touches AWS.',
        nodes: ['github'],
        edges: [],
      },
      {
        text: "GitHub mints a signed JWT naming this repository and branch. AWS STS verifies it against GitHub's keys and issues one-hour credentials for the deploy role.",
        nodes: ['oidc', 'roles'],
        edges: ['e-gh-oidc', 'e-oidc-deploy'],
      },
      {
        text: 'cdk deploy synthesizes the templates, uploads changed Lambda bundles to the assets bucket, and hands each template to CloudFormation.',
        nodes: ['cdk', 'assets', 'cfn'],
        edges: ['e-deploy-cfn'],
      },
      {
        text: 'CloudFormation, acting as the execution role, applies change sets in dependency order: Data and Auth, then Api, then Site. Any failure rolls that stack back.',
        nodes: ['execrole', 'cfn', 'aurora', 'cognito', 'apigw', 'cloudfront'],
        edges: ['e-cfn-stacks'],
      },
      {
        text: 'The workflow reads the stack outputs: bucket name, distribution id, cluster and secret ARNs, user pool and client ids.',
        nodes: ['github'],
        edges: [],
      },
      {
        text: 'The migration runner applies any new SQL file through the Data API in its own transaction and records it in schema_migration.',
        nodes: ['dataapi', 'migrations', 'aurora'],
        edges: ['e-gh-dataapi', 'e-dataapi-aurora'],
      },
      {
        text: 'Vite builds the SPA with the Cognito ids baked in as VITE_ variables, so the app knows which pool to sign in to.',
        nodes: ['github', 'appclient'],
        edges: [],
      },
      {
        text: 'Two S3 syncs (immutable assets, then uncached root files) and a CloudFront invalidation. The new page is live on the next request.',
        nodes: ['s3', 'cloudfront'],
        edges: ['e-gh-s3'],
      },
    ],
  },
};
