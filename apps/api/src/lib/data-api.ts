import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  type Field,
  RDSDataClient,
  type RDSDataClientConfig,
  RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data';

export interface DataApiTarget {
  resourceArn: string;
  secretArn: string;
  database: string;
}

/** Read the Data API target from the environment the CDK stacks set. */
export function dataApiTargetFromEnv(env: NodeJS.ProcessEnv = process.env): DataApiTarget {
  const resourceArn = env.DB_CLUSTER_ARN;
  const secretArn = env.DB_SECRET_ARN;
  const database = env.DB_NAME;
  if (!resourceArn || !secretArn || !database) {
    throw new Error('DB_CLUSTER_ARN, DB_SECRET_ARN and DB_NAME must be set');
  }
  return { resourceArn, secretArn, database };
}

function isResuming(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: string; message?: string };
  if (name === 'DatabaseResumingException') return true;
  // Older Data API builds surface a paused cluster as a BadRequestException.
  return name === 'BadRequestException' && /resum|communications link failure/i.test(message ?? '');
}

export interface ResumeRetryOptions {
  /** Total patience; an Aurora Serverless v2 resume from 0 ACU takes around 15 seconds. */
  maxWaitMs?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * The cluster pauses at 0 ACU when idle and the first call wakes it. Retry that one
 * failure mode with a steady backoff; everything else propagates untouched.
 */
export async function withResumeRetry<T>(
  fn: () => Promise<T>,
  { maxWaitMs = 45_000, delayMs = 2_000, sleep = defaultSleep }: ResumeRetryOptions = {},
): Promise<T> {
  const started = Date.now();
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!isResuming(error) || Date.now() - started + delayMs > maxWaitMs) throw error;
      await sleep(delayMs);
    }
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * An RDSDataClient that waits out a resuming cluster. A middleware at the initialize step
 * wraps every command, so Drizzle's Data API driver and the migration runner both get it.
 */
export function createDataApiClient(
  config: RDSDataClientConfig = {},
  retry: ResumeRetryOptions = {},
): RDSDataClient {
  const client = new RDSDataClient(config);
  client.middlewareStack.add((next) => (args) => withResumeRetry(() => next(args), retry), {
    step: 'initialize',
    name: 'waitForResumingCluster',
  });
  return client;
}

/** The handful of calls the migration runner needs, so tests can fake them. */
export interface SqlRunner {
  execute(sql: string, transactionId?: string): Promise<Field[][]>;
  begin(): Promise<string>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}

export function dataApiRunner(client: RDSDataClient, target: DataApiTarget): SqlRunner {
  return {
    async execute(sql, transactionId) {
      const out = await client.send(
        new ExecuteStatementCommand({
          ...target,
          sql,
          transactionId,
          includeResultMetadata: false,
        }),
      );
      return out.records ?? [];
    },
    async begin() {
      const out = await client.send(new BeginTransactionCommand(target));
      if (!out.transactionId) throw new Error('BeginTransaction returned no transactionId');
      return out.transactionId;
    },
    async commit(transactionId) {
      await client.send(
        new CommitTransactionCommand({
          resourceArn: target.resourceArn,
          secretArn: target.secretArn,
          transactionId,
        }),
      );
    },
    async rollback(transactionId) {
      await client.send(
        new RollbackTransactionCommand({
          resourceArn: target.resourceArn,
          secretArn: target.secretArn,
          transactionId,
        }),
      );
    },
  };
}
