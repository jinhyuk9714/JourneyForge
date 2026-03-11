// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { buildExecutionEnv, parsePathHelperOutput } from './commandEnv';

describe('commandEnv', () => {
  it('parses PATH from path_helper output', () => {
    expect(parsePathHelperOutput('PATH="/usr/bin:/bin:/opt/homebrew/bin"; export PATH;')).toBe(
      '/usr/bin:/bin:/opt/homebrew/bin',
    );
  });

  it('augments a sparse macOS PATH with path_helper paths', () => {
    const env = buildExecutionEnv(
      {
        BASE_URL: 'http://127.0.0.1:4173',
        PATH: '/usr/bin:/bin',
      },
      {
        platform: 'darwin',
        pathHelperOutput:
          'PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin"; export PATH;',
      },
    );

    expect(env.PATH).toBeTruthy();
    const paths = env.PATH!.split(':');

    expect(paths).toContain('/opt/homebrew/bin');
    expect(paths).toContain('/opt/homebrew/opt/node@22/bin');
    expect(paths).toContain('/usr/bin');
    expect(paths).toContain('/bin');
  });

  it('leaves non-macOS PATH values unchanged', () => {
    const env = buildExecutionEnv(
      {
        PATH: '/custom/bin:/usr/bin:/bin',
      },
      {
        platform: 'linux',
      },
    );

    expect(env.PATH).toBe('/custom/bin:/usr/bin:/bin');
  });
});
