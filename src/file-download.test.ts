/**
 * Copyright 2024 Arm Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import nock from 'nock';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadFile } from './file-download.ts';
import { faker } from '@faker-js/faker';

import { describe, it, expect, vitest, beforeAll, beforeEach } from 'vitest';

vitest.mock('node:fs', async () => {
    const actualFs = await import('memfs');
    return {
        ...actualFs.fs,
        createWriteStream: vitest.fn(actualFs.fs.createWriteStream),
    };
});

describe('downloadFile', () => {
    const tmpDirectory = tmpdir();

    beforeAll(() => {
        fs.mkdirSync(tmpDirectory, { recursive: true });
    });

    beforeEach(() => {
        nock.cleanAll();
    });

    it('downloads the specified file to the given location', async () => {
        const url = faker.internet.url({ appendSlash: false });
        const fileName = faker.system.fileName();
        const downloadLocation = join(tmpDirectory, fileName);
        const fileContents = faker.lorem.paragraph();
        nock(url)
            .get(`/${fileName}`)
            .reply(200, fileContents);

        await downloadFile(`${url}/${fileName}`, downloadLocation);

        const data = fs.readFileSync(downloadLocation, 'utf8');
        expect(data).toBe(fileContents);
    });

    it('follows redirects to the file to download', async () => {
        const url = faker.internet.url({ appendSlash: false });
        const url2 = faker.internet.url({ appendSlash: false });
        const fileName = faker.system.fileName();
        const downloadLocation = join(tmpDirectory, fileName);
        const fileContents = faker.lorem.paragraph();
        nock(url)
            .get(`/${fileName}`)
            .reply(301, undefined, { location: `${url2}/${fileName}` });
        nock(url2)
            .get(`/${fileName}`)
            .reply(200, fileContents);

        await downloadFile(`${url}/${fileName}`, downloadLocation);

        const data = fs.readFileSync(downloadLocation, 'utf8');
        expect(data).toBe(fileContents);
    });

    it('rejects with an error if the request fails', async () => {
        const url = faker.internet.url({ appendSlash: false });
        const fileName = faker.system.fileName();
        nock(url)
            .get(`/${fileName}`)
            .reply(404);

        const downloadPromise = downloadFile(`${url}/${fileName}`, 'some-directory');

        await expect(downloadPromise).rejects.toThrow('Status Code: 404');
    });
});
