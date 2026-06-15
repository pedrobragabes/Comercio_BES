const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const projectRoot = path.join(backendRoot, '..');
const publicRoot = path.join(backendRoot, 'public');

const files = ['index.html', 'manifest.json', 'sw.js'];
const directories = ['css', 'js', 'html', 'icons', 'images', 'data'];

if (!fs.existsSync(path.join(projectRoot, 'index.html'))) {
  if (fs.existsSync(path.join(publicRoot, 'index.html'))) {
    console.log(`Repository root frontend not found at ${projectRoot}. Using bundled assets from ${publicRoot}.`);
    process.exit(0);
  }

  console.error(`Frontend index.html not found at ${projectRoot} or ${publicRoot}`);
  console.error('Deploy the repository root or commit bundled frontend assets under backend/public.');
  process.exit(1);
}

function copyFileIfExists(file) {
  const source = path.join(projectRoot, file);
  if (!fs.existsSync(source)) return;
  fs.copyFileSync(source, path.join(publicRoot, file));
}

function copyDirectoryIfExists(directory) {
  const source = path.join(projectRoot, directory);
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, path.join(publicRoot, directory), {
    recursive: true,
    force: true
  });
}

fs.rmSync(publicRoot, { recursive: true, force: true });
fs.mkdirSync(publicRoot, { recursive: true });

files.forEach(copyFileIfExists);
directories.forEach(copyDirectoryIfExists);

console.log(`Frontend assets copied to ${publicRoot}`);
