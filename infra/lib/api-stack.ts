import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type * as rds from 'aws-cdk-lib/aws-rds';
import type { Construct } from 'constructs';
import { config } from './config.js';
import { apiFunction } from './lambda.js';

export interface ApiStackProps extends cdk.StackProps {
  cluster: rds.DatabaseCluster;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

/**
 * The HTTP API: a Cognito JWT authorizer in front of one Lambda per resource. Every
 * route lives under /api so CloudFront can forward that prefix unchanged. Lambdas reach
 * the database through the Data API, so none of them is in the VPC.
 */
export class ApiStack extends cdk.Stack {
  readonly httpApi: apigwv2.HttpApi;
  /** Hostname of the API's default endpoint, for the CloudFront origin. */
  readonly apiDomainName: string;
  readonly functions: Record<'me' | 'documents' | 'versions', lambda.IFunction>;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { cluster, userPool, userPoolClient } = props;
    const environment = {
      DB_CLUSTER_ARN: cluster.clusterArn,
      DB_SECRET_ARN: cluster.secret!.secretArn,
      DB_NAME: config.database.name,
    };
    // The first request after the cluster pauses waits for it to resume (~15s).
    const timeout = cdk.Duration.seconds(30);

    const me = apiFunction(this, 'MeFunction', {
      entry: 'handlers/me.ts',
      description: `${config.siteName}: GET /api/me`,
      environment,
      timeout,
    });
    const documents = apiFunction(this, 'DocumentsFunction', {
      entry: 'handlers/documents.ts',
      description: `${config.siteName}: /api/documents`,
      environment,
      timeout,
    });
    const versions = apiFunction(this, 'VersionsFunction', {
      entry: 'handlers/versions.ts',
      description: `${config.siteName}: /api/documents/{id}/versions and diff`,
      environment,
      timeout,
    });
    this.functions = { me, documents, versions };
    for (const fn of [me, documents, versions]) cluster.grantDataApiAccess(fn);

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
    });

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `${config.stackPrefix}Api`,
      description: `${config.siteName} API (${config.domainName}/api)`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    const { GET, POST, DELETE } = apigwv2.HttpMethod;
    const routes: Array<[string, apigwv2.HttpMethod[], lambda.IFunction]> = [
      ['/api/me', [GET], me],
      ['/api/documents', [GET, POST], documents],
      ['/api/documents/{id}', [GET, DELETE], documents],
      ['/api/documents/{id}/versions', [GET, POST], versions],
      ['/api/documents/{id}/versions/{number}', [GET], versions],
      ['/api/documents/{id}/diff', [GET], versions],
    ];
    for (const [path, methods, fn] of routes) {
      this.httpApi.addRoutes({
        path,
        methods,
        integration: new HttpLambdaIntegration(`${fn.node.id}${path.replace(/[^a-z]/gi, '')}`, fn),
      });
    }

    // https://abc123.execute-api.us-east-1.amazonaws.com -> abc123.execute-api.us-east-1.amazonaws.com
    this.apiDomainName = cdk.Fn.select(2, cdk.Fn.split('/', this.httpApi.apiEndpoint));

    new cdk.CfnOutput(this, 'ApiEndpoint', { value: this.httpApi.apiEndpoint });
  }
}
