const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const projectRoot = path.join(backendRoot, '..');
const publicRoot = path.join(backendRoot, 'public');

const files = ['index.html', 'manifest.json', 'sw.js'];
const directories = ['css', 'js', 'html', 'icons', 'images', 'data'];

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
