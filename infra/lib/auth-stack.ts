import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';
import { config } from './config.js';
import { apiFunction } from './lambda.js';

/**
 * Who people are: a Cognito user pool with exactly one user (the admin), signed in by a
 * six-digit code emailed through the custom auth flow. No passwords, no self sign-up,
 * no hosted UI. Google federation joins in Phase 3.
 */
export class AuthStack extends cdk.Stack {
  readonly userPool: cognito.UserPool;
  readonly webClient: cognito.UserPoolClient;
  /** The co-leads' client: the same code flow, a year between sign-ins (docs/phases/04-group.md). */
  readonly groupClient: cognito.UserPoolClient;
  /** The three custom-auth triggers, for the dashboard in the API stack. */
  readonly triggers: lambda.IFunction[];

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const emailFrom = `${config.siteName} <${config.email.sender}>`;
    const codeTtlSeconds = String(config.auth.codeTtlMinutes * 60);

    // SES stays in the sandbox this phase: the sending domain (DKIM CNAMEs and the MAIL
    // FROM subdomain's MX/TXT land in Route 53) plus the admin address as a verified
    // recipient. Tyler clicks that one verification link once.
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: config.domainName });
    const domainIdentity = new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.publicHostedZone(zone),
      mailFromDomain: config.email.mailFromDomain,
    });
    const adminIdentity = new ses.EmailIdentity(this, 'AdminIdentity', {
      identity: ses.Identity.email(config.admin.email),
    });

    const defineAuthChallenge = apiFunction(this, 'DefineAuthChallenge', {
      entry: 'auth/define-auth-challenge.ts',
      description: `${config.siteName}: custom auth flow, define challenge`,
      memorySize: 256,
    });
    const createAuthChallenge = apiFunction(this, 'CreateAuthChallenge', {
      entry: 'auth/create-auth-challenge.ts',
      description: `${config.siteName}: custom auth flow, email a sign-in code`,
      memorySize: 256,
      environment: { EMAIL_FROM: emailFrom, CODE_TTL_SECONDS: codeTtlSeconds },
    });
    domainIdentity.grantSendEmail(createAuthChallenge);
    adminIdentity.grantSendEmail(createAuthChallenge);
    const verifyAuthChallenge = apiFunction(this, 'VerifyAuthChallenge', {
      entry: 'auth/verify-auth-challenge.ts',
      description: `${config.siteName}: custom auth flow, verify the code`,
      memorySize: 256,
    });

    this.triggers = [defineAuthChallenge, createAuthChallenge, verifyAuthChallenge];

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.stackPrefix}`,
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      standardAttributes: { email: { required: true, mutable: true } },
      accountRecovery: cognito.AccountRecovery.NONE,
      mfa: cognito.Mfa.OFF,
      lambdaTriggers: {
        defineAuthChallenge,
        createAuthChallenge,
        verifyAuthChallengeResponse: verifyAuthChallenge,
      },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // The one admin. No welcome email (SUPPRESS): the first code email is the welcome.
    new cognito.CfnUserPoolUser(this, 'AdminUser', {
      userPoolId: this.userPool.userPoolId,
      username: config.admin.email,
      userAttributes: [
        { name: 'email', value: config.admin.email },
        { name: 'email_verified', value: 'true' },
      ],
      messageAction: 'SUPPRESS',
    });

    this.webClient = this.userPool.addClient('Web', {
      userPoolClientName: 'web',
      generateSecret: false,
      authFlows: { custom: true },
      disableOAuth: true,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Co-leads sign in once a year, Tyler every thirty days: a refresh token's life is a
    // property of the app client, so the group gets its own. Same pool, same custom flow,
    // same JWT authorizer (which accepts both clients); only the validity differs.
    this.groupClient = this.userPool.addClient('Group', {
      userPoolClientName: 'group',
      generateSecret: false,
      authFlows: { custom: true },
      disableOAuth: true,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(365),
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.webClient.userPoolClientId });
    new cdk.CfnOutput(this, 'GroupClientId', { value: this.groupClient.userPoolClientId });
  }
}
