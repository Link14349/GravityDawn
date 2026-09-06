/** Package the production build with a manifest and an independent preview server. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const dist = path.join(root, 'dist');
const output = path.join(root, 'releases');
const name = `gravity-dawn-${version}`;
const archive = `${name}.tar.gz`;
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});

if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run npm run build before packaging.');
const files = walk(dist).filter(file => path.basename(file) !== 'release.json');
if (files.some(file => file.endsWith('.map') || /[\\/](test|tools)[\\/]/.test(file))) {
  throw new Error('Release must contain the production build only.');
}
const manifest = {
  name: 'Gravity Dawn', version, channel: 'stable',
  files: Object.fromEntries(files.map(file => [path.relative(dist, file).split(path.sep).join('/'), sha256(file)])),
};
fs.writeFileSync(path.join(dist, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.mkdirSync(output, { recursive: true });
const staging = fs.mkdtempSync(path.join(output, '.staging-'));
try {
  const packageRoot = path.join(staging, name);
  fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
  fs.cpSync(dist, path.join(packageRoot, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'serve-release.cjs'), path.join(packageRoot, 'src/serve-release.cjs'));
  fs.copyFileSync(path.join(root, 'doc/release.md'), path.join(packageRoot, 'README.md'));
  execFileSync('tar', ['-czf', path.join(output, archive), '-C', staging, name], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  fs.writeFileSync(path.join(output, `${archive}.sha256`), `${sha256(path.join(output, archive))}  ${archive}\n`);
  console.log(`Release: ${path.join(output, archive)}\nSHA-256: ${sha256(path.join(output, archive))}`);
} finally { fs.rmSync(staging, { recursive: true, force: true }); }
