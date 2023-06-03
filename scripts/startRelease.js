const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const releaseType = process.argv[2];
const semanticVersionType = process.argv[3];

/**
 * @typedef {Object} PullRequest
 * @property {string} title - The title of the pull request
 * @property {number} number - The number of the pull request
 * @property {string} merged_at - The date and time when the pull request was merged
 * @property {Object} user - The user who created the pull request
 * @property {string} user.login - The login name of the user who created the pull request
 * @property {Array<Object>} labels - The labels attached to the pull request
 * @property {string} labels.name - The name of a label attached to the pull request
 */

/**
 * @typedef {Object} Release
 * @property {string} tag_name - The tag name of the release
 * @property {string} published_at - The date and time when the release was published
 * @property {string} name - The name of the release
 * @property {boolean} prerelease - Whether the release is a prerelease
 */

/**
 * Retrieves lastest stable release for a repository.
 *
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @returns {Promise<Array<Release>>} An array of releases for the repository
 */
async function getLastStableRelease(owner, repo) {
  const iterator = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  });

  for await (const { data: releases } of iterator) {
    for (const release of releases) {
      if (!release.prerelease) {
        return release;
      }
    }
  }
}

/**
 * Get the latest release for a given repository.
 * @async
 * @function
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @returns {Promise<Release>} - A Promise that resolves to the latest release object.
 */
async function getLastestRelease(owner, repo) {
  const releases = await octokit.paginate(octokit.repos.listReleases, {
    owner,
    repo,
    per_page: 1,
  });

  return releases[0];
}

/**
 * Retrieves merged pull requests for a repository.
 *
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} published_at - The date and time to retrieve merged pull requests after
 * @returns {Promise<Array<PullRequest>>} An array of merged pull requests for the repository
 */
async function getMergedPullRequests(owner, repo, published_at) {
  const query = `repo:${owner}/${repo} is:pr is:merged updated:>${published_at}`;
  const response = await octokit.search.issuesAndPullRequests({ q: query });
  const mergedPullRequests = response.data.items;
  return mergedPullRequests;
}

/**
 * Groups an array of pull requests by label.
 *
 * @param {Array<PullRequest>} pullRequests - An array of pull requests to group by label
 * @returns {{coreChanges: Array<PullRequest>, documentationChanges: Array<PullRequest>, miscellaneousChanges: Array<PullRequest>}} An object containing arrays of grouped pull requests by label
 */
function groupPullRequestsByLabel(pullRequests) {
  let coreChanges = [];
  let documentationChanges = [];
  let miscellaneousChanges = [];

  for (const pr of pullRequests) {
    if (pr.labels.some((label) => label.name === "area:core")) {
      coreChanges.push(pr);
    } else if (pr.labels.some((label) => label.name === "area:documentation")) {
      documentationChanges.push(pr);
    } else {
      miscellaneousChanges.push(pr);
    }
  }

  return { coreChanges, documentationChanges, miscellaneousChanges };
}

/**
 * Generates release notes from grouped pull requests.
 *
 * @param {Array<PullRequest>} coreChanges - An array of core changes pull requests
 * @param {Array<PullRequest>} documentationChanges - An array of documentation changes pull requests
 * @param {Array<PullRequest>} miscellaneousChanges - An array of miscellaneous changes pull requests
 * @returns {string} A string containing release notes generated from grouped pull requests
 */
function generateReleaseNotes(
  coreChanges,
  documentationChanges,
  miscellaneousChanges
) {
  let releaseNotes = "";

  if (coreChanges.length > 0) {
    releaseNotes += "## Core Changes\n";

    for (const pr of coreChanges) {
      releaseNotes += `- ${pr.title}: #${pr.number}\n`;
    }

    releaseNotes += "\n";
  }

  if (documentationChanges.length > 0) {
    releaseNotes += "## Documentation Changes\n";

    for (const pr of documentationChanges) {
      releaseNotes += `- ${pr.title}: #${pr.number}\n`;
    }

    releaseNotes += "\n";
  }

  if (miscellaneousChanges.length > 0) {
    releaseNotes += "## Miscellaneous Changes\n";

    for (const pr of miscellaneousChanges) {
      releaseNotes += `- ${pr.title}: #${pr.number}\n`;
    }

    releaseNotes += "\n";
  }

  return releaseNotes;
}

/**
 * Generates a list of contributors from an array of merged pull requests.
 *
 * @param {Array<PullRequest>} mergedPullRequests - An array of merged pull requests to generate a list of contributors from
 * @returns {string} A string containing a list of contributors generated from an array of merged pull requests
 */
function generateContributorsList(mergedPullRequests) {
  let contributors = new Set();

  for (const pr of mergedPullRequests) {
    contributors.add(pr.user?.login);
  }

  let contributorsList = "";

  if (contributors.size > 0) {
    contributorsList += "## Contributors\n";
    contributorsList += "A big thank you to our ";
    let contributorsArray = Array.from(contributors);

    if (contributorsArray.length === 1) {
      contributorsList += `contributor @${contributorsArray[0]}.`;
    } else {
      contributorsList += "contributors ";

      for (const [index, contributor] of contributorsArray.entries()) {
        if (index === contributorsArray.length - 1) {
          contributorsList += `and @${contributor}.`;
        } else {
          contributorsList += `@${contributor}, `;
        }
      }
    }

    contributorsList += "\n";
  }

  return contributorsList;
}

async function createCanaryRelease() {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  const latestRelease = await getLastestRelease(owner, repo);

  let tag_name = `v0.0.0-canary.0`;
  let releaseNotes = "";
  if (latestRelease) {
    const match = latestRelease.tag_name.match(/(v\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1].substring(1));
      const minor = parseInt(match[2]);
      const patch = parseInt(match[3]);
      const isCanary = latestRelease.prerelease;
      const canaryVersion = isCanary ? parseInt(latestRelease.tag_name.split("canary.")[1]) : null;

      if (isCanary) {
        tag_name = `v${major}.${minor}.${patch}-canary.${canaryVersion + 1}`;
      } else {
        // Increment version number based on semantic version type
        switch (semanticVersionType) {
          case "major":
            tag_name = `v${major + 1}.0.0-canary.0`;
            break;
          case "minor":
            tag_name = `v${major}.${minor + 1}.0-canary.0`;
            break;
          case "patch":
            tag_name = `v${major}.${minor}.${patch + 1}-canary.0`;
            break;
        }
      }
    }
    // Get merged pull requests between latest release and new canary release
    const mergedPullRequests = await getMergedPullRequests(
      owner,
      repo,
      latestRelease.published_at
    );

    // Guard clause: No merged pull requests
    if (mergedPullRequests.length === 0) {
      console.log(
        "No merged pull requests found between latest release and new canary release"
      );
      return;
    }

    // Group pull requests by label
    const { coreChanges, documentationChanges, miscellaneousChanges } =
      groupPullRequestsByLabel(mergedPullRequests);

    // Generate release notes
    releaseNotes += generateReleaseNotes(
      coreChanges,
      documentationChanges,
      miscellaneousChanges
    );

    // Generate list of contributors
    releaseNotes += generateContributorsList(mergedPullRequests);
  } else {
    // No releases found for repository
    switch (semanticVersionType) {
      case "major":
        tag_name = `v1.0.0-canary.0`;
        break;
      case "minor":
        tag_name = `v0.1.0-canary.0`;
        break;
      case "patch":
        tag_name = `v0.0.1-canary.0`;
        break;
    }
  }

  const name = `${tag_name}`;
  const body = `New canary release based on ${latestRelease.tag_name}\n\n${releaseNotes}`;
  await octokit.repos.createRelease({
    owner,
    repo,
    tag_name,
    name,
    body,
    prerelease: true,
  });
}

async function createRelease() {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  const latestRelease = await getLastestRelease(owner, repo);
  const latestCanaryRelease = latestRelease.prerelease ? latestRelease : null;

  if (!latestCanaryRelease) {
    console.log("No canary releases found for repository");
    return;
  }

  const tag_name = latestCanaryRelease.tag_name.split("-canary")[0];

  const lastStableRelease = await getLastStableRelease(owner, repo);

  const mergedPullRequests = await getMergedPullRequests(
    owner,
    repo,
    lastStableRelease.published_at
  );

  // Guard clause: No merged pull requests
  if (mergedPullRequests.length === 0) {
    console.log(
      "No merged pull requests found between latest release and new canary release"
    );
    return;
  }

  // Group pull requests by label
  const { coreChanges, documentationChanges, miscellaneousChanges } =
    groupPullRequestsByLabel(mergedPullRequests);

  // Generate release notes
  let releaseNotes = generateReleaseNotes(
    coreChanges,
    documentationChanges,
    miscellaneousChanges
  );

  // Generate list of contributors
  releaseNotes += generateContributorsList(mergedPullRequests);

  await octokit.repos.createRelease({
    owner,
    repo,
    tag_name,
    name,
    body: `New release based on ${latestCanaryRelease.tag_name}\n\n${releaseNotes}`,
    prerelease: false,
  });
}

if (releaseType === "canary") {
  createCanaryRelease();
} else if (releaseType === "release") {
  createRelease();
}
