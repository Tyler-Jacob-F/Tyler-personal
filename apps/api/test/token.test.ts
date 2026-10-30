import { createHash } from 'node:crypto';
import { agentTokenSecretSchema } from '@the-keep/shared';
import { generateAgentSecret, hashAgentSecret } from '../src/lib/token.js';

describe('agent secrets', () => {
  it('generates keep_ plus 43 base64url characters, fresh every time', () => {
    const a = generateAgentSecret();
    const b = generateAgentSecret();
    expect(agentTokenSecretSchema.parse(a)).toBe(a);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(48);
  });

  it('hashes with SHA-256 to 64 hex characters, deterministically', () => {
    const secret = generateAgentSecret();
    expect(hashAgentSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAgentSecret(secret)).toBe(hashAgentSecret(secret));
    expect(hashAgentSecret(secret)).not.toBe(hashAgentSecret(generateAgentSecret()));
    // A known vector, so a future change of algorithm or encoding fails loudly.
    expect(hashAgentSecret('keep_x')).toBe(createHash('sha256').update('keep_x').digest('hex'));
  });
});
