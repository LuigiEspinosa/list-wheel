// `ops/deploy-remote.sh` is this application's deploy on the box and, once the Operator applies Pending
// Operator action 9 of `ops/contract-serving.md` in LuigiEspinosa/cuatro-portfolio, the forced command of
// the deploy key (DW-94, Operator ruling 2026-09-24). Nothing deploys before a push to `main`, so its
// contract is asserted here as the Anchor's `ops/__tests__/deploy-remote.test.ts` asserts its own: the
// real script runs under bash against a scratch git repository standing in for GitHub and the box, with a
// stub `docker` first on PATH, in both of the ways the box can run it. `.github/workflows/deploy.yml` is
// read below as the data it is, since nothing executes it before it reaches `main` either.
//
// Karma runs in a browser and reaches neither a file nor bash, so this file runs under `node --test`, the
// standard library's runner, as the last step of the workflow's `test` job, and adds no dependency. Run it
// with `node --test ops/deploy-remote.test.mjs`: it needs bash and git, and on Windows it uses WSL's bash.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(REPO_ROOT, 'ops', 'deploy-remote.sh');
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'deploy.yml');
// CRLF normalised, since a Windows checkout holds the workflow with CRLF endings.
const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '');

// On Windows `bash` is WSL's and reads `/mnt/c/...` paths, and it is named absolutely because the PATH
// handed to the child is a POSIX one. CI is `ubuntu-latest`.
const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();
const posix = (path) =>
  process.platform === 'win32'
    ? path.replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : path;
const quote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
const POSIX_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

// A launcher script carries the environment, because WSL hands a Windows variable to the Linux side only
// when `WSLENV` names it. Every inherited `GIT_*` variable is dropped first, so a run started from inside a
// git hook cannot point a scratch repository's `git reset --hard` at this one.
const runLauncher = (path, lines) => {
  const preamble = [
    '#!/usr/bin/env bash',
    'for name in $(compgen -e | grep "^GIT_"); do unset "$name"; done',
    'unset SSH_ORIGINAL_COMMAND',
  ];
  writeFileSync(path, [...preamble, ...lines, ''].join('\n'));
  chmodSync(path, 0o755);
  const run = spawnSync(BASH, [posix(path)], { encoding: 'utf8' });
  if (run.error) throw run.error;
  return run;
};

// ---------------------------------------------------------------------------
// The workflow, read as data: its jobs, their steps, and the one string the box is sent
// ---------------------------------------------------------------------------

// Comments discuss `if:`, `reset` and `continue-on-error` by name, so everything below reads
// instructions, not prose.
const instructions = read(WORKFLOW)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

/** Each job under `jobs:`, by name, as the text beneath its key. */
const jobs = (() => {
  const found = {};
  const at = instructions.indexOf('\njobs:\n');
  if (at === -1) return found;
  let name = null;
  for (const line of instructions.slice(at + '\njobs:\n'.length).split('\n')) {
    const key = /^ {2}([\w-]+):\s*$/.exec(line);
    if (key) {
      name = key[1];
      found[name] = '';
    } else if (/^\S/.test(line)) {
      break;
    } else if (name !== null) {
      found[name] += `${line}\n`;
    }
  }
  return found;
})();

/** One job's steps, each trimmed to start at its `- `. */
const stepsOf = (job) => {
  const text = jobs[job] ?? '';
  const at = text.indexOf('    steps:\n');
  if (at === -1) return [];
  return text
    .slice(at + '    steps:\n'.length)
    .split(/\n(?= {6}- )/)
    .map((step) => step.trim())
    .filter(Boolean);
};
const runOf = (step) => /^\s*(?:- )?run: (.+)$/m.exec(step)?.[1];

const SHA_EXPRESSION = '${{ github.sha }}';

/** The SSH step's `script: >-` block, folded the way YAML folds it: one line, joined by spaces. */
const commandTemplate = (() => {
  const lines = (jobs.deploy ?? '').split('\n');
  const at = lines.findIndex((line) => /^\s+script: >-$/.test(line));
  if (at === -1) return '';
  const indent = lines[at].search(/\S/);
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '' || line.search(/\S/) <= indent) break;
    body.push(line.trim());
  }
  return body.join(' ');
})();
const commandFor = (sha) => commandTemplate.split(SHA_EXPRESSION).join(sha);

/** The forced command the script's header gives for the key's `authorized_keys` line. */
const FORCED_COMMAND = /restrict,command="([^"]+)"/.exec(read(SCRIPT))?.[1] ?? '';

/**
 * Every `permissions:` key, top-level (column 0) or not (a job's), with its entries: the `scope: level`
 * lines beneath it, or its inline value (`write-all`, `{ contents: write }`) as the one entry.
 */
const permissionBlocks = (text, where) => {
  const lines = text.split('\n');
  return lines.flatMap((line, at) => {
    const key = /^(\s*)permissions\s*:\s*(.*)$/.exec(line);
    if (!key || (key[1] === '') !== (where === 'top')) return [];
    if (key[2] !== '') return [[key[2]]];
    const entries = [];
    for (const next of lines.slice(at + 1)) {
      if (next.trim() === '' || next.search(/\S/) <= key[1].length) break;
      entries.push(next.trim());
    }
    return [entries];
  });
};

// GitHub's own actions stay on tags by the ruling, and a local action (`./...`) is this repository's code.
const EXEMPT = /^(actions\/|github\/|\.\/)/;

/** Every `uses:` outside the exempt set that is not `@<40 hex> # vX.Y.Z`. */
const unpinned = (text) =>
  [...text.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)]
    .filter(([, ref, rest]) => !EXEMPT.test(ref) && !(/@[0-9a-f]{40}$/.test(ref) && /^ # v\d+\.\d+\.\d+$/.test(rest)))
    .map(([, ref]) => ref);

// ---------------------------------------------------------------------------
// A scratch origin: A has no script (the box before this change), B to D carry it, X is off `main`.
// A box is cloned from a snapshot of the origin as it stood when the box last deployed, so its
// `origin/main` is stale and the commits after it are absent until the script's own fetch, as on the box.
// ---------------------------------------------------------------------------

const ROOT = mkdtempSync(join(tmpdir(), 'list-wheel-deploy-remote-'));
const ORIGIN = join(ROOT, 'origin.git');
const SNAPSHOT = { A: join(ROOT, 'origin-at-A.git'), B: join(ROOT, 'origin-at-B.git') };
const shas = { A: '', B: '', C: '', D: '', X: '' };
let caseCount = 0;

after(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    // A temp root that will not delete is not a failure of the script under test.
  }
});

/**
 * A fresh box cloned from the `start` snapshot (`A`, before the script existed, or `B`), one session run
 * from its home as sshd starts one, and what the session left behind. `bootstrap`: the login shell runs
 * `command`, as it does while the key is unrestricted. `forced`: the header's forced command runs with
 * `command` in SSH_ORIGINAL_COMMAND, unset when it is absent.
 */
const deploy = ({ start, mode, command, dockerExit = 0 }) => {
  const home = join(ROOT, `case-${(caseCount += 1)}`);
  mkdirSync(home);
  const session =
    mode === 'bootstrap'
      ? `/bin/bash -c ${quote(command ?? '')}`
      : `${command === undefined ? '' : `SSH_ORIGINAL_COMMAND=${quote(command)} `}/bin/bash -c ${quote(
          FORCED_COMMAND.replace('/home/deploy/', `${posix(home)}/`)
        )}`;
  const run = runLauncher(join(ROOT, `case-${caseCount}.sh`), [
    `export HOME=${quote(posix(home))} GIT_CONFIG_NOSYSTEM=1`,
    `export PATH=${quote(`${posix(join(ROOT, 'bin'))}:${POSIX_PATH}`)}`,
    `export DOCKER_LOG="$HOME/docker.log" STUB_DOCKER_EXIT=${dockerExit}`,
    `git clone -q ${quote(posix(SNAPSHOT[start]))} "$HOME/list-wheel" || exit 90`,
    `git -C "$HOME/list-wheel" remote set-url origin ${quote(posix(ORIGIN))} || exit 90`,
    'cd "$HOME"',
    `${session} > "$HOME/out" 2> "$HOME/err"`,
    'echo "$?" > "$HOME/status"',
    'git -C "$HOME/list-wheel" rev-parse HEAD > "$HOME/head"',
  ]);
  if (run.status !== 0) throw new Error(`the scratch box could not be prepared (exit ${run.status}): ${run.stderr}`);
  const output = (name) => (existsSync(join(home, name)) ? readFileSync(join(home, name), 'utf8') : '');
  return {
    status: Number(output('status').trim()),
    stdout: output('out'),
    stderr: output('err'),
    head: output('head').trim(),
    docker: output('docker.log').split('\n').filter(Boolean),
  };
};

const COMPOSE = '/list-wheel|compose up --build -d --remove-orphans';

describe('the two strings the box is handed', () => {
  it('names this script as the forced command, at the checkout it deploys', () => {
    assert.ok(existsSync(SCRIPT), 'ops/deploy-remote.sh is missing');
    assert.equal(FORCED_COMMAND, '/bin/bash /home/deploy/list-wheel/ops/deploy-remote.sh');
  });

  it("ends the workflow's one command string with the pushed sha, the one word the forced script reads", () => {
    assert.notEqual(commandTemplate, '', 'the SSH step carries no `script: >-` block');
    assert.ok(commandTemplate.startsWith('cd ~/list-wheel && '), commandTemplate);
    assert.ok(commandTemplate.endsWith(` ${SHA_EXPRESSION}`), commandTemplate);
    assert.equal(commandTemplate.split(SHA_EXPRESSION).length, 3);
    assert.ok(commandTemplate.includes(`git show ${SHA_EXPRESSION}:ops/deploy-remote.sh`), commandTemplate);
    // The reset is the script's, to the sha it validated; the string itself never resets anything.
    assert.ok(!commandTemplate.includes('reset'), commandTemplate);
  });
});

describe('ops/deploy-remote.sh, as the box runs it', () => {
  // The scratch origin is built once, for these cases only, so a failure to build it cannot mask the
  // wiring cases.
  before(() => {
    mkdirSync(join(ROOT, 'bin'));
    // Records where it ran and with what, and exits with whatever the case asks for.
    writeFileSync(
      join(ROOT, 'bin', 'docker'),
      ['#!/bin/sh', 'printf "%s|%s\\n" "$PWD" "$*" >> "$DOCKER_LOG"', 'exit "${STUB_DOCKER_EXIT:-0}"', ''].join('\n')
    );
    chmodSync(join(ROOT, 'bin', 'docker'), 0o755);
    const seed = posix(join(ROOT, 'seed'));
    const setup = runLauncher(join(ROOT, 'setup.sh'), [
      'set -euo pipefail',
      `export HOME=${quote(posix(join(ROOT, 'setup-home')))} GIT_CONFIG_NOSYSTEM=1`,
      'export GIT_AUTHOR_NAME=deploy-remote GIT_AUTHOR_EMAIL=deploy-remote@example.invalid',
      'export GIT_COMMITTER_NAME=deploy-remote GIT_COMMITTER_EMAIL=deploy-remote@example.invalid',
      'mkdir -p "$HOME"',
      `git init -q --bare -b main ${quote(posix(ORIGIN))}`,
      `git init -q -b main ${quote(seed)} && cd ${quote(seed)}`,
      `git remote add origin ${quote(posix(ORIGIN))}`,
      `commit() { printf '%s\\n' "$1" > marker; git add -A; git commit -qm "$1"; git rev-parse HEAD; }`,
      'commit A',
      'git push -q origin main',
      `git clone -q --bare ${quote(posix(ORIGIN))} ${quote(posix(SNAPSHOT.A))}`,
      `mkdir ops && cp ${quote(posix(SCRIPT))} ops/deploy-remote.sh`,
      'commit B',
      'git push -q origin main',
      'git checkout -q -b side',
      'commit X',
      'git push -q origin side',
      `git clone -q --bare ${quote(posix(ORIGIN))} ${quote(posix(SNAPSHOT.B))}`,
      'git checkout -q main',
      'commit C',
      'commit D',
      'git push -q origin main',
    ]);
    const printed = setup.stdout.trim().split('\n');
    if (setup.status !== 0 || printed.length !== 5) {
      throw new Error(`the scratch origin could not be built (exit ${setup.status}): ${setup.stderr}`);
    }
    [shas.A, shas.B, shas.X, shas.C, shas.D] = printed;
  });

  // The first deploy after the push: the checkout is at a commit that has no script and has never seen the
  // target, the key is not yet restricted, and the login shell runs the string, which fetches the target
  // and brings the script in from it.
  it('deploys from a checkout that has no script yet, through an unrestricted shell', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D) });
    assert.ok(!box.stderr.includes('refused'), box.stderr);
    assert.equal(box.status, 0, box.stderr);
    assert.equal(box.head, shas.D);
    assert.equal(box.docker.length, 1);
    assert.ok(box.docker[0].endsWith(COMPOSE), box.docker[0]);
    assert.ok(box.stdout.includes(`deploying ${shas.D}, read from its argument`), box.stdout);
  });

  // The box's `origin/main` is still B here, so this also shows the script's fetch moving it: without that,
  // D is no ancestor of B and the deploy is refused.
  it('deploys through the forced command, reading the sha from SSH_ORIGINAL_COMMAND', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D) });
    assert.equal(box.status, 0, box.stderr);
    assert.equal(box.head, shas.D);
    assert.equal(box.docker.length, 1);
    assert.ok(box.docker[0].endsWith(COMPOSE), box.docker[0]);
    assert.ok(box.stdout.includes(`deploying ${shas.D}, read from SSH_ORIGINAL_COMMAND`), box.stdout);
  });

  // DW-93: the old step reset to `origin/main`, so a run whose `main` had moved on deployed a commit its
  // own gate step never checked. The script resets to the sha it was given.
  it('resets to the pushed sha when main has moved on, not to origin/main', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.C) });
    assert.equal(box.status, 0, box.stderr);
    assert.equal(box.head, shas.C);
    assert.equal(box.docker.length, 1);
  });

  // The inputs are functions because the shas exist only once `before` has run.
  for (const [label, input] of [
    ['an interactive session, which sends no command', () => undefined],
    ['a command of its own', () => 'id'],
    ['an upper-case sha', () => shas.D.toUpperCase()],
    ['a short sha', () => shas.D.slice(0, 7)],
    ['a sha with a command glued on', () => `${shas.D};id`],
  ]) {
    it(`refuses ${label} before touching git or docker`, () => {
      const box = deploy({ start: 'B', mode: 'forced', command: input() });
      assert.equal(box.status, 1);
      assert.ok(box.stderr.includes('deploy-remote: refused'), box.stderr);
      assert.equal(box.head, shas.B);
      assert.deepEqual(box.docker, []);
    });
  }

  for (const [label, sha] of [
    // The box has fetched `side` before, so X is an object it holds, and the refusal is the ancestry's.
    ['a commit on another branch', () => shas.X],
    ['a sha no repository has', () => '0123456789abcdef0123456789abcdef01234567'],
  ]) {
    it(`refuses ${label} after the fetch, leaving the checkout where it was`, () => {
      const target = sha();
      const box = deploy({ start: 'B', mode: 'forced', command: commandFor(target) });
      assert.equal(box.status, 1);
      assert.ok(box.stderr.includes(`deploy-remote: refused: ${target} is not on origin/main`), box.stderr);
      assert.equal(box.head, shas.B);
      assert.deepEqual(box.docker, []);
    });
  }

  // DW-131: A is on `main` but predates the script, so a reset to it would delete the file the key's forced
  // command names, and every later deploy would fail until the checkout was repaired by hand.
  it('refuses a commit on main that predates the script, leaving the checkout where it was', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.A) });
    assert.equal(box.status, 1);
    assert.ok(box.stderr.includes(`deploy-remote: refused: ${shas.A} carries no ops/deploy-remote.sh`), box.stderr);
    assert.equal(box.head, shas.B);
    assert.deepEqual(box.docker, []);
  });

  // The workflow sees only the SSH step's exit status, so a failed compose has to reach it through the
  // login shell, which is what fails the job and runs the report (DW-20).
  it('fails the session when compose fails, after the reset', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D), dockerExit: 1 });
    assert.notEqual(box.status, 0);
    assert.equal(box.head, shas.D);
    assert.equal(box.docker.length, 1);
  });
});

// ---------------------------------------------------------------------------
// The workflow's wiring (DW-90, DW-93, DW-20, DW-87)
// ---------------------------------------------------------------------------

describe('the deploy workflow', () => {
  it('deploys on a push to main that changes more than Markdown, and on dispatch', () => {
    assert.match(
      instructions,
      /^on:\n {2}push:\n {4}branches: \[main\]\n {4}paths-ignore:\n {6}- '\*\*\.md'\n {2}workflow_dispatch:\n\n/m
    );
  });

  it('runs one deploy at a time and cancels none in flight', () => {
    assert.match(instructions, /^concurrency:\n {2}group: deploy\n {2}cancel-in-progress: false\n/m);
  });

  // DW-90: `main` is unprotected, so the `needs:` below is the gate, not a required check.
  it('runs the suite, then this file, in a test job on Node 22', () => {
    const steps = stepsOf('test');
    assert.deepEqual(steps.map(runOf), [undefined, undefined, 'npm ci', 'npm test', 'node --test ops/deploy-remote.test.mjs']);
    assert.match(steps[0], /^- uses: actions\/checkout@\S+$/);
    assert.match(steps[1], /^- uses: actions\/setup-node@\S+\n\s+with:\n\s+node-version: 22$/);
  });

  it('deploys only once the test job has passed', () => {
    assert.match(jobs.deploy ?? '', /^ {4}needs: test$/m);
  });

  it('refuses any ref but main in the deploy job, before anything else runs', () => {
    assert.equal(stepsOf('deploy')[0], '- name: Refuse any ref but main\n        run: test "$GITHUB_REF" = refs/heads/main');
  });

  // AD-9 and AD-21: the gate is blocking and runs before the placement it guards.
  it('runs the Capacity Gate for list-wheel before the SSH step', () => {
    const deployJob = jobs.deploy ?? '';
    const gate = deployJob.indexOf('run: node cuatro-portfolio/ops/capacity-gate.mjs list-wheel\n');
    assert.ok(gate > -1, 'the deploy job runs no Capacity Gate for list-wheel');
    assert.ok(gate < deployJob.indexOf('uses: appleboy/ssh-action@'), 'the gate does not precede the SSH step');
  });

  // One condition is allowed, the report's, and it deploys nothing; nothing is downgraded to a warning.
  it('conditions nothing but the failure report, and softens no step', () => {
    assert.doesNotMatch(instructions, /continue-on-error\s*:/);
    assert.doesNotMatch(instructions, /\|\|\s*true/);
    const conditions = [...instructions.matchAll(/^\s+if\s*:\s*(.*)$/gm)].map((match) => match[1].trim());
    assert.deepEqual(conditions, ['failure()']);
  });

  // DW-20. A red suite skips `deploy`, and a step inside `deploy` would then never run, so the report is a
  // job of its own that needs both, and `failure()` there reads either one failing.
  it('opens an issue when the test or the deploy job failed, and only then', () => {
    const report = jobs.report ?? '';
    assert.match(report, /^ {4}needs: \[test, deploy\]$/m);
    assert.match(report, /^ {4}if: failure\(\)$/m);
    assert.match(report, /^\s+GH_TOKEN: \$\{\{ github\.token \}\}$/m);
    assert.match(report, /^\s+gh issue create --repo "\$GITHUB_REPOSITORY" \\$/m);
  });

  // DW-87.
  it('narrows the token to contents: read at the top', () => {
    assert.deepEqual(permissionBlocks(instructions, 'top'), [['contents: read']]);
  });

  it('widens it for one job only, the report, by issues: write', () => {
    assert.deepEqual(permissionBlocks(instructions, 'job'), [['issues: write']]);
    assert.match(jobs.report ?? '', /^ {4}permissions:\n {6}issues: write$/m);
  });

  it('pins every third-party action to a commit, with its tag in a comment', () => {
    assert.deepEqual(unpinned(instructions), []);
    assert.match(jobs.deploy ?? '', /uses: appleboy\/ssh-action@[0-9a-f]{40} # v\d+\.\d+\.\d+$/m);
  });
});

// The readers decide the cases above, so each is shown refusing planted text as well as passing the file;
// a reader that returned nothing would otherwise read as a clean workflow.
describe('the readers, on planted text', () => {
  it('finds no top-level block where none is declared, and reads an inline value as the entry', () => {
    const planted = ['on: push', '', 'jobs:', '  build:', '    permissions: write-all', ''].join('\n');
    assert.deepEqual(permissionBlocks(planted, 'top'), []);
    assert.deepEqual(permissionBlocks(planted, 'job'), [['write-all']]);
  });

  it('refuses a third-party action on a tag or without its tag comment, and passes GitHub and local actions', () => {
    const planted = [
      '      - uses: actions/checkout@v7',
      '      - uses: ./.github/actions/local',
      '      - uses: appleboy/ssh-action@v1',
      '        uses: appleboy/ssh-action@0ff4204d59e8e51228ff73bce53f80d53301dee2',
      '      - uses: appleboy/ssh-action@0ff4204d59e8e51228ff73bce53f80d53301dee2 # v1.2.5',
    ].join('\n');
    assert.deepEqual(unpinned(planted), [
      'appleboy/ssh-action@v1',
      'appleboy/ssh-action@0ff4204d59e8e51228ff73bce53f80d53301dee2',
    ]);
  });
});
