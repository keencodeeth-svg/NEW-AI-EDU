import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const I18N_FILES = [
  'lib/i18n/common.ts',
  'lib/i18n/stage.ts',
  'lib/i18n/chat.ts',
  'lib/i18n/generation.ts',
  'lib/i18n/settings.ts',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatPath(keyPath) {
  return keyPath || '<root>';
}

function collectLeafKeys(value, label, keyPath = '', keys = new Set()) {
  if (Array.isArray(value)) {
    throw new Error(`${label} has an array at "${formatPath(keyPath)}". Locale values must not be arrays.`);
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      throw new Error(`${label} has an empty object at "${formatPath(keyPath)}". Locale objects must not be empty.`);
    }

    for (const [key, child] of entries) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      collectLeafKeys(child, label, nextPath, keys);
    }

    return keys;
  }

  if (!keyPath) {
    throw new Error(`${label} must export a locale object at the root.`);
  }

  keys.add(keyPath);
  return keys;
}

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  });

  const compiledModule = { exports: {} };
  const sandbox = {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    process,
    console,
    __filename: filePath,
    __dirname: path.dirname(filePath),
  };

  vm.runInNewContext(outputText, sandbox, { filename: filePath });
  return compiledModule.exports;
}

function getLocalePairs(moduleExports, filePath) {
  const exportNames = Object.keys(moduleExports);
  const zhNames = exportNames.filter((name) => name.endsWith('ZhCN'));

  if (zhNames.length === 0) {
    throw new Error(`${path.basename(filePath)} does not export any *ZhCN locale object.`);
  }

  return zhNames.map((zhName) => {
    const enName = `${zhName.slice(0, -4)}EnUS`;
    if (!(enName in moduleExports)) {
      throw new Error(`${path.basename(filePath)} is missing matching export "${enName}" for "${zhName}".`);
    }

    return {
      zhName,
      enName,
      zhValue: moduleExports[zhName],
      enValue: moduleExports[enName],
    };
  });
}

function main() {
  const reports = [];

  for (const relativePath of I18N_FILES) {
    const filePath = path.join(process.cwd(), relativePath);
    const moduleExports = loadTsModule(filePath);
    const pairs = getLocalePairs(moduleExports, filePath);

    for (const pair of pairs) {
      const zhLabel = `${relativePath}:${pair.zhName}`;
      const enLabel = `${relativePath}:${pair.enName}`;
      const zhKeys = new Set([...collectLeafKeys(pair.zhValue, zhLabel)].sort());
      const enKeys = new Set([...collectLeafKeys(pair.enValue, enLabel)].sort());

      const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key)).sort();
      const extraInEn = [...enKeys].filter((key) => !zhKeys.has(key)).sort();

      if (missingInEn.length > 0 || extraInEn.length > 0) {
        reports.push({
          file: relativePath,
          pair: `${pair.zhName} <-> ${pair.enName}`,
          missingInEn,
          extraInEn,
        });
      }
    }
  }

  if (reports.length === 0) {
    console.log(`i18n key alignment check passed for ${I18N_FILES.length} files.`);
    return;
  }

  console.error('i18n key alignment check failed:');
  for (const report of reports) {
    console.error(`\n- ${report.file} (${report.pair})`);

    if (report.missingInEn.length > 0) {
      console.error(`  Missing in EnUS (${report.missingInEn.length}):`);
      for (const key of report.missingInEn) {
        console.error(`    - ${key}`);
      }
    }

    if (report.extraInEn.length > 0) {
      console.error(`  Extra in EnUS (${report.extraInEn.length}):`);
      for (const key of report.extraInEn) {
        console.error(`    - ${key}`);
      }
    }
  }

  process.exit(1);
}

main();
