import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

function offlineShell() {
  return {
    name: 'wallboard-offline-shell',
    configureServer(server) {
      server.middlewares.use('/geography-data.json', async (_request, response, next) => {
        try {
          const data = await readFile('src/geography-data.json');
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(data);
        } catch (error) {
          next(error);
        }
      });
    },
    async closeBundle() {
      await writeFile('dist/geography-data.json', await readFile('src/geography-data.json'));
      const assets = (await readdir('dist/assets')).sort().map(name => 'assets/' + name);
      const files = ['index.html', 'mark.svg', ...assets];
      const source = await readFile('src/sw-template.js', 'utf8');
      const hash = createHash('sha256').update(source);
      for (const file of files) hash.update(file).update(await readFile('dist/' + file));
      await writeFile('dist/sw.js', source
        .replace('SHELL_VERSION', JSON.stringify(hash.digest('hex').slice(0, 16)))
        .replace('SHELL_FILES', JSON.stringify(files)));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [offlineShell()],
});
