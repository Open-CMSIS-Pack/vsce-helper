# Open-CMSIS-Pack vsce-helper node module

This node module provides shared helper code used to package Visual Studio Code extensions.

## Installation

`npm i --save-dev @open-cmsis-pack/vsce-helper`

Note: Requires node registry `npm.pkg.github.com`

## Tool Dependency Download

The `Downloader` class provides a configurable command line interface to download assets (i.e., `Downloadables`) from various sources.

Each `Downloadable` returns the `Asset` to be fetched/extracted based on the requested `target` system os and architecture.

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

Tools are only downloaded if not yet available in the workspace. If a cache is used, downloaded files are stored in the cache and reused if required to avoid re-downloads.

From within `package.json` the script can be used like

```json
{
    "scripts": {
        "download": "tsx download.ts",
    }
}
```
