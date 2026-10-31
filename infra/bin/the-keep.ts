import * as cdk from 'aws-cdk-lib';
import { AccountStack } from '../lib/account-stack.js';
import { ApiStack } from '../lib/api-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { config } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';
import { SiteStack } from '../lib/site-stack.js';

const app = new cdk.App();
const env = config.env;

new AccountStack(app, `${config.stackPrefix}Account`, {
  env,
  description: `${config.siteName}: GitHub OIDC roles and billing guard (deployed once, locally)`,
});

const data = new DataStack(app, `${config.stackPrefix}Data`, {
  env,
  description: `${config.siteName}: Aurora Serverless v2 behind the RDS Data API`,
});

const auth = new AuthStack(app, `${config.stackPrefix}Auth`, {
  env,
  description: `${config.siteName}: Cognito user pool, sign-in by emailed code`,
});

const api = new ApiStack(app, `${config.stackPrefix}Api`, {
  env,
  description: `${config.siteName}: HTTP API behind a Cognito JWT authorizer`,
  cluster: data.cluster,
  userPool: auth.userPool,
  userPoolClient: auth.webClient,
  groupClient: auth.groupClient,
  otherFunctions: auth.triggers,
});

new SiteStack(app, `${config.stackPrefix}Site`, {
  env,
  description: `${config.siteName}: static site at ${config.domainName}`,
  apiDomainName: api.apiDomainName,
});

cdk.Tags.of(app).add('project', 'the-keep');
