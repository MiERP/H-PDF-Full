#!/usr/bin/env node
/**
 * One version for the whole app.
 *
 * The version in the root `package.json` is the source of truth. Every other
 * place that stamps the app version is written from it by this script:
 *
 *   - package-lock.json            (top level and packages[""])
 *   - desktop/package.json         (electron-builder reads this one)
 *   - desktop/package-lock.json    (top level and packages[""])
 *   - chart/Chart.yaml             (appVersion)
 *
 * Usage:
 *   node scripts/version.mjs show
 *   node scripts/version.mjs check
 *   node scripts/version.mjs set 1.0.1 [--bump-chart]
 *   node scripts/version.mjs bump patch|minor|major
 *
 * `npm run version:check` is also run by the release script, so a release can
 * never ship with a stale version in one of these files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  rootPackage: join(root, 'package.json'),
  rootLock: join(root, 'package-lock.json'),
  desktopPackage: join(root, 'desktop', 'package.json'),
  desktopLock: join(root, 'desktop', 'package-lock.json'),
  chart: join(root, 'chart', 'Chart.yaml'),
};

const VERSION_RE = /^\d+\.\d+\.\d+$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function assertVersion(version) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH.`);
  }
}

/** The version of the app, always read from the root package.json. */
export function readAppVersion() {
  return readJson(FILES.rootPackage).version;
}

/** Next version for a release type. */
export function nextVersion(current, type) {
  assertVersion(current);
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid release type "${type}". Use major, minor or patch.`);
  }
}

function readChart(file) {
  return readFileSync(file, 'utf8');
}

function chartAppVersion(text) {
  const match = /^appVersion:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(text);
  return match ? match[1] : null;
}

function writeChart(file, version, bumpChartVersion) {
  let text = readChart(file);
  if (!/^appVersion:\s*.+$/m.test(text)) {
    throw new Error(`${file}: no appVersion line found`);
  }
  text = text.replace(/^appVersion:.*$/m, `appVersion: '${version}'`);
  if (bumpChartVersion) {
    if (!/^version:\s*\d+\.\d+\.\d+\s*$/m.test(text)) {
      throw new Error(`${file}: no chart version line found`);
    }
    text = text.replace(/^version:\s*(\d+)\.(\d+)\.(\d+)\s*$/m, (_, major, minor, patch) => {
      return `version: ${major}.${minor}.${Number(patch) + 1}`;
    });
  }
  writeFileSync(file, text);
}

function updateLock(file, version) {
  const lock = readJson(file);
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
  writeJson(file, lock);
}

/**
 * Write `version` everywhere. The chart keeps its own chart version (bumped
 * only when asked); its appVersion always follows the app.
 */
export function setAppVersion(version, { bumpChartVersion = false } = {}) {
  assertVersion(version);

  const pkg = readJson(FILES.rootPackage);
  pkg.version = version;
  writeJson(FILES.rootPackage, pkg);

  updateLock(FILES.rootLock, version);

  const desktop = readJson(FILES.desktopPackage);
  desktop.version = version;
  writeJson(FILES.desktopPackage, desktop);

  updateLock(FILES.desktopLock, version);

  writeChart(FILES.chart, version, bumpChartVersion);

  return version;
}

/** Every stamped version, so check() can point at the odd one out. */
export function versionLocations() {
  const rootPkg = readJson(FILES.rootPackage);
  const rootLock = readJson(FILES.rootLock);
  const desktopPkg = readJson(FILES.desktopPackage);
  const desktopLock = readJson(FILES.desktopLock);
  const chart = readChart(FILES.chart);

  return [
    { file: 'package.json', value: rootPkg.version },
    { file: 'package-lock.json', value: rootLock.version },
    { file: 'package-lock.json packages[""]', value: rootLock.packages?.['']?.version },
    { file: 'desktop/package.json', value: desktopPkg.version },
    { file: 'desktop/package-lock.json', value: desktopLock.version },
    {
      file: 'desktop/package-lock.json packages[""]',
      value: desktopLock.packages?.['']?.version,
    },
    { file: 'chart/Chart.yaml appVersion', value: chartAppVersion(chart) },
  ];
}

/** Null when every location matches the root package.json, else details. */
export function checkVersions() {
  const expected = readAppVersion();
  const mismatches = versionLocations().filter((item) => item.value !== expected);
  return { expected, mismatches };
}

function printCheck() {
  const { expected, mismatches } = checkVersions();
  if (mismatches.length === 0) {
    console.log(`✅ Version ${expected} is in sync everywhere.`);
    return 0;
  }
  console.error(`❌ Version mismatch. Source of truth: ${expected}`);
  for (const item of mismatches) {
    console.error(`   ${item.file}: ${item.value ?? '(missing)'}`);
  }
  return 1;
}

function main() {
  const [command = 'show', argument] = process.argv.slice(2);
  const options = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

  try {
    switch (command) {
      case 'show':
        console.log(readAppVersion());
        return 0;
      case 'check':
        return printCheck();
      case 'set': {
        if (!argument) throw new Error('Usage: node scripts/version.mjs set <version>');
        const version = setAppVersion(argument, {
          bumpChartVersion: options.has('--bump-chart'),
        });
        console.log(`✅ Version set to ${version} in all files.`);
        return printCheck();
      }
      case 'bump': {
        const type = argument || 'patch';
        const current = readAppVersion();
        const version = nextVersion(current, type);
        setAppVersion(version, { bumpChartVersion: true });
        console.log(`✅ Version bumped ${current} → ${version}.`);
        return printCheck();
      }
      default:
        throw new Error(`Unknown command "${command}". Use show, check, set or bump.`);
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
