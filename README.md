# Open-CMSIS-Pack vsce-helper node module

This node module provides shared helper code used to package Visual Studio Code extensions.

## Installation

`npm i --save-dev @open-cmsis-pack/vsce-helper`

Note: Requires node registry `npm.pkg.github.com`

## Tool Dependency Download

The `Downloader` class provides a configurable command line interface to download assets (i.e., `Downloadables`) from
various sources.

Each `Downloadable` returns the `Asset` to be fetched/extracted based on the requested `target` system os and
architecture.

```ts
#!/usr/bin/env npx tsx

import { ArchiveFileAsset, Downloadable, Downloader, GitHubReleaseAsset  } from '@open-cmsis-pack/vsce-helper';

const myTool : Downloadable = new Downloadable(
    'My Tool Dependency', 'my-tool',
    async (target) => {
        const releaseAsset = new GitHubReleaseAsset(
            'my-org', 'my-tool', 
            '1.0.0', 
            `my-tool-${target}`, 
            { token: process.env.GITHUB_TOKEN });
        const asset = new ArchiveFileAsset(releaseAsset, 1);
        return asset;
    },
)

const downloader = new Downloader({ myTool });
downloader.run();
```

The script offers inline command line help:

```sh
> ./download.ts --help
download.ts [<tools> ...]

Downloads the tool(s) for the given architecture and OS

Positionals:
  tools  Dependency to be fetched
           [string] [Choices: "myTool"] [Default: ["myTool"]]

Options:
      --help    Show help [boolean]
  -t, --target  VS Code extension target, defaults to system
               [string] [Choices: "win32-x64", "win32-arm64", "linux-x64",
         "linux-arm64", "darwin-x64", "darwin-arm64"] [Default: "<os>-<arch>"]
  -d, --dest    Destination directory for the tools          [string] [Default:
                   "<cwd>/tools"]
  -f, --force   Force download of tools              [boolean] [Default: false]
  -c, --cache   Cache directory for downloaded tools
                            [string] [Default: "<package manager cache folder>"]
```

And can simply be used to all defined tools with

```sh
> ./download.ts
```

Tools are only downloaded if not yet available in the workspace. If a cache is used, downloaded files are stored in
the cache and reused if required to avoid re-downloads.

From within `package.json` the script can be used like

```json
{
    "scripts":
    {
        "download": "tsx download.ts"
    }
}
```

## Reference

This section gives a comprehensive reference of available asset classes.
Refer to the JSDOC API documentation for more details about each function call and parameters.

### Downloader

Main class to create a project specific downloader script:

```ts
// Create and configure instance
const downloader = new Downloader({ <downloadable> [, <downloadable>]... })
    .withProjectDir(<projectDir>)
    .withTargetDir(<targetDir>)
    .withCacheDir(<cacheDir>);

// Load <projectDir>/package.json
// e.g., to read tool version from
const packageJson = await downloader.getPackageJson();

// Retrieve package manager used according to package.json
const packageManager = await downloader.packageManager();

// Retrieve default cache directory based on the configured package manager
const defaultCacheDir = await downloader.defaultCacheDir();

// Issue the download of a single downloadable
downloader.download(<tool>, <target_platform>[, <options>]);

// Run downloader with optional command line arguments, defaults to hidebin(process.argv)
// I.e., runs download() for all selected tools concurrently according to given <argv>
downloader.run([<argv>]);
```

### File Assets

File assets can be local or remote files and archives to be copied or extracted.

#### LocalFileAsset

A local file to be copied:

```ts
const localFileAsset = new LocalFileAsset(<filepath>, [<targetName>]);
localFileAsset.copyTo(<dest>);
```

The file denoted by `<filepath>` is copied to the `<dest>` folder and optionally renamed to `<targetName>` if
specified.

#### WebFileAsset

A file to be downloaded from a web resource:

```ts
const webFileAsset = new WebFileAsset(<url>, [<filename>], [<version>], [<headers>]);
webFileAsset.copyTo(<dest>);
```

The file served by `<url>` is downloaded to the `<dest>` folder using the explicit `<filename>` if given. The optional
`<version>` can be used to avoid re-downloading the same file. And `<headers>` can be used with additional HTTP-Headers
to pass in required authentication for example.

#### ArchiveFileAsset

An archive file to be extracted.

```ts
const subject = new WebFileAsset(<url>);
const archiveFileAsset = new ArchiveFileAsset(<subject>, [<strip>]);
archiveFileAsset.copyTo(<dest>);
```

The `<subject>` asset (e.g., LocalFileAsset or WebFileAsset) is extracted into `<dest>` folder. If `<strip>` is given
this number of directory layers are stripped during extraction.

The `<subject>` asset itself is copied to a temporary location.

### GitHub Assets

GitHub Assets are artifacts fetched from a GitHub repository.

Every asset accepts optional `<options>`:

- `token` to specify the `GITHUB_TOKEN` to be used for GitHub API access
  
  ⚠ When using the default `GITHUB_TOKEN` from within a GitHub workflow
  mind to set the required access `permissions:` for the different asset types.

#### GitHubReleaseAsset

⚠ Workflow Permissions: `contents: read`

An artifact attached to a GitHub Release to be downloaded:

```ts
const githubReleaseAsset = new GitHubReleaseAsset(<owner>, <repo>, <tag>, <assetName>, [<options>]);
githubReleaseAsset.copyTo(<dest>);
```

The GitHub repository `<owner>/<repo>` is searched for a release tagged as `<tag>`. If a regexp matching multiple
releases the latest one is used. The release assets are searched for one named `<assetName>` which gets downloaded
into `<dest>` folder.

Chaining up with `ArchiveFileAsset`:

```ts
const archiveFileAsset = new ArchiveFileAsset(githubReleaseAsset, [<strip>]);
archiveFileAsset.copyTo(<dest>);
```

This extracts the release asset archive into the `<dest>` folder.

#### GitHubRepoAsset

⚠ Workflow Permissions: `contents: read`

Fetch the content of a GitHub repository:

```ts
const gitHubRepoAsset = new GitHubRepoAsset(<owner>, <repo>, [<options>]);
gitHubRepoAsset.copyTo(<dest>);
```

The content of the repository `<owner>/<repo>` is downloaded into the `<dest>` folder.

The options can be used to specify details:

- `ref` gives the branch or tag to use instead of `main`
- `path` gives one or more files/folders of the repo to be copied

For example, one could fetch the content of the `html` folder only from the `gh-pages` branch:

```ts
const gitHubRepoAsset = new GitHubRepoAsset(<owner>, <repo>, { ref: 'gh-pages', path: 'html' });
gitHubRepoAsset.copyTo(<dest>);
```

#### GitHubWorkflowAsset

⚠ Workflow Permissions: `actions: read`

Fetch an asset attached to a GitHub Workflow run:

```ts
const gitHubWorkflowAsset = new GitHubWorkflowAsset(<owner>, <repo>, <workflow>, <artifactName>, [<options>]);
gitHubWorkflowAsset.copyTo(<dest>);
```

The repository `<owner>/<repo>` is searched for most recent run of `<workflow>` (e.g., `build.yml`). If found, the run
is inspected for an attached `<artifactName>` which gets downloaded and extracted to `<dest>`. I.e., GitHub by default
puts everything into Zip archives. This top-level archive is extracted so that the files appear exactly the way they
appeared on the runner during the workflow run.
