const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const releaseType = process.argv[2];
const semanticVersionType = process.argv[3];

async function getReleases(owner, repo) {
  const releases = await octokit.paginate(octokit.repos.listReleases, {
    owner,
    repo,
  });
  return releases;
}

async function getMergedPullRequests(owner, repo, published_at) {
  const pullRequests = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
    state: "closed",
  });
  const mergedPullRequests = pullRequests.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) > new Date(published_at || 0)
  );
  return mergedPullRequests;
}

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

  const releases = await getReleases(owner, repo);
  const latestRelease = releases[0];
  let tag_name = `v0.0.0-canary.0`;
  let releaseNotes = "";
  if (latestRelease) {
    const match = latestRelease.tag_name.match(/(v\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1].substring(1));
      const minor = parseInt(match[2]);
      const patch = parseInt(match[3]);
      const canary = latestRelease.tag_name.includes("canary")
        ? parseInt(
            latestRelease.tag_name.substring(
              latestRelease.tag_name.lastIndexOf(".") + 1
            )
          )
        : -1;

      if (canary >= 0) {
        tag_name = `v${major}.${minor}.${patch}-canary.${canary + 1}`;
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
  }

  if (!latestRelease) {
    console.log("No releases found for repository");
    return;
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

  const releases = await getReleases(owner, repo);
  const latestCanaryRelease = releases.find((release) =>
    release.tag_name.includes("canary")
  );

  if (!latestCanaryRelease) {
    console.log("No canary releases found for repository");
    return;
  }

  const tag_name = latestCanaryRelease.tag_name.split("-canary")[0];
  const name = `${tag_name}`;

  // Get all canary releases of the same version
  const version = tag_name.substring(1);
  const canaryReleases = releases.filter((release) =>
    new RegExp(`^v${version}(-canary\\.\\d*)?$`).test(release.tag_name)
  );

  // Get merged pull requests between first canary release and new release
  const firstCanaryRelease = canaryReleases[canaryReleases.length - 1];
  const mergedPullRequests = await getMergedPullRequests(
    owner,
    repo,
    firstCanaryRelease.published_at
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
