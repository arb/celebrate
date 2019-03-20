const Toc = require('markdown-toc');
const Fs = require('fs');

const filename = './README.md';

const generate = () => {
  const api = Fs.readFileSync(filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify(text) {
      return text.toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    },
  };

  const output = Toc.insert(api, tocOptions);
  Fs.writeFileSync(filename, output);
};

generate();
