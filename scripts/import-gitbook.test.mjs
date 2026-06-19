import assert from 'node:assert/strict';
import {access, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DOC_MAPPINGS,
  importGitbookContent,
  normalizeMarkdown,
  toPublicAssetName,
} from './import-gitbook.mjs';

const EXPECTED_DOC_MAPPINGS = [
  {source: 'README.md', target: 'intro.md', prependRootSlug: true},
  {source: 'problem-statement.md', target: 'problem-statement.md', prependRootSlug: false},
  {source: 'tokenomics.md', target: 'tokenomics.md', prependRootSlug: false},
  {source: 'roadmap.md', target: 'roadmap.md', prependRootSlug: false},
  {source: 'mercurx-token.md', target: 'mercurx-token.md', prependRootSlug: false},
  {source: 'merx-allocation.md', target: 'merx-allocation.md', prependRootSlug: false},
  {
    source: 'merx-emmision-schedule.md',
    target: 'merx-emmision-schedule.md',
    prependRootSlug: false,
  },
  {source: 'staking-fees.md', target: 'staking-fees.md', prependRootSlug: false},
  {source: 'tiering-system.md', target: 'tiering-system.md', prependRootSlug: false},
];

async function writeMappedSourceDocs(sourceDir, {introAssetName = 'image (1).png'} = {}) {
  await writeFile(
    path.join(sourceDir, 'README.md'),
    `# Intro\n\n<figure><img src=".gitbook/assets/${introAssetName}" alt=""><figcaption></figcaption></figure>\n`,
  );

  for (const mapping of EXPECTED_DOC_MAPPINGS.slice(1)) {
    await writeFile(path.join(sourceDir, mapping.source), `# ${mapping.target}\n`);
  }
}

test('DOC_MAPPINGS matches the expected GitBook import contract', () => {
  assert.deepEqual(DOC_MAPPINGS, EXPECTED_DOC_MAPPINGS);
});

test('toPublicAssetName normalizes GitBook asset filenames for public URLs', () => {
  assert.equal(toPublicAssetName('image (1).png'), 'image-1.png');
  assert.equal(toPublicAssetName('ClaimGifFaster.gif'), 'claimgiffaster.gif');
  assert.equal(
    toPublicAssetName('spaces_s7cpFPmYTxjvnM861Ill_uploads_EMRG8vUNl8RXAL1y8rJ1_resetPassGif.gif'),
    'spaces-s7cpfpmytxjvnm861ill-uploads-emrg8vunl8rxal1y8rj1-resetpassgif.gif',
  );
});

test('normalizeMarkdown converts GitBook blocks into Docusaurus-safe markdown', () => {
  const input = `# Overview <a href="#overview" id="#overview"></a>

{% embed url="https://support.metamask.io/hc/en-us/articles/360015489531-Getting-started-with-MetaMask" %}

{% hint style="info" %}
MercurX follows a transparent launch and allocation model.
{% endhint %}

<figure><img src=".gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>
`;

  const output = normalizeMarkdown(input, {
    assetPathBySourceName: new Map([['image (1).png', '/img/gitbook/image-1.png']]),
    prependRootSlug: false,
  });

  assert.match(output, /^# Overview$/m);
  assert.match(
    output,
    /- \[https:\/\/support\.metamask\.io\/hc\/en-us\/articles\/360015489531-Getting-started-with-MetaMask\]\(https:\/\/support\.metamask\.io\/hc\/en-us\/articles\/360015489531-Getting-started-with-MetaMask\)/,
  );
  assert.match(output, /:::info\nMercurX follows a transparent launch and allocation model\.\n:::/);
  assert.match(output, /!\[\]\(\/img\/gitbook\/image-1\.png\)/);
  assert.doesNotMatch(output, /<figure>/);
  assert.doesNotMatch(output, /\{% hint/);
});

test('normalizeMarkdown converts GitBook figures without figcaptions', () => {
  const input = '<figure><img src=".gitbook/assets/image (1).png" alt=""></figure>\n';

  const output = normalizeMarkdown(input, {
    assetPathBySourceName: new Map([['image (1).png', '/img/gitbook/image-1.png']]),
    prependRootSlug: false,
  });

  assert.match(output, /^!\[\]\(\/img\/gitbook\/image-1\.png\)$/m);
  assert.doesNotMatch(output, /<figure>/);
});

test('normalizeMarkdown preserves whitepaper tier content without source-specific escaping', () => {
  const input = `## Tier

### Tier 1:

Requirement: Staked minimum 1000 MERX
`;

  const output = normalizeMarkdown(input, {
    assetPathBySourceName: new Map(),
    prependRootSlug: false,
    sourcePath: 'tiering-system.md',
  });

  assert.match(output, /### Tier 1:/);
  assert.match(output, /Requirement: Staked minimum 1000 MERX/);
  assert.doesNotMatch(output, /\\</);
  assert.doesNotMatch(output, /\\>/);
});

test('importGitbookContent copies mapped docs and assets into the Docusaurus project', async () => {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'gitbook-source-'));
  const siteDir = await mkdtemp(path.join(os.tmpdir(), 'docusaurus-site-'));

  try {
    await mkdir(path.join(sourceDir, '.gitbook', 'assets'), {recursive: true});
    await writeFile(path.join(sourceDir, 'SUMMARY.md'), '# Table of contents\n');
    await writeMappedSourceDocs(sourceDir);

    await writeFile(
      path.join(sourceDir, '.gitbook', 'assets', 'image (1).png'),
      'binary-image-placeholder',
    );

    const result = await importGitbookContent({
      sourceDir,
      siteDir,
    });

    const intro = await readFile(path.join(siteDir, 'docs', 'intro.md'), 'utf8');
    const docFiles = (await readdir(path.join(siteDir, 'docs'))).sort();

    assert.match(intro, /^---\nslug: \/\n---/);
    assert.match(intro, /!\[\]\(\/img\/gitbook\/image-1\.png\)/);
    await access(path.join(siteDir, 'static', 'img', 'gitbook', 'image-1.png'));
    assert.deepEqual(
      docFiles,
      EXPECTED_DOC_MAPPINGS.map((mapping) => mapping.target).sort(),
    );
    assert.equal(result.docsCount, EXPECTED_DOC_MAPPINGS.length);
    assert.equal(result.assetsCount, 1);
  } finally {
    await rm(sourceDir, {recursive: true, force: true});
    await rm(siteDir, {recursive: true, force: true});
  }
});

test('importGitbookContent removes stale public assets on repeated imports', async () => {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'gitbook-source-'));
  const siteDir = await mkdtemp(path.join(os.tmpdir(), 'docusaurus-site-'));

  try {
    await mkdir(path.join(sourceDir, '.gitbook', 'assets'), {recursive: true});
    await writeFile(path.join(sourceDir, 'SUMMARY.md'), '# Table of contents\n');
    await writeMappedSourceDocs(sourceDir);

    await writeFile(path.join(sourceDir, '.gitbook', 'assets', 'image (1).png'), 'first-import');
    await importGitbookContent({sourceDir, siteDir});
    await access(path.join(siteDir, 'static', 'img', 'gitbook', 'image-1.png'));

    await rm(path.join(sourceDir, '.gitbook', 'assets', 'image (1).png'));
    await writeFile(path.join(sourceDir, '.gitbook', 'assets', 'fresh image.png'), 'second-import');
    await writeFile(
      path.join(sourceDir, 'README.md'),
      '# Intro\n\n<figure><img src=".gitbook/assets/fresh image.png" alt=""></figure>\n',
    );

    await importGitbookContent({sourceDir, siteDir});

    await assert.rejects(access(path.join(siteDir, 'static', 'img', 'gitbook', 'image-1.png')));
    await access(path.join(siteDir, 'static', 'img', 'gitbook', 'fresh-image.png'));
  } finally {
    await rm(sourceDir, {recursive: true, force: true});
    await rm(siteDir, {recursive: true, force: true});
  }
});

test('importGitbookContent throws on normalized asset filename collisions', async () => {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'gitbook-source-'));
  const siteDir = await mkdtemp(path.join(os.tmpdir(), 'docusaurus-site-'));

  try {
    await mkdir(path.join(sourceDir, '.gitbook', 'assets'), {recursive: true});
    await writeFile(path.join(sourceDir, 'SUMMARY.md'), '# Table of contents\n');
    await writeMappedSourceDocs(sourceDir, {introAssetName: 'A B.png'});
    await writeFile(path.join(sourceDir, '.gitbook', 'assets', 'A B.png'), 'first');
    await writeFile(path.join(sourceDir, '.gitbook', 'assets', 'a-b.png'), 'second');

    await assert.rejects(
      importGitbookContent({sourceDir, siteDir}),
      /Asset name collision after normalization: A B\.png and a-b\.png -> a-b\.png/,
    );
  } finally {
    await rm(sourceDir, {recursive: true, force: true});
    await rm(siteDir, {recursive: true, force: true});
  }
});
