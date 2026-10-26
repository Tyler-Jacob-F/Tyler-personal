import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { config } from '../lib/config.js';
import { DataStack } from '../lib/data-stack.js';
import { SiteStack } from '../lib/site-stack.js';

function app() {
  return new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
}

describe('AccountStack', () => {
  const template = Template.fromStack(new AccountStack(app(), 'Account', { env: config.env }));

  it('matches the snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
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
  const template = Template.fromStack(new SiteStack(app(), 'Site', { env: config.env }));

  it('matches the snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
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
    expect(template.toJSON()).toMatchSnapshot();
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
