import {access, copyFile, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DOC_MAPPINGS = [
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

export function toPublicAssetName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^-+|-+$/g, '');
}

function replaceFigure(match, sourceName, assetPathBySourceName) {
  const publicPath = assetPathBySourceName.get(sourceName);
  if (!publicPath) {
    throw new Error(`Unmapped asset referenced in figure: ${sourceName}`);
  }

  return `![](${publicPath})`;
}

export function normalizeMarkdown(markdown, {assetPathBySourceName, prependRootSlug, sourcePath}) {
  let output = markdown.replace(/\r\n/g, '\n').replace(/&#x20;/g, ' ');

  output = output.replace(/^(\s*#{1,6}\s+.*?)(?:\s*<a\b[^>]*><\/a>)\s*$/gm, '$1');
  output = output.replace(/\{% embed url="([^"]+)" %\}/g, '- [$1]($1)');
  output = output.replace(
    /\{% hint style="info" %\}\n?([\s\S]*?)\n?\{% endhint %\}/g,
    (_, content) => `:::info\n${content.trim()}\n:::`,
  );
  output = output.replace(
    /<figure>\s*<img[^>]*src="\.gitbook\/assets\/([^"]+)"[^>]*>\s*(?:<figcaption>[\s\S]*?<\/figcaption>\s*)?<\/figure>/g,
    (match, sourceName) => replaceFigure(match, sourceName, assetPathBySourceName),
  );
  if (prependRootSlug) {
    output = `---\nslug: /\n---\n\n${output}`;
  }

  return output;
}

async function buildAssetMap(sourceDir, siteDir) {
  const sourceAssetsDir = path.join(sourceDir, '.gitbook', 'assets');
  const targetAssetsDir = path.join(siteDir, 'static', 'img', 'gitbook');
  const assetPathBySourceName = new Map();
  const sourceNameByPublicName = new Map();

  await rm(targetAssetsDir, {recursive: true, force: true});
  await mkdir(targetAssetsDir, {recursive: true});

  let assetsCount = 0;
  const assetEntries = await readdir(sourceAssetsDir, {withFileTypes: true});
  for (const entry of assetEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const publicName = toPublicAssetName(entry.name);
    const collidingSourceName = sourceNameByPublicName.get(publicName);
    if (collidingSourceName) {
      throw new Error(
        `Asset name collision after normalization: ${collidingSourceName} and ${entry.name} -> ${publicName}`,
      );
    }

    const sourceAssetPath = path.join(sourceAssetsDir, entry.name);
    const targetAssetPath = path.join(targetAssetsDir, publicName);

    await copyFile(sourceAssetPath, targetAssetPath);
    assetPathBySourceName.set(entry.name, `/img/gitbook/${publicName}`);
    sourceNameByPublicName.set(publicName, entry.name);
    assetsCount += 1;
  }

  return {assetPathBySourceName, assetsCount};
}

export async function importGitbookContent({sourceDir, siteDir}) {
  const summaryPath = path.join(sourceDir, 'SUMMARY.md');

  await access(sourceDir);
  await readFile(summaryPath, 'utf8');

  const docsDir = path.join(siteDir, 'docs');
  await mkdir(docsDir, {recursive: true});

  const {assetPathBySourceName, assetsCount} = await buildAssetMap(sourceDir, siteDir);

  for (const mapping of DOC_MAPPINGS) {
    const sourcePath = path.join(sourceDir, mapping.source);
    const targetPath = path.join(docsDir, mapping.target);
    const markdown = await readFile(sourcePath, 'utf8');
    const normalized = normalizeMarkdown(markdown, {
      assetPathBySourceName,
      prependRootSlug: mapping.prependRootSlug,
      sourcePath: mapping.source,
    });

    await writeFile(targetPath, normalized);
  }

  return {
    docsCount: DOC_MAPPINGS.length,
    assetsCount,
  };
}

export async function main() {
  const [, , sourceArg, siteArg] = process.argv;
  const sourceDir = path.resolve(sourceArg ?? process.cwd());
  const siteDir = path.resolve(siteArg ?? process.cwd());
  const result = await importGitbookContent({sourceDir, siteDir});

  console.log(`Imported ${result.docsCount} docs and ${result.assetsCount} assets.`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
