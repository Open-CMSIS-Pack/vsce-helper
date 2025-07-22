/**
 * Copyright 2025 Arm Limited
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

import { AbstractAsset, Asset } from './downloader.ts';
import path from 'node:path';
import { OutgoingHttpHeaders } from 'node:http';
import fs from 'node:fs/promises';

export class ArchiveFileAsset extends AbstractAsset {

    constructor(
        protected readonly subject: Asset,
        protected readonly strip: number = 0,
    ) {
        super();
        this.addDisposable(this.subject);
    }

    public withCacheDir(cacheDir: string): Asset {
        this.subject.withCacheDir(cacheDir);
        return super.withCacheDir(cacheDir);
    }

    public get version() {
        return this.subject.version;
    }

    public async copyTo(dest?: string) {
        const archiveFile = await this.subject.copyTo();
        return this.extractArchive(archiveFile, dest, { strip: this.strip });
    }

}

export class WebFileAsset extends AbstractAsset {

    constructor(
        protected readonly url: URL,
        protected readonly filename?: string,
        protected readonly _version?: string,
        protected readonly headers: OutgoingHttpHeaders = {},
    ) {
        super();
    }

    get version() {
        return this._version;
    }

    get cacheId() {
        return path.join(this.url.host, path.normalize(this.url.pathname));
    }

    public async copyTo(dest?: string) {
        dest = await this.mkDest(dest);
        const destFile = path.join(dest, this.filename ?? path.basename(this.url.pathname));
        return this.downloadFile(this.url, destFile, this.headers);
    }

}

export class LocalFileAsset extends AbstractAsset {

    constructor(
        protected readonly filepath: string,
        protected readonly targetName?: string,
    ) {
        super();
    }

    public async copyTo(dest?: string) {
        dest = await this.mkDest(dest);
        await fs.copyFile(this.filepath, path.join(dest, this.targetName ?? path.basename(this.filepath)));
        return dest;
    }

}

