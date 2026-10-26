import * as cdk from 'aws-cdk-lib';
import { AccountStack } from '../lib/account-stack.js';
import { config } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';
import { SiteStack } from '../lib/site-stack.js';

const app = new cdk.App();
const env = config.env;

new AccountStack(app, `${config.stackPrefix}Account`, {
  env,
  description: `${config.siteName}: GitHub OIDC roles and billing guard (deployed once, locally)`,
});

new DataStack(app, `${config.stackPrefix}Data`, {
  env,
  description: `${config.siteName}: Aurora Serverless v2 behind the RDS Data API`,
});

new SiteStack(app, `${config.stackPrefix}Site`, {
  env,
  description: `${config.siteName}: static site at ${config.domainName}`,
});

cdk.Tags.of(app).add('project', 'the-keep');
