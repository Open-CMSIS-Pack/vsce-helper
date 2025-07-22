import { fs } from 'memfs';
import { vitest } from 'vitest';

export default {
    ...fs.promises,
    rm: vitest.spyOn(fs.promises, 'rm'),
    mkdir: vitest.spyOn(fs.promises, 'mkdir'),
    readFile: vitest.spyOn(fs.promises, 'readFile'),
    writeFile: vitest.spyOn(fs.promises, 'writeFile'),
    rename: vitest.spyOn(fs.promises, 'rename'),
};
