const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const releaseType = process.argv[2];
const semanticVersionType = process.argv[3];

async function createCanaryRelease() {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  const releases = await octokit.paginate(octokit.repos.listReleases, {
    owner,
    repo,
  });
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
    const pullRequests = await octokit.paginate(octokit.pulls.list, {
      owner,
      repo,
      state: "closed",
    });
    const mergedPullRequests = pullRequests.filter(
      (pr) =>
        pr.merged_at &&
        new Date(pr.merged_at) > new Date(latestRelease.published_at || 0)
    );

    // Guard clause: No merged pull requests
    if (mergedPullRequests.length === 0) {
      console.log(
        "No merged pull requests found between latest release and new canary release"
      );
      return;
    }

    // Group pull requests by label
    const coreChanges = [];
    const documentationChanges = [];
    const miscellaneousChanges = [];
    for (const pr of mergedPullRequests) {
      if (pr.labels.some((label) => label.name === "area:core")) {
        coreChanges.push(pr);
      } else if (
        pr.labels.some((label) => label.name === "area:documentation")
      ) {
        documentationChanges.push(pr);
      } else {
        miscellaneousChanges.push(pr);
      }
    }
    // Generate release notes
    if (coreChanges.length > 0) {
      releaseNotes += "## Core Changes\n";
      for (const pr of coreChanges) {
        releaseNotes += `- ${pr.title}: #${pr.number}\n`;
      }
    }
    if (documentationChanges.length > 0) {
      releaseNotes += "## Documentation Changes\n";
      for (const pr of documentationChanges) {
        releaseNotes += `- ${pr.title}: #${pr.number}\n`;
      }
    }
    if (miscellaneousChanges.length > 0) {
      releaseNotes += "## Miscellaneous Changes\n";
      for (const pr of miscellaneousChanges) {
        releaseNotes += `- ${pr.title}: #${pr.number}\n`;
      }
    }
    // Generate list of contributors
    const contributors = new Set();
    for (const pr of mergedPullRequests) {
      contributors.add(pr.user?.login);
    }
    if (contributors.size > 0) {
      releaseNotes += "## Contributors\n";
      releaseNotes += "A big thank you to our ";
      const contributorsArray = Array.from(contributors);
      if (contributorsArray.length === 1) {
        releaseNotes += `contributor @${contributorsArray[0]}.`;
      } else {
        releaseNotes += "contributors ";
        for (const [index, contributor] of contributorsArray.entries()) {
          if (index === contributorsArray.length - 1) {
            releaseNotes += `and @${contributor}.`;
          } else {
            releaseNotes += `@${contributor}, `;
          }
        }
      }
    }
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
  };
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

  const releases = await octokit.paginate(octokit.repos.listReleases, {
    owner,
    repo,
  });
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
    new RegExp(`^v${version}(-canary\\.\\d+)?$`).test(release.tag_name)
  );

  // Get merged pull requests between first canary release and new release
  const firstCanaryRelease = canaryReleases[canaryReleases.length - 1];
  const pullRequests = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
    state: "closed",
  });
  const mergedPullRequests = pullRequests.filter(
    (pr) =>
      pr.merged_at &&
      new Date(pr.merged_at) > new Date(firstCanaryRelease.published_at || 0)
  );

  // Guard clause: No merged pull requests
  if (mergedPullRequests.length === 0) {
    console.log(
      "No merged pull requests found between latest release and new canary release"
    );
    return;
  }

  // Group pull requests by label
  let coreChanges = [];
  let documentationChanges = [];
  let miscellaneousChanges = [];

  for (const pr of mergedPullRequests) {
    if (pr.labels.some((label) => label.name === "area:core")) {
      coreChanges.push(pr);
    } else if (pr.labels.some((label) => label.name === "area:documentation")) {
      documentationChanges.push(pr);
    } else {
      miscellaneousChanges.push(pr);
    }
  }

  // Generate release notes
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

  // Generate list of contributors
  let contributors = new Set();

  for (const pr of mergedPullRequests) {
    contributors.add(pr.user?.login);
  }

  if (contributors.size > 0) {
    releaseNotes += "## Contributors\n";
    releaseNotes += "A big thank you to our ";
    let contributorsArray = Array.from(contributors);

    if (contributorsArray.length === 1) {
      releaseNotes += `contributor @${contributorsArray[0]}.`;
    } else {
      releaseNotes += "contributors ";

      for (const [index, contributor] of contributorsArray.entries()) {
        if (index === contributorsArray.length - 1) {
          releaseNotes += `and @${contributor}.`;
        } else {
          releaseNotes += `@${contributor}, `;
        }
      }
    }

    releaseNotes += "\n";
  }

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
