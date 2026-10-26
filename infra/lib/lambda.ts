import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/api');

export interface ApiFunctionProps {
  /** Path under apps/api/src, e.g. `auth/define-auth-challenge.ts`. */
  entry: string;
  description: string;
  environment?: Record<string, string>;
  memorySize?: number;
  timeout?: cdk.Duration;
}

/**
 * Every Lambda in the project: Node 22 on arm64, bundled by esbuild as ESM with the SDK
 * included (so what tests ran is what deploys), structured JSON logs kept for a month.
 */
export function apiFunction(scope: Construct, id: string, props: ApiFunctionProps): NodejsFunction {
  const logGroup = new logs.LogGroup(scope, `${id}Logs`, {
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });
  return new NodejsFunction(scope, id, {
    description: props.description,
    entry: path.join(apiRoot, 'src', props.entry),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: props.memorySize ?? 512,
    timeout: props.timeout ?? cdk.Duration.seconds(10),
    logGroup,
    environment: { NODE_OPTIONS: '--enable-source-maps', ...props.environment },
    bundling: {
      format: OutputFormat.ESM,
      target: 'node22',
      mainFields: ['module', 'main'],
      externalModules: [],
      minify: false,
      sourceMap: true,
      // ESM bundles of CommonJS dependencies still reach for require().
      banner:
        "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
}
