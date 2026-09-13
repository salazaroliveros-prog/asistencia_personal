#!/usr/bin/env node
/**
 * run-tests.mjs — Punto de entrada para npm test
 *
 * Ejecuta los tests unitarios con Jest. Está diseñado para funcionar
 * en CI sin necesidad de configuración adicional.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const result = spawnSync(
  process.execPath,
  [
    resolve(projectRoot, 'node_modules', 'jest-cli', 'bin', 'jest.js'),
    '--testPathPattern=__tests__/unit/',
    '--testEnvironment=node',
    '--no-coverage',
    '--forceExit',
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '' },
  }
);

process.exit(result.status ?? 0);
