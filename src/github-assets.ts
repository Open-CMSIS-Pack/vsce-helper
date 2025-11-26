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

import { URL } from 'url';
import { AbstractAsset } from './downloader.ts';
import { OutgoingHttpHeaders } from 'http';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { Octokit } from 'octokit';

/** Options to access assets at GitHub */
type GitHubAssetOptions = {
    /** GitHub personal access token for authentication. */
    token?: string;
};

/**
 * Base class for GitHub assets.
 * Provides common functionality for downloading and managing GitHub assets.
 */
export abstract class GitHubAsset<T extends GitHubAssetOptions = GitHubAssetOptions> extends AbstractAsset {
    private static readonly OCTOKIT = new Map<string, Octokit>();
    private readonly refs = new Map<string, string>();

    /**
     * Creates an instance of GitHubAsset.
     * @param owner The owner (or org) of the repository.
     * @param repo The name of the repository.
     * @param options Options for the asset.
     */
    constructor(
        protected readonly owner: string,
        protected readonly repo: string,
        protected readonly options?: T,
    ) {
        super();
    }

    public abstract get version(): Promise<string | undefined> | string | undefined;
    public abstract copyTo(dest: string): Promise<string>;

    protected async getOctokit() {
        const { default: nodeFetch } = await import('node-fetch');
        const ghToken = this.options?.token;
        const octokit = GitHubAsset.OCTOKIT.get(ghToken ?? '') ?? new Octokit({ auth: ghToken, request: { fetch: nodeFetch } });
        GitHubAsset.OCTOKIT.set(ghToken ?? '', octokit);
        return octokit;
    }

    protected get repoAndOwner() {
        return { owner: this.owner, repo: this.repo };
    }

    protected async downloadFile(url: URL, downloadFilePath: string) {
        const headers = {} as OutgoingHttpHeaders;
        if (this.options?.token) {
            headers.authorization = `Bearer ${this.options?.token}`;
        }
        return super.downloadFile(url, downloadFilePath, headers);
    }

    protected async resolveRef(ref: string) {
        if (this.refs.has(ref)) {
            return this.refs.get(ref);
        }
        const octokit = await this.getOctokit();
        const { data: { object } } = await octokit.rest.git.getRef({
            ...this.repoAndOwner, ref,
        });
        this.refs.set(ref, object.sha);
        return object.sha;
    }

    protected async downloadRepo(dest: string, ref: string) {
        const octokit = await this.getOctokit();
        const url = (await octokit.rest.repos.downloadTarballArchive( { ...this.repoAndOwner, ref })).url;
        return this.downloadFile(new URL(url), path.join(dest, 'repo.tar.gz'));
    }

}

type GitHubRelease = RestEndpointMethodTypes['repos']['getReleaseByTag']['response']['data'];

/**
 * Represents a GitHub release asset.
 */
export class GitHubReleaseAsset extends GitHubAsset<GitHubAssetOptions> {
    private releasePromise: Promise<GitHubRelease | undefined> | undefined;

    /**
     * Creates an instance of GitHubReleaseAsset.
     * @param owner The owner (or org) of the repository.
     * @param repo The name of the repository.
     * @param tag The tag (or regex) to match the release.
     * @param assetName The name of the asset to download.
     * @param options Options for the asset.
     */
    constructor(
        owner: string,
        repo: string,
        protected readonly tag: RegExp | string,
        protected readonly assetName: string,
        options?: GitHubAssetOptions,
    ) {
        super(owner, repo, options);
    }

    protected get release() {
        if (this.releasePromise === undefined) {
            this.releasePromise = this.getOctokit()
                .then(octokit => octokit.rest.repos.listReleases(this.repoAndOwner))
                .then(response => response.data.find(r => r.tag_name.match(this.tagRegex)));
        }
        return this.releasePromise;
    }

    public get cacheId() {
        return this.release
            .then(release => `${this.owner}/${this.repo}/${release?.tag_name}`);
    }

    protected get tagRegex() {
        return typeof this.tag === 'string' ? new RegExp(`v?(${this.tag})`) : this.tag;
    }

    protected async findReleaseAsset() {
        const octokit = await this.getOctokit();
        const release = await this.release;

        if (!release) {
            throw new Error(`Could not find release for tag pattern ${this.tagRegex.source}`);
        }

        const assets = (await octokit.rest.repos.listReleaseAssets({ ...this.repoAndOwner, release_id: release.id })).data;
        const asset = assets.find(a => a.name === this.assetName);

        if (!asset) {
            throw new Error(`Could not find release asset ${this.assetName} for release '${release.tag_name}'`);
        }

        return asset;
    }

    public get version() {
        return this.release
            .then(release => release?.tag_name?.match(this.tagRegex)?.[1]);
    }

    public async copyTo(dest?: string)  {
        const { url } = await this.findReleaseAsset();
        dest = await this.mkDest(dest);
        return this.downloadFile(new URL(url), path.join(dest, this.assetName));
    }

}

/**
 * Options for downloading a GitHub repository snapshot.
 */
type GitHubRepoAssetOptions = GitHubAssetOptions & {
    /** The git ref (heads/<branch>, or tags/<tag>) */
    ref?: string;
    /** File(s) or folder(s) to be copied from the repository to the destination */
    path?: string | string[];
};

export class GitHubRepoAsset extends GitHubAsset<GitHubRepoAssetOptions> {
    protected readonly ref: string;

    constructor(
        owner: string,
        repo: string,
        options?: GitHubRepoAssetOptions,
    ) {
        super(owner, repo, options);
        this.ref = options?.ref ?? 'main';
    }

    public get version() {
        return this.resolveRef(this.ref)
            .then(sha => `${this.ref}@${sha}`);
    }

    public get cacheId() {
        return this.resolveRef(this.ref)
            .then(sha => `${this.owner}/${this.repo}/${sha}`);
    }

    public async copyTo(dest: string): Promise<string> {
        const toArray = <T>(value: T | T[] | undefined): T[] => {
            if (Array.isArray(value)) {
                return value;
            }
            if (value !== undefined) {
                return [value];
            }
            return [];
        };

        const temp = await this.mkTempDir();
        const archive = await this.downloadRepo(temp, this.ref);
        const extracted = await this.extractArchive(archive, path.join(temp, 'repo'), { strip: 1 });

        this.addDisposable(() => fs.rm(extracted, { recursive: true, force: true }));

        const paths = toArray(this.options?.path ?? '');

        await fs.mkdir(dest, { recursive: true });

        for (const srcPath of paths) {
            const src = path.join(extracted, srcPath);
            console.log(`Copying ${src} to ${dest}`);
            await this.copyRecursive(src, dest, { strip: 1 });
        }

        return dest;
    }

}

/**
 * Represents a GitHub workflow artifact.
 */
export class GitHubWorkflowAsset extends GitHubAsset {
    private lastWorkflowRunPromise: Promise<RestEndpointMethodTypes['actions']['listWorkflowRuns']['response']['data']['workflow_runs'][number]> | undefined;

    /**
     * Creates an instance of GitHubWorkflowAsset.
     *
     * Note: If the workflow artifact is an archive, it gets automatically extracted.
     * Hence, do not chain with `ArchiveFileAsset`.
     *
     * @param owner The owner (or org) of the repository.
     * @param repo The name of the repository.
     * @param workflow The name of the workflow (e.g., build.yml).
     * @param artifactName The name of the artifact to download.
     * @param options Options for the asset.
     */
    constructor(
        owner: string,
        repo: string,
        protected readonly workflow: string,
        protected readonly artifactName: string | RegExp,
        options?: GitHubAssetOptions,
    ) {
        super(owner, repo, options);
    }

    protected get lastWorkflowRun() {
        if (!this.lastWorkflowRunPromise) {
            const params: RestEndpointMethodTypes['actions']['listWorkflowRuns']['parameters'] = {
                owner: this.owner,
                repo: this.repo,
                workflow_id: this.workflow,
                per_page: 1,
                status: 'success'
            };

            this.lastWorkflowRunPromise = this.getOctokit()
                .then(octokit => octokit.rest.actions.listWorkflowRuns(params))
                .then(response => response.data.workflow_runs[0]);
        }
        return this.lastWorkflowRunPromise;
    }

    protected async downloadArtifact(id: number, downloadFilePath: string) {
        if (!await this.assureFile(downloadFilePath)) {
            const octokit = await this.getOctokit();
            const response = await octokit.rest.actions.downloadArtifact({ ...this.repoAndOwner, artifact_id: id, archive_format: 'zip' });
            await fs.mkdir(path.dirname(downloadFilePath), { recursive: true });
            await fs.writeFile(downloadFilePath, Buffer.from(response.data as ArrayBuffer));
        }
        return downloadFilePath;
    }

    public get version() {
        return this.lastWorkflowRun
            .then(run => `${this.workflow}@${run.id}`);
    }

    public get cacheId() {
        return this.lastWorkflowRun
            .then(run => `${this.owner}/${this.repo}/${this.workflow}/${run.id}`);
    }

    public async copyTo(dest?: string) {
        const octokit = await this.getOctokit();

        const temp = await this.mkTempDir();

        const run = await this.lastWorkflowRun;
        const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({ ...this.repoAndOwner, run_id: run.id });
        const artifact = artifacts.data.artifacts.find(artifact => artifact.name.match(this.artifactName));
        if (!artifact) {
            throw new Error(`No artifact found matching ${this.artifactName} in workflow run ${run.id}`);
        }

        const artifactDownloadPath = path.join(temp, `${artifact.name}.zip`);
        console.debug(`Downloading artifact ${artifact.name} from ${this.workflow}@${run.run_number} ...`);

        await this.downloadArtifact(artifact.id, artifactDownloadPath);

        return this.extractArchive(artifactDownloadPath, dest);
    }
}
