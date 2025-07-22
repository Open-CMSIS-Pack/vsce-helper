/**
 * Copyright 2024-2025 Arm Limited
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

import { createWriteStream } from 'node:fs';
import { OutgoingHttpHeaders } from 'http';
import https from 'https';

export async function downloadFile(url: string, outputPath: string, headers: OutgoingHttpHeaders = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            headers: {
                Accept: 'application/octet-stream',
                'User-Agent': 'vsce-helpers',
                ...headers,
            },
        };

        console.log(`Downloading file from ${url} ...`);

        const req = https.request(url, requestOptions, res => {
            if (res.statusCode !== undefined && (res.statusCode < 200 || res.statusCode >= 300)) {
                res.destroy();
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    downloadFile(res.headers.location, outputPath).then(resolve, reject);
                } else {
                    const headers = JSON.stringify(res.headers, null, 2);
                    reject(new Error(`Status Code: ${res.statusCode}\n${url}: ${res.statusMessage ?? ''}\n${headers}`));
                }
            } else {
                const writeStream = createWriteStream(outputPath);
                res.pipe(writeStream);

                writeStream.on('error', reject);

                writeStream.on('finish', () => {
                    writeStream.close();
                    resolve(outputPath);
                });
            }

        });

        req.on('error', reject);
        req.end();
    });
}
