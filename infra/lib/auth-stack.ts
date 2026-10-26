import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const emailFrom = `${config.siteName} <${config.email.sender}>`;
    const codeTtlSeconds = String(config.auth.codeTtlMinutes * 60);

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
    const verifyAuthChallenge = apiFunction(this, 'VerifyAuthChallenge', {
      entry: 'auth/verify-auth-challenge.ts',
      description: `${config.siteName}: custom auth flow, verify the code`,
      memorySize: 256,
    });

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

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.webClient.userPoolClientId });
  }
}
