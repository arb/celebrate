import Fs from 'node:fs/promises';
import Toc from 'markdown-toc';

const filename = './README.md';

const generate = async () => {
  const api = await Fs.readFile(filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify (text) {
      return text.toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    },
  };

  const output = Toc.insert(api, tocOptions);
  await Fs.writeFile(filename, output);
};

await generate();
