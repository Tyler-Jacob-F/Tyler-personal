import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * The two API keys the licensed translations need (docs/runbooks/scripture-keys.md):
 * SecureString parameters Tyler puts in SSM by hand, named by the environment, read once
 * per Lambda life. Neither is ever in code, CDK output or a log. A missing parameter is
 * not an error here: the source reports the translation as not set up, and the page says
 * so.
 */
export interface ScriptureKeys {
  esv?: string;
  apiBible?: string;
}

export type KeySource = () => Promise<ScriptureKeys>;

export const ESV_KEY_PARAMETER = 'ESV_KEY_PARAMETER';
export const API_BIBLE_KEY_PARAMETER = 'API_BIBLE_KEY_PARAMETER';

let cached: Promise<ScriptureKeys> | undefined;

export function keysFromSsm(env: NodeJS.ProcessEnv = process.env): KeySource {
  return () => {
    cached ??= read(env).catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
    return cached;
  };
}

async function read(env: NodeJS.ProcessEnv): Promise<ScriptureKeys> {
  const names = [env[ESV_KEY_PARAMETER], env[API_BIBLE_KEY_PARAMETER]].filter((n): n is string =>
    Boolean(n),
  );
  if (names.length === 0) return {};
  const client = new SSMClient({});
  const result = await client.send(
    new GetParametersCommand({ Names: names, WithDecryption: true }),
  );
  const byName = new Map((result.Parameters ?? []).map((p) => [p.Name, p.Value]));
  const value = (name: string | undefined) =>
    name ? byName.get(name)?.trim() || undefined : undefined;
  return { esv: value(env[ESV_KEY_PARAMETER]), apiBible: value(env[API_BIBLE_KEY_PARAMETER]) };
}
