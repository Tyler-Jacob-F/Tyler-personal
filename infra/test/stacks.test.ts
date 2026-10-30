import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { ApiStack } from '../lib/api-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { config } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';
import { SiteStack } from '../lib/site-stack.js';

function app() {
  return new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
}

/**
 * Lambda asset hashes depend on the machine that computed them, so snapshots mask
 * `S3Key` values that look like one. Everything else in the template is compared as is.
 */
function stable(template: Template): unknown {
  return JSON.parse(
    JSON.stringify(template.toJSON(), (key, value: unknown) =>
      key === 'S3Key' && typeof value === 'string' && /^[0-9a-f]{64}\.zip$/.test(value)
        ? '<asset-hash>.zip'
        : value,
    ),
  );
}

describe('AccountStack', () => {
  const template = Template.fromStack(new AccountStack(app(), 'Account', { env: config.env }));

  it('matches the snapshot', () => {
    expect(stable(template)).toMatchSnapshot();
  });

  it('trusts GitHub only for this repository, by name and by numeric ID', () => {
    const { owner, repo, ownerId, repoId, deployBranch } = config.github;
    const subs = JSON.stringify(template.findResources('AWS::IAM::Role'));
    expect(subs).toContain(`repo:${owner}@${ownerId}/${repo}@${repoId}:pull_request`);
    expect(subs).toContain(`repo:${owner}/${repo}:pull_request`);
    expect(subs).toContain(
      `repo:${owner}@${ownerId}/${repo}@${repoId}:ref:refs/heads/${deployBranch}`,
    );
    expect(subs).toContain(`repo:${owner}/${repo}:ref:refs/heads/${deployBranch}`);
    expect(subs).not.toContain('repo:*');
  });

  it('guards the budget before any application code', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: { BudgetLimit: { Amount: config.billing.monthlyLimitUsd, Unit: 'USD' } },
    });
  });
});

describe('SiteStack', () => {
  const template = Template.fromStack(
    new SiteStack(app(), 'Site', {
      env: config.env,
      apiDomainName: 'abc123.execute-api.us-east-1.amazonaws.com',
    }),
  );

  it('forwards /api/* and /mcp to the HTTP API uncached, with every viewer header but Host', () => {
    const behavior = (pattern: string) =>
      Match.objectLike({
        PathPattern: pattern,
        AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
        CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
        ViewerProtocolPolicy: 'https-only',
      });
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: { CacheBehaviors: [behavior('/api/*'), behavior('/mcp')] },
    });
  });

  it('matches the snapshot', () => {
    expect(stable(template)).toMatchSnapshot();
  });

  it('keeps the bucket private and serves it through CloudFront', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, RestrictPublicBuckets: true },
    });
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::CloudFront::Function', 1);
  });

  it('answers at the apex and www over IPv4 and IPv6', () => {
    template.resourceCountIs('AWS::Route53::RecordSet', 4);
  });
});

describe('DataStack', () => {
  const template = Template.fromStack(new DataStack(app(), 'Data', { env: config.env }));

  it('matches the snapshot', () => {
    expect(stable(template)).toMatchSnapshot();
  });

  it('pauses at zero ACU, caps at two, and speaks the Data API', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EnableHttpEndpoint: true,
      DeletionProtection: true,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 2 },
    });
    template.hasResource('AWS::RDS::DBCluster', { DeletionPolicy: 'Retain' });
  });

  it('has no NAT gateway and no public subnet', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
  });

  it('lets the deploy role run migrations through the Data API', () => {
    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('rds-data:ExecuteStatement');
    expect(policies).toContain('secretsmanager:GetSecretValue');
    expect(policies).toContain(config.roles.deploy);
  });

  it('publishes the cluster and secret ARNs as SSM parameters', () => {
    template.resourceCountIs('AWS::SSM::Parameter', 3);
  });
});

describe('AuthStack', () => {
  const template = Template.fromStack(new AuthStack(app(), 'Auth', { env: config.env }));

  it('matches the snapshot', () => {
    expect(stable(template)).toMatchSnapshot();
  });

  it('allows no self sign-up and wires the three custom-auth triggers', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      UsernameAttributes: ['email'],
      LambdaConfig: {
        DefineAuthChallenge: Match.anyValue(),
        CreateAuthChallenge: Match.anyValue(),
        VerifyAuthChallengeResponse: Match.anyValue(),
      },
      DeletionProtection: 'ACTIVE',
    });
    template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Retain' });
    template.resourceCountIs('AWS::Lambda::Function', 3);
  });

  it('pre-creates exactly the admin, with no welcome email', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolUser', 1);
    template.hasResourceProperties('AWS::Cognito::UserPoolUser', {
      Username: config.admin.email,
      MessageAction: 'SUPPRESS',
    });
  });

  it('lets the web client use only the custom flow and refresh', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
    });
  });

  it('keeps every function log for a month', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 3);
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('verifies the sending domain with DKIM and MAIL FROM records, and the admin address', () => {
    template.resourceCountIs('AWS::SES::EmailIdentity', 2);
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: config.domainName,
      MailFromAttributes: { MailFromDomain: config.email.mailFromDomain },
    });
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: config.admin.email,
    });
    const records = template.findResources('AWS::Route53::RecordSet');
    const types = Object.values(records).map((r) => r.Properties.Type as string);
    expect(types.filter((t) => t === 'CNAME')).toHaveLength(3);
    expect(types).toContain('MX');
    expect(types).toContain('TXT');
  });

  it('lets only the create-challenge function send email', () => {
    const policies = Object.values(template.findResources('AWS::IAM::Policy'));
    const senders = policies.filter((p) => JSON.stringify(p).includes('ses:SendEmail'));
    expect(senders).toHaveLength(1);
    expect(JSON.stringify(senders[0])).toContain('CreateAuthChallenge');
  });
});

describe('ApiStack', () => {
  const a = app();
  const data = new DataStack(a, 'Data', { env: config.env });
  const auth = new AuthStack(a, 'Auth', { env: config.env });
  const template = Template.fromStack(
    new ApiStack(a, 'Api', {
      env: config.env,
      cluster: data.cluster,
      userPool: auth.userPool,
      userPoolClient: auth.webClient,
      otherFunctions: auth.triggers,
    }),
  );

  it('matches the snapshot', () => {
    expect(stable(template)).toMatchSnapshot();
  });

  it('puts the Cognito JWT authorizer on every member route', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Authorizer', 2);
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', { AuthorizerType: 'JWT' });
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    expect(routes).toHaveLength(21);
    const members = routes.filter(
      (r) =>
        /\/api\//.test(String(r.Properties.RouteKey)) &&
        !/\/api\/agent\//.test(String(r.Properties.RouteKey)),
    );
    expect(members).toHaveLength(13);
    for (const route of members) {
      expect(route.Properties.AuthorizationType).toBe('JWT');
      expect(route.Properties.RouteKey).toMatch(/^(GET|POST|DELETE) \/api\//);
    }
  });

  it('opens the agents door on /api/agent/* through the Lambda authorizer, with no delete', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'REQUEST',
      AuthorizerPayloadFormatVersion: '2.0',
      EnableSimpleResponses: true,
      AuthorizerResultTtlInSeconds: 0,
      IdentitySource: Match.absent(),
    });
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    const agents = routes.filter((r) => String(r.Properties.RouteKey).includes('/api/agent/'));
    expect(agents.map((r) => r.Properties.RouteKey).sort()).toEqual([
      'GET /api/agent/documents',
      'GET /api/agent/documents/{id}',
      'GET /api/agent/documents/{id}/diff',
      'GET /api/agent/documents/{id}/versions',
      'GET /api/agent/documents/{id}/versions/{number}',
      'POST /api/agent/documents',
      'POST /api/agent/documents/{id}/versions',
    ]);
    for (const route of agents) expect(route.Properties.AuthorizationType).toBe('CUSTOM');
  });

  it('serves MCP at ANY /mcp behind the same agent authorizer', () => {
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    const mcp = routes.filter((r) => r.Properties.RouteKey === 'ANY /mcp');
    expect(mcp).toHaveLength(1);
    expect(mcp[0]!.Properties.AuthorizationType).toBe('CUSTOM');
    const fns = Object.values(template.findResources('AWS::Lambda::Function'));
    expect(fns.some((f) => String(f.Properties.Description).includes('MCP server'))).toBe(true);
  });

  it('runs one Lambda per resource, outside the VPC, with Data API access', () => {
    template.resourceCountIs('AWS::Lambda::Function', 7);
    const fns = Object.values(template.findResources('AWS::Lambda::Function'));
    for (const fn of fns) {
      expect(fn.Properties.VpcConfig).toBeUndefined();
      expect(fn.Properties.Runtime).toBe('nodejs22.x');
      expect(fn.Properties.Environment.Variables).toMatchObject({ DB_NAME: config.database.name });
    }
    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('rds-data:ExecuteStatement');
    template.resourceCountIs('AWS::Logs::LogGroup', 7);
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('keeps token management under the Cognito authorizer, never an agent route', () => {
    const routes = Object.values(template.findResources('AWS::ApiGatewayV2::Route'));
    const admin = routes.filter((r) => String(r.Properties.RouteKey).includes('/api/admin/'));
    expect(admin.map((r) => r.Properties.RouteKey).sort()).toEqual([
      'DELETE /api/admin/tokens/{id}',
      'GET /api/admin/activity',
      'GET /api/admin/tokens',
      'POST /api/admin/tokens',
    ]);
    for (const route of admin) expect(route.Properties.AuthorizationType).toBe('JWT');
  });

  it('draws one dashboard with Lambda errors and duration, API 4xx/5xx and Aurora ACU', () => {
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    const body = JSON.stringify(template.findResources('AWS::CloudWatch::Dashboard'));
    for (const needle of [
      'Lambda errors',
      'Lambda duration p95',
      'AWS/ApiGateway\\",\\"4xx',
      'AWS/ApiGateway\\",\\"5xx',
      'ServerlessDatabaseCapacity',
      'ACUUtilization',
      'CreateAuthChallenge',
      'DocumentsFunction',
    ]) {
      expect(body).toContain(needle);
    }
  });
});
