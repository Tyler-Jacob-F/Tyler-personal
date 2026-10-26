import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { config } from '../lib/config.js';
import { SiteStack } from '../lib/site-stack.js';

function app() {
  return new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
}

describe('AccountStack', () => {
  const template = Template.fromStack(new AccountStack(app(), 'Account', { env: config.env }));

  it('matches the snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  it('trusts GitHub only for this repository', () => {
    const subs = JSON.stringify(template.findResources('AWS::IAM::Role'));
    expect(subs).toContain(`repo:${config.github.owner}/${config.github.repo}:pull_request`);
    expect(subs).toContain(
      `repo:${config.github.owner}/${config.github.repo}:ref:refs/heads/${config.github.deployBranch}`,
    );
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
