import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
  HttpUserPoolAuthorizer,
} from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
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
  /** The co-leads' client, whose JWTs the same authorizer accepts. */
  groupClient?: cognito.IUserPoolClient;
  /** Other functions (the Cognito triggers) to show on the dashboard. */
  otherFunctions?: lambda.IFunction[];
}

/**
 * The HTTP API: a Cognito JWT authorizer in front of one Lambda per resource, a second
 * door for agents at `/api/agent/*` where a Lambda authorizer looks the bearer token up and
 * the same Lambdas answer, and a third for the group's devices at `/api/group/*` where
 * another Lambda authorizer looks the device token up. Every route lives under /api so
 * CloudFront can forward that prefix unchanged. Lambdas reach the database through the
 * Data API, so none is in the VPC.
 */
export class ApiStack extends cdk.Stack {
  readonly httpApi: apigwv2.HttpApi;
  /** Hostname of the API's default endpoint, for the CloudFront origin. */
  readonly apiDomainName: string;
  readonly functions: Record<
    | 'me'
    | 'documents'
    | 'versions'
    | 'adminTokens'
    | 'adminActivity'
    | 'agentAuthorizer'
    | 'mcp'
    | 'groupAuthorizer'
    | 'groupEnter'
    | 'adminGroupLink'
    | 'members'
    | 'claims',
    lambda.IFunction
  >;
  /** The agents' door, for the MCP route to share. */
  readonly agentAuthorizer: HttpLambdaAuthorizer;
  /** The group's door. */
  readonly groupAuthorizer: HttpLambdaAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { cluster, userPool, userPoolClient, groupClient } = props;
    const siteOrigin = `https://${config.domainName}`;
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
    const adminActivity = apiFunction(this, 'AdminActivityFunction', {
      entry: 'handlers/admin-activity.ts',
      description: `${config.siteName}: /api/admin/activity, what the agents wrote (admin only)`,
      environment,
      timeout,
    });
    const agentAuthorizerFn = apiFunction(this, 'AgentAuthorizerFunction', {
      entry: 'auth/agent-authorizer.ts',
      description: `${config.siteName}: agent token authorizer for /api/agent/* and /mcp`,
      environment,
      timeout,
    });
    const mcp = apiFunction(this, 'McpFunction', {
      entry: 'handlers/mcp.ts',
      description: `${config.siteName}: MCP server at /mcp (Streamable HTTP, stateless)`,
      environment,
      timeout,
    });
    const groupAuthorizerFn = apiFunction(this, 'GroupAuthorizerFunction', {
      entry: 'auth/group-authorizer.ts',
      description: `${config.siteName}: device token authorizer for /api/group/*`,
      environment,
      timeout,
    });
    const groupEnter = apiFunction(this, 'GroupEnterFunction', {
      entry: 'handlers/group-enter.ts',
      description: `${config.siteName}: POST /api/group/enter, the group link becomes a device token`,
      environment,
      timeout,
    });
    const adminGroupLink = apiFunction(this, 'AdminGroupLinkFunction', {
      entry: 'handlers/admin-group-link.ts',
      description: `${config.siteName}: /api/admin/group-link, mint and rotate (admin and co-leads)`,
      environment: { ...environment, SITE_ORIGIN: siteOrigin },
      timeout,
    });
    const members = apiFunction(this, 'MembersFunction', {
      entry: 'handlers/members.ts',
      description: `${config.siteName}: /api/members and /api/group/members, the directory, claims and co-leads`,
      environment: { ...environment, USER_POOL_ID: userPool.userPoolId },
      timeout,
    });
    // Making a co-lead creates their Cognito user and asks SES to verify their address (the
    // sandbox delivers only to verified recipients, and creating the identity is what sends
    // Amazon's verification mail). Nothing else in the API touches the pool or SES identities.
    userPool.grant(members, 'cognito-idp:AdminCreateUser');
    members.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:CreateEmailIdentity'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      }),
    );
    const claims = apiFunction(this, 'ClaimsFunction', {
      entry: 'handlers/claims.ts',
      description: `${config.siteName}: /api/documents/{id}/claims, slots taken on a sign-up`,
      environment,
      timeout,
    });
    this.functions = {
      me,
      documents,
      versions,
      adminTokens,
      adminActivity,
      agentAuthorizer: agentAuthorizerFn,
      mcp,
      groupAuthorizer: groupAuthorizerFn,
      groupEnter,
      adminGroupLink,
      members,
      claims,
    };
    for (const fn of Object.values(this.functions)) cluster.grantDataApiAccess(fn);

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: groupClient ? [userPoolClient, groupClient] : [userPoolClient],
    });
    // Simple responses. The identity source stays `Authorization` so a request with no
    // header at all gets the gateway's 401, which is what MCP clients (and claude.ai's
    // connector dialog) read as "needs a credential"; a simple-response deny is a 403, which
    // they read as "no server here". The token itself may arrive in `Authorization` (Claude
    // Code, curl) or in `X-Keep-Token` (Cowork, whose platform writes its own
    // Authorization), so results are not cached: a cache keyed on one header would serve
    // the other's answer. A revoke therefore takes effect at once and `last_used_at` is
    // exact; the cost is one hash lookup per request.
    this.agentAuthorizer = new HttpLambdaAuthorizer('AgentAuthorizer', agentAuthorizerFn, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: ['$request.header.Authorization'],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    // The group's door: the same shape, for the same reasons. No cache, so clearing a lost
    // phone's device refuses it on its next request; `Authorization` as the identity source,
    // so a request with no token gets the gateway's 401 and the client asks for the link.
    this.groupAuthorizer = new HttpLambdaAuthorizer('GroupAuthorizer', groupAuthorizerFn, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: ['$request.header.Authorization'],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `${config.stackPrefix}Api`,
      description: `${config.siteName} API (${config.domainName}/api)`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    const { GET, POST, PUT, PATCH, DELETE, ANY } = apigwv2.HttpMethod;
    const routes: Array<[string, apigwv2.HttpMethod[], lambda.IFunction]> = [
      ['/api/me', [GET], me],
      ['/api/documents', [GET, POST], documents],
      ['/api/documents/search', [GET], documents],
      ['/api/documents/{id}', [GET, DELETE], documents],
      ['/api/documents/{id}/tags', [PUT], documents],
      ['/api/documents/{id}/versions', [GET, POST], versions],
      ['/api/documents/{id}/versions/{number}', [GET], versions],
      ['/api/documents/{id}/diff', [GET], versions],
      ['/api/admin/tokens', [GET, POST], adminTokens],
      ['/api/admin/tokens/{id}', [PATCH, DELETE], adminTokens],
      ['/api/admin/activity', [GET], adminActivity],
      ['/api/admin/group-link', [GET, POST], adminGroupLink],
      ['/api/members', [GET, POST], members],
      ['/api/members/{id}', [GET, PATCH], members],
      ['/api/members/{id}/devices', [DELETE], members],
      ['/api/members/{id}/colead', [POST], members],
      ['/api/documents/{id}/claims', [GET, POST], claims],
      ['/api/documents/{id}/claims/{claimId}', [DELETE], claims],
    ];
    // The group's door: what a device may reach. Reads of documents, its own caller, the
    // directory and its own row, a name to claim, and the slots on a sign-up. Nothing
    // under /api/admin and no document write.
    const groupRoutes: Array<[string, apigwv2.HttpMethod[], lambda.IFunction]> = [
      ['/api/group/me', [GET], me],
      ['/api/group/documents', [GET], documents],
      ['/api/group/documents/search', [GET], documents],
      ['/api/group/documents/{id}', [GET], documents],
      ['/api/group/members', [GET], members],
      ['/api/group/members/{id}', [GET, PATCH], members],
      ['/api/group/members/{id}/claim', [POST], members],
      ['/api/group/documents/{id}/claims', [GET, POST], claims],
      ['/api/group/documents/{id}/claims/{claimId}', [DELETE], claims],
    ];
    // The agents' door mirrors the document routes, minus delete: no agent deletes.
    const agentRoutes: Array<[string, apigwv2.HttpMethod[], lambda.IFunction]> = [
      ['/api/agent/documents', [GET, POST], documents],
      ['/api/agent/documents/search', [GET], documents],
      ['/api/agent/documents/{id}', [GET], documents],
      ['/api/agent/documents/{id}/tags', [PUT], documents],
      ['/api/agent/documents/{id}/versions', [GET, POST], versions],
      ['/api/agent/documents/{id}/versions/{number}', [GET], versions],
      ['/api/agent/documents/{id}/diff', [GET], versions],
      // The seed from the Google Sheet (docs/runbooks/seed-the-sheet.md): a sheet's claims
      // and the directory to match names against, behind write:signups and read:members.
      ['/api/agent/documents/{id}/claims', [GET, POST], claims],
      ['/api/agent/members', [GET], members],
      // One MCP endpoint, same door. Streamable HTTP uses POST for messages; GET and
      // DELETE get the transport's 405 in stateless mode.
      ['/mcp', [ANY], mcp],
    ];
    for (const [path, methods, fn] of routes) {
      this.httpApi.addRoutes({
        path,
        methods,
        integration: new HttpLambdaIntegration(`${fn.node.id}${path.replace(/[^a-z]/gi, '')}`, fn),
      });
    }
    for (const [path, methods, fn] of agentRoutes) {
      this.httpApi.addRoutes({
        path,
        methods,
        integration: new HttpLambdaIntegration(`${fn.node.id}${path.replace(/[^a-z]/gi, '')}`, fn),
        authorizer: this.agentAuthorizer,
      });
    }
    for (const [path, methods, fn] of groupRoutes) {
      this.httpApi.addRoutes({
        path,
        methods,
        integration: new HttpLambdaIntegration(`${fn.node.id}${path.replace(/[^a-z]/gi, '')}`, fn),
        authorizer: this.groupAuthorizer,
      });
    }
    // The one open route: a device has nothing to present until it has been through it.
    // The link's token travels in the body and is checked by the handler against its hash.
    this.httpApi.addRoutes({
      path: '/api/group/enter',
      methods: [POST],
      integration: new HttpLambdaIntegration('GroupEnterFunctionapigroupenter', groupEnter),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });

    // https://abc123.execute-api.us-east-1.amazonaws.com -> abc123.execute-api.us-east-1.amazonaws.com
    this.apiDomainName = cdk.Fn.select(2, cdk.Fn.split('/', this.httpApi.apiEndpoint));

    this.dashboard(cluster, [...Object.values(this.functions), ...(props.otherFunctions ?? [])]);

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
