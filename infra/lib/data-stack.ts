import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { config } from './config.js';

/**
 * The database: Aurora Serverless v2 (PostgreSQL 16) that pauses at 0 ACU, reached only
 * through the RDS Data API. Nothing else lives in the VPC, so it has isolated subnets and
 * no NAT gateway; Lambdas stay outside it (docs/phases/01-spine.md "Decided").
 */
export class DataStack extends cdk.Stack {
  readonly cluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Fixed AZs so synth needs no account lookup (the PR role runs `cdk diff` offline).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      availabilityZones: [`${config.env.region}a`, `${config.env.region}b`],
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      restrictDefaultSecurityGroup: false,
    });

    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_9,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      writer: rds.ClusterInstance.serverlessV2('Writer', { publiclyAccessible: false }),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      serverlessV2AutoPauseDuration: cdk.Duration.minutes(5),
      enableDataApi: true,
      defaultDatabaseName: config.database.name,
      credentials: rds.Credentials.fromGeneratedSecret('thekeep_admin'),
      storageEncrypted: true,
      backup: { retention: cdk.Duration.days(7) },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const secret = this.cluster.secret!;

    // CI runs migrations through the Data API with the deploy role from the account stack.
    // Granting from here means the account stack never needs a local redeploy for it.
    const deployRole = iam.Role.fromRoleName(this, 'DeployRole', config.roles.deploy, {
      mutable: true,
    });
    this.cluster.grantDataApiAccess(deployRole);

    const { ssmPrefix, name } = config.database;
    new ssm.StringParameter(this, 'ClusterArnParameter', {
      parameterName: `${ssmPrefix}/cluster-arn`,
      stringValue: this.cluster.clusterArn,
    });
    new ssm.StringParameter(this, 'SecretArnParameter', {
      parameterName: `${ssmPrefix}/secret-arn`,
      stringValue: secret.secretArn,
    });
    new ssm.StringParameter(this, 'DatabaseNameParameter', {
      parameterName: `${ssmPrefix}/name`,
      stringValue: name,
    });

    new cdk.CfnOutput(this, 'ClusterArn', { value: this.cluster.clusterArn });
    new cdk.CfnOutput(this, 'SecretArn', { value: secret.secretArn });
    new cdk.CfnOutput(this, 'DatabaseName', { value: name });
  }
}
