import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import { config } from './config.js';

/**
 * One-time account plumbing: the GitHub OIDC trust and the billing guard. Deployed once
 * locally (see README); after that CI owns every other stack.
 */
export class AccountStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { owner, repo, deployBranch } = config.github;
    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const trust = (sub: string) =>
      new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': sub },
      });

    const cdkRoleArn = (kind: string) =>
      cdk.Arn.format(
        { service: 'iam', region: '', resource: 'role', resourceName: `cdk-*-${kind}-role-*` },
        this,
      );

    // Pull requests: read-only. Enough for `cdk diff`, nothing more.
    const prRole = new iam.Role(this, 'GitHubPullRequestRole', {
      roleName: `${config.stackPrefix}-GitHubPullRequest`,
      assumedBy: trust(`repo:${owner}/${repo}:pull_request`),
      maxSessionDuration: cdk.Duration.hours(1),
    });
    prRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['sts:AssumeRole'], resources: [cdkRoleArn('lookup')] }),
    );

    // Merges to the deploy branch: assume the CDK bootstrap roles, publish the SPA.
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: `${config.stackPrefix}-GitHubDeploy`,
      assumedBy: trust(`repo:${owner}/${repo}:ref:refs/heads/${deployBranch}`),
      maxSessionDuration: cdk.Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: ['lookup', 'deploy', 'file-publishing', 'image-publishing'].map(cdkRoleArn),
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          this.formatArn({
            service: 'cloudformation',
            resource: 'stack',
            resourceName: `${config.stackPrefix}*/*`,
          }),
        ],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [
          `arn:aws:s3:::${config.siteBucketName}`,
          `arn:aws:s3:::${config.siteBucketName}/*`,
        ],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation'], resources: ['*'] }),
    );

    // Budget is a feature. AWS Budgets needs no "enable billing alerts" toggle and emails
    // directly, so it beats a CloudWatch EstimatedCharges alarm for a first guard.
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `${config.stackPrefix}-Monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: config.billing.monthlyLimitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: config.billing.alarmEmail }],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: config.billing.alarmEmail }],
        },
      ],
    });

    new cdk.CfnOutput(this, 'PullRequestRoleArn', { value: prRole.roleArn });
    new cdk.CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
  }
}
