import { createLogger } from '../src/lib/logger.js';

describe('logger', () => {
  it('writes one JSON line per entry with service, level and fields', () => {
    const lines: string[] = [];
    const log = createLogger('documents', { requestId: 'r1' }, (l) => lines.push(l));
    log.info('created', { documentId: 'd1' });
    log.child({ route: 'GET /x' }).error('boom', { error: new Error('bad') });
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!);
    expect(first).toMatchObject({
      level: 'info',
      service: 'documents',
      message: 'created',
      requestId: 'r1',
      documentId: 'd1',
    });
    expect(first.time).toMatch(/Z$/);
    const second = JSON.parse(lines[1]!);
    expect(second).toMatchObject({ level: 'error', route: 'GET /x' });
    expect(second.error).toMatchObject({ name: 'Error', message: 'bad' });
  });

  it('drops entries below LOG_LEVEL', () => {
    const lines: string[] = [];
    const previous = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';
    try {
      const log = createLogger('x', {}, (l) => lines.push(l));
      log.info('quiet');
      log.warn('loud');
    } finally {
      process.env.LOG_LEVEL = previous;
    }
    expect(lines).toHaveLength(1);
  });
});
