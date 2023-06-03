# Release Workflow

This repository contains a GitHub Actions workflow for creating canary and regular releases for a GitHub repository.

## Workflow

The workflow is triggered manually using the `workflow_dispatch` event. When the workflow is triggered, the user can select the release type (`canary` or `release`) and the semantic version type (`major`, `minor`, or `patch`) using the provided inputs.

The workflow consists of a single job named `release` that runs on an `ubuntu-latest` runner. The job checks out the code, sets up Node.js, installs dependencies, and runs a script to create the release.

The script is located at `./scripts/startRelease.js` and takes two arguments: the release type and the semantic version type. The script uses these arguments to determine which function to call (`createCanaryRelease` or `createRelease`) and how to increment the version number.

## Functions

The script defines two functions: `createCanaryRelease` and `createRelease`.

The `createCanaryRelease` function creates a new canary release for a GitHub repository. A canary release is a pre-release version of the software that is made available to a limited number of users for testing purposes. The function increments the version number of the latest release and adds a `-canary.X` suffix, where `X` is the canary release number. It also generates release notes based on merged pull requests between the latest release and the new canary release.

The `createRelease` function creates a new regular release for a GitHub repository. A regular release is a stable version of the software that is made available to all users. The function removes the `-canary.X` suffix from the latest canary release's tag name to create the tag name for the new release. It also generates release notes based on merged pull requests between the first canary release of the same version and the new release.

Both functions use the GitHub API to create a new release on the repository.

## Usage

To use this workflow, you will need to provide a personal access token with the `repo` scope as a secret named `PERSONAL_ACCESS_TOKEN`. This token is used by the script to authenticate with the GitHub API and create releases.

To trigger the workflow manually, go to the "Actions" tab of your repository, select the "Release" workflow from the list on the left, and click on the "Run workflow" button. Select the release type and semantic version type from the dropdown menus and click on the "Run workflow" button again to start the workflow.



# LEGACY - Canary Release Script

This script listens for a `repository_dispatch` event with the action `create_canary_release` and creates a new canary release for the repository.

## How it works

1. The script retrieves the latest release for the repository using the `context.octokit.repos.listReleases` method.
2. If a latest release is found, the script extracts the major, minor, and patch version numbers from the release's tag name.
3. If the latest release is a canary release, the script increments the canary version number. Otherwise, it increments the major, minor, or patch version number based on the `release_type` specified in the `client_payload` of the `repository_dispatch` event.
4. The script retrieves a list of merged pull requests between the latest release and the new canary release using the `context.octokit.pulls.list` method.
5. The pull requests are grouped by label into core changes, documentation changes, and miscellaneous changes.
6. The script generates release notes for the new canary release by listing the changes in each group and including a list of contributors.
7. Finally, the script creates a new canary release using the `context.octokit.repos.createRelease` method with the generated tag name and release notes.

## Usage

To trigger this script and create a new canary release, you need to send a `repository_dispatch` event to your repository with the action `create_canary_release` and specify the `release_type` in the `client_payload`. For example:

```curl
curl -X POST
-H “Accept: application/vnd.github.everest-preview+json”
-H “Authorization: token YOUR_PERSONAL_ACCESS_TOKEN”
-d ‘{“event_type”: “create_canary_release”, “client_payload”: {“release_type”: “minor”}}’
https://api.github.com/repos/OWNER/REPO/dispatches
```

This will create a new canary release with an incremented minor version number.
