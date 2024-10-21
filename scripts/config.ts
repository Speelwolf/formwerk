import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { ModuleFormat } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { normalizePath, slashes } from './normalize-path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const formatNameMap = {
  core: 'Formwerk',
  'schema-yup': 'FormwerkYup',
  'schema-zod': 'FormwerkZod',
};

const pkgNameMap = {
  core: 'core',
  'schema-yup': 'schema-yup',
  'schema-zod': 'schema-zod',
};

const formatExt: Partial<Record<ModuleFormat, string>> = {
  esm: 'mjs',
  iife: 'iife.js',
  cjs: 'cjs',
};

const createPlugins = ({ version, format, pkg }) => {
  const isEsm = format === 'es';
  const tsPlugin = typescript({
    declarationDir: normalizePath(path.resolve(__dirname, `../packages/${pkg}/dist`)),
  });

  return [
    replace({
      preventAssignment: true,
      values: {
        __VERSION__: version,
        __DEV__: isEsm ? `(process.env.NODE_ENV !== 'production')` : 'false',
      },
    }),
    tsPlugin,
    resolve(),
    commonjs(),
  ];
};

async function createConfig(pkg: keyof typeof pkgNameMap, format: ModuleFormat) {
  // An import assertion in a dynamic import
  const { default: info } = await import(normalizePath(path.resolve(__dirname, `../packages/${pkg}/package.json`)), {
    assert: {
      type: 'json',
    },
  });

  const { version } = info;

  const isEsm = format === 'esm';

  const config = {
    bundleName: `${pkgNameMap[pkg]}.${formatExt[format] ?? 'js'}`,
    input: {
      input: slashes(path.resolve(__dirname, `../packages/${pkg}/src/index.ts`)),
      external: ['vue', isEsm ? '@vue/devtools-api' : undefined, 'yup', 'zod'].filter(Boolean) as string[],
      plugins: createPlugins({ version, pkg, format }),
    },
    output: {
      banner: `/**
  * @formwerk/${pkg} v${version}
  * (c) ${new Date().getFullYear()} Abdelrahman Awad
  * @license MIT
  */`,
      format,
      name: format === 'iife' ? formatNameMap[pkg] : undefined,
      globals: {
        vue: 'Vue',
      },
    },
  };

  // if (options.env) {
  //   config.input.plugins.unshift(
  //     replace({
  //       'process.env.NODE_ENV': JSON.stringify(options.env)
  //     })
  //   );
  // }

  return config;
}

export { formatNameMap, pkgNameMap, formatExt, createConfig, createPlugins };
