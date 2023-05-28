# Canary Release Script

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
