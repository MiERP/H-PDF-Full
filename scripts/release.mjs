#!/usr/bin/env node
/**
 * Release one desktop edition.
 *
 * One command does the whole chain, so the version and the installer can
 * never drift apart:
 *
 *   1. bump the version everywhere (scripts/version.mjs)
 *   2. typecheck and test
 *   3. build the Windows installer/portable
 *   4. commit the version files
 *   5. attach the installers, SHA-256 sums and a source archive to a GitHub
 *      release. The release tag is created on GitHub at the pushed commit;
 *      the app's update check reads that tag.
 *
 * Usage:
 *   npm run release                 # patch
 *   npm run release:minor
 *   npm run release:major
 *
 * Options (after `--`):
 *   --skip-tests   skip tsc + vitest
 *   --skip-build   reuse the files already in release/
 *   --no-push      commit locally, do not touch GitHub
 *   --no-github    push, but do not create the release
 *   --allow-dirty  do not require a clean working tree
 *
 * The GitHub repository is taken from the `origin` remote (or from
 * package.json's `repository`). `gh` must be authenticated, or GH_TOKEN must
 * be set.
 *
 * Git worktrees share one remote list. When several editions live in
 * worktrees, give each repo a different remote name and pass it in:
 *   RELEASE_REMOTE=full npm run release
 * `RELEASE_REPO=owner/name` overrides the repository inferred from the remote.
 */
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkVersions,
  nextVersion,
  readAppVersion,
  setAppVersion,
} from './version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const type = args.find((a) => !a.startsWith('--')) || 'patch';
const flags = new Set(args.filter((a) => a.startsWith('--')));
const remoteName = process.env.RELEASE_REMOTE || 'origin';

const RELEASE_FILES = [
  'package.json',
  'package-lock.json',
  'desktop/package.json',
  'desktop/package-lock.json',
  'chart/Chart.yaml',
];

function fail(message) {
  throw new Error(message);
}

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
}

function capture(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function git(gitArgs) {
  return capture('git', gitArgs);
}

function runShell(command) {
  execSync(command, { cwd: root, stdio: 'inherit' });
}

function assertCleanTree() {
  if (flags.has('--allow-dirty')) return;
  const status = git(['status', '--porcelain']);
  if (status) {
    fail(
      'The working tree is not clean. Commit the changes first (or pass --allow-dirty).'
    );
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

/** owner/repo from the remote, falling back to package.json's repository. */
function githubRepo() {
  if (process.env.RELEASE_REPO) return process.env.RELEASE_REPO;
  let url = '';
  try {
    url = git(['remote', 'get-url', remoteName]);
  } catch {
    // No remote yet: fall back to package metadata.
  }
  if (!url) {
    const pkg = readJson('package.json');
    url =
      pkg.repository?.url ||
      readJson('desktop/package.json').repository?.url ||
      '';
  }
  const match = /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(url);
  if (!match) {
    fail(
      'Set an origin remote (or package.json repository) pointing at GitHub.'
    );
  }
  return `${match[1]}/${match[2]}`;
}

function restoreVersionFiles() {
  try {
    run('git', ['checkout', '--', ...RELEASE_FILES], { stdio: 'ignore' });
  } catch {
    // Nothing to restore.
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function releaseArtifacts(productName, version) {
  const dir = join(root, 'release');
  if (!existsSync(dir)) fail('release/ does not exist. Run the build first.');
  const prefix = `${productName}-${version}-`;
  const extensions = ['.exe', '.dmg', '.AppImage', '.deb'];
  const files = readdirSync(dir)
    .filter(
      (name) =>
        name.startsWith(prefix) && extensions.some((ext) => name.endsWith(ext))
    )
    .filter((name) => statSync(join(dir, name)).isFile())
    .sort();
  const setup = `${productName}-${version}-Windows-x64-Setup.exe`;
  if (!files.includes(setup)) {
    fail(
      `Missing ${setup} in release/. Build the Windows installer before releasing.`
    );
  }
  return files.map((name) => join(dir, name));
}

function makeSourceArchive(productName, version) {
  const target = join(root, 'release', `${productName}-${version}-Source.zip`);
  run('git', [
    'archive',
    '--format=zip',
    `--prefix=${productName}-${version}/`,
    '-o',
    target,
    'HEAD',
  ]);
  console.log(`📦 Source archive: ${target}`);
  return target;
}

function makeChecksums(productName, version, files) {
  const lines = files.map(
    (file) => `${sha256(file)}  ${file.split(/[\\/]/).pop()}`
  );
  const target = join(
    root,
    'release',
    `SHA256SUMS-${productName}-${version}.txt`
  );
  writeFileSync(target, lines.join('\n') + '\n');
  console.log(`🔐 Checksums: ${target}`);
  return target;
}

function releaseNotes({ productName, version, tag, repo, files, checksums }) {
  const displayName = productName.replace(/-([^-]+)$/, ' $1');
  const downloads = files
    .filter((file) => !file.endsWith('-Source.zip'))
    .map((file) => {
      const name = file.split(/[\\/]/).pop();
      const url = `https://github.com/${repo}/releases/download/${tag}/${name}`;
      return `- [${name}](${url})`;
    })
    .join('\n');
  const hashes = checksums
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, name] = line.split(/\s{2}/);
      return `\`${name}\`: \`${hash}\``;
    })
    .join('\n');

  return `# ${displayName} ${version}

Bộ công cụ PDF tiếng Việt chạy hoàn toàn trên máy: đọc, sửa, chuyển đổi, nén, ký và bảo vệ tài liệu. Tệp không rời khỏi máy.

## Tải về

${downloads}

- \`Source.zip\`: mã nguồn đầy đủ của đúng phiên bản này (GitHub cũng đính kèm Source code tự động).

## Kiểm tra tệp

SHA-256 của từng tệp:

${hashes}

## Cài đặt

- **Windows 10/11 64-bit:** chạy tệp \`Setup.exe\` (cài cho tài khoản hiện tại, không cần quyền Administrator, có nút *Cập nhật và khởi động lại* trong ứng dụng).
- **Bản Portable:** chạy trực tiếp \`Portable.exe\`, không cần cài; bản này mở trang tải khi có bản mới.
- Bộ cài chưa có chữ ký số: Windows SmartScreen có thể hỏi, bấm **More info › Run anyway**.

Nút **Kiểm tra cập nhật** trong ứng dụng đọc \`${tag}\` của release mới nhất trên GitHub; vì vậy đừng đánh dấu release này là bản cũ.

Giấy phép: AGPL-3.0. Dựa trên BentoPDF (© BentoPDF Contributors).
`;
}

function ghAvailable() {
  try {
    capture('gh', ['auth', 'status']);
    return true;
  } catch {
    return Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  }
}

function publishRelease({
  tag,
  repo,
  productName,
  version,
  assets,
  notesPath,
}) {
  if (!ghAvailable()) {
    fail('gh is not authenticated. Run `gh auth login` or set GH_TOKEN.');
  }
  const title = `${productName} ${version}`;
  let exists = false;
  try {
    capture('gh', ['release', 'view', tag, '--repo', repo]);
    exists = true;
  } catch {
    // No release for this tag yet.
  }

  if (exists) {
    run('gh', [
      'release',
      'upload',
      tag,
      ...assets,
      '--repo',
      repo,
      '--clobber',
    ]);
    run('gh', [
      'release',
      'edit',
      tag,
      '--repo',
      repo,
      '--title',
      title,
      '--notes-file',
      notesPath,
      '--latest',
    ]);
  } else {
    run('gh', [
      'release',
      'create',
      tag,
      ...assets,
      '--repo',
      repo,
      '--target',
      'main',
      '--title',
      title,
      '--notes-file',
      notesPath,
      '--latest',
    ]);
  }
  console.log(`🎉 https://github.com/${repo}/releases/tag/${tag}`);
}

function main() {
  if (!['patch', 'minor', 'major'].includes(type)) {
    fail(`Invalid release type "${type}". Use patch, minor or major.`);
  }

  assertCleanTree();

  // The release script pushes HEAD to main. Running it from the lite branch
  // (which shares this remote) would publish that branch's code as main.
  if (!flags.has('--no-push')) {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== 'main') {
      fail(
        `Refusing to publish a release from "${branch}". Switch to main, or use --no-push to only commit locally.`
      );
    }
    if (!flags.has('--no-github') && !ghAvailable()) {
      fail(
        'gh is not authenticated. Run `gh auth login` or set GH_TOKEN before bumping the version.'
      );
    }
  }

  const current = readAppVersion();
  const version = nextVersion(current, type);
  const tag = `v${version}`;

  const pkg = readJson('package.json');
  const builder = readJson('electron-builder.json');
  const productName = builder.productName;
  if (!productName) fail('electron-builder.json has no productName.');
  if (pkg.version !== readJson('desktop/package.json').version) {
    // setAppVersion below fixes it; this is only a hint for a dirty checkout.
    console.log('ℹ️  Root and desktop versions differed; syncing them now.');
  }

  console.log(`🚀 ${productName} ${current} → ${version} (${type})`);

  let committed = false;
  try {
    setAppVersion(version, { bumpChartVersion: true });
    const check = checkVersions();
    if (check.mismatches.length > 0) {
      fail(`Version check failed: ${JSON.stringify(check.mismatches)}`);
    }

    if (!flags.has('--skip-tests')) {
      console.log('🧪 Typecheck...');
      runShell('npx tsc --noEmit');
      console.log('🧪 Tests...');
      runShell('npm run test:run');
    }

    if (!flags.has('--skip-build')) {
      console.log('🔨 Building the Windows installers...');
      runShell('npm run desktop:dist');
    }

    const installers = releaseArtifacts(productName, version);

    run('git', ['add', ...RELEASE_FILES]);
    run('git', ['commit', '-m', `Release v${version}`]);
    committed = true;
    console.log(`💾 Committed version ${version}`);

    const source = makeSourceArchive(productName, version);
    const sums = makeChecksums(productName, version, [...installers, source]);
    const notesPath = join(
      root,
      'release',
      `RELEASE_NOTES-${productName}-${version}.md`
    );

    let repo = 'OWNER/REPO';
    try {
      repo = githubRepo();
    } catch {
      // --no-push can still package the source archive without a remote.
    }

    writeFileSync(
      notesPath,
      releaseNotes({
        productName,
        version,
        tag,
        repo,
        files: [...installers, source],
        checksums: readFileSync(sums, 'utf8'),
      })
    );

    if (flags.has('--no-push')) {
      console.log('⏭️  --no-push: stopped before pushing.');
      return;
    }
    if (repo === 'OWNER/REPO') {
      fail('No GitHub repository found. Add an origin remote first.');
    }

    console.log(`📤 Pushing to ${repo}...`);
    run('git', ['push', remoteName, `HEAD:main`]);

    if (flags.has('--no-github')) {
      console.log('⏭️  --no-github: pushed without creating a release.');
      return;
    }

    publishRelease({
      tag,
      repo,
      productName,
      version,
      assets: [...installers, source, sums],
      notesPath,
    });
  } catch (error) {
    if (!committed) restoreVersionFiles();
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
}
