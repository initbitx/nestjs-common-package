#!/usr/bin/env node
/*
  Copies compiled JS files from dist/packages/nats-jetstream/src to dist/packages/nats-jetstream/lib/src
  so that both JS and typings are co-located under lib as required.
*/
const fs = require('fs');
const path = require('path');

const distRoot = path.resolve(__dirname, '../..', 'dist', 'packages', 'nats-jetstream');
const fromDir = path.join(distRoot, 'src');
const toDir = path.join(distRoot, 'lib', 'src');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeGeneratedFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeGeneratedFiles(fullPath);
      // Clean up empty directories
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.map'))) {
      fs.unlinkSync(fullPath);
    }
  }
}

copyRecursive(fromDir, toDir);
console.log(`[copy-js-to-lib] Copied JS files from ${fromDir} to ${toDir}`);

removeGeneratedFiles(fromDir);
console.log(`[copy-js-to-lib] Removed generated .js and .map files from ${fromDir}`);
