import { createDataApiClient, dataApiTargetFromEnv, withResumeRetry } from '../src/lib/data-api.js';

class NamedError extends Error {
  constructor(name: string, message = name) {
    super(message);
    this.name = name;
  }
}

describe('withResumeRetry', () => {
  const sleep = async () => {};

  it('retries while the cluster is resuming, then returns', async () => {
    let calls = 0;
    const result = await withResumeRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new NamedError('DatabaseResumingException');
        return 'ok';
      },
      { sleep, delayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('treats the legacy BadRequestException wording as resuming too', async () => {
    let calls = 0;
    await withResumeRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new NamedError('BadRequestException', 'Communications link failure');
      },
      { sleep, delayMs: 1 },
    );
    expect(calls).toBe(2);
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    await expect(
      withResumeRetry(
        async () => {
          calls += 1;
          throw new NamedError('BadRequestException', 'syntax error at or near');
        },
        { sleep, delayMs: 1 },
      ),
    ).rejects.toThrow(/syntax error/);
    expect(calls).toBe(1);
  });

  it('gives up after the wait budget', async () => {
    await expect(
      withResumeRetry(
        async () => {
          throw new NamedError('DatabaseResumingException');
        },
        { sleep, delayMs: 10, maxWaitMs: 25 },
      ),
    ).rejects.toThrow('DatabaseResumingException');
  });
});

describe('dataApiTargetFromEnv', () => {
  it('reads the three variables and fails loudly without them', () => {
    expect(dataApiTargetFromEnv({ DB_CLUSTER_ARN: 'c', DB_SECRET_ARN: 's', DB_NAME: 'd' })).toEqual(
      { resourceArn: 'c', secretArn: 's', database: 'd' },
    );
    expect(() => dataApiTargetFromEnv({})).toThrow(/DB_CLUSTER_ARN/);
  });
});

describe('createDataApiClient', () => {
  it('retries a command through the middleware while the cluster resumes', async () => {
    const client = createDataApiClient(
      { region: 'us-east-1' },
      { sleep: async () => {}, delayMs: 1 },
    );
    let calls = 0;
    client.middlewareStack.add(
      () => async () => {
        calls += 1;
        if (calls === 1) throw new NamedError('DatabaseResumingException');
        return { output: { records: [] }, response: {} } as never;
      },
      { step: 'initialize', name: 'fakeService', priority: 'low' },
    );
    const { ExecuteStatementCommand } = await import('@aws-sdk/client-rds-data');
    const out = await client.send(
      new ExecuteStatementCommand({ resourceArn: 'a', secretArn: 'b', sql: 'select 1' }),
    );
    expect(out.records).toEqual([]);
    expect(calls).toBe(2);
  });
});
