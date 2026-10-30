import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
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
  /** Other functions (the Cognito triggers) to show on the dashboard. */
  otherFunctions?: lambda.IFunction[];
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
  readonly functions: Record<'me' | 'documents' | 'versions' | 'adminTokens', lambda.IFunction>;

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
    const adminTokens = apiFunction(this, 'AdminTokensFunction', {
      entry: 'handlers/admin-tokens.ts',
      description: `${config.siteName}: /api/admin/tokens (admin role only)`,
      environment,
      timeout,
    });
    this.functions = { me, documents, versions, adminTokens };
    for (const fn of [me, documents, versions, adminTokens]) cluster.grantDataApiAccess(fn);

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
      ['/api/admin/tokens', [GET, POST], adminTokens],
      ['/api/admin/tokens/{id}', [DELETE], adminTokens],
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

    this.dashboard(cluster, [
      me,
      documents,
      versions,
      adminTokens,
      ...(props.otherFunctions ?? []),
    ]);

    new cdk.CfnOutput(this, 'ApiEndpoint', { value: this.httpApi.apiEndpoint });
  }

  /** The one dashboard the brief allows: enough to debug a Lambda at 11pm. */
  private dashboard(cluster: rds.DatabaseCluster, functions: lambda.IFunction[]): void {
    const period = cdk.Duration.minutes(5);
    const perFunction = (pick: (fn: lambda.IFunction) => cloudwatch.Metric) =>
      functions.map((fn) => pick(fn).with({ label: fn.node.id, period }));

    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${config.stackPrefix}`,
      defaultInterval: cdk.Duration.hours(6),
    });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda errors',
        width: 12,
        left: perFunction((fn) => fn.metricErrors({ statistic: 'Sum' })),
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda duration p95 (ms)',
        width: 12,
        left: perFunction((fn) => fn.metricDuration({ statistic: 'p95' })),
      }),
    );
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API requests and errors',
        width: 12,
        left: [
          this.httpApi.metricCount({ statistic: 'Sum', period, label: 'requests' }),
          this.httpApi.metricClientError({ statistic: 'Sum', period, label: '4xx' }),
          this.httpApi.metricServerError({ statistic: 'Sum', period, label: '5xx' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Aurora capacity',
        width: 12,
        left: [cluster.metricServerlessDatabaseCapacity({ period, label: 'ACU' })],
        right: [cluster.metricACUUtilization({ period, label: 'ACU utilization %' })],
      }),
    );
  }
}
