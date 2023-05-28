import { Probot } from "probot";

export = (app: Probot) => {
  app.on("repository_dispatch", async (context) => {
    if (context.payload.action === "create_canary_release") {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const releases = await context.octokit.paginate(
        context.octokit.repos.listReleases,
        { owner, repo }
      );
      const latestRelease = releases[0];
      let tag_name = `v13.4.4-canary.0`;
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
            // Increment version number based on release type
            switch (context.payload.client_payload.release_type) {
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
        const pullRequests = await context.octokit.paginate(
          context.octokit.pulls.list,
          { owner, repo, state: "closed" }
        );
        const mergedPullRequests = pullRequests.filter(
          (pr) =>
            pr.merged_at &&
            new Date(pr.merged_at) > new Date(latestRelease.published_at || 0)
        );
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
          releaseNotes += "## Core Changes";
          for (const pr of coreChanges) {
            releaseNotes += `- ${pr.title}: #${pr.number}`;
          }
        }
        if (documentationChanges.length > 0) {
          releaseNotes += "## Documentation Changes";
          for (const pr of documentationChanges) {
            releaseNotes += `- ${pr.title}: #${pr.number}`;
          }
        }
        if (miscellaneousChanges.length > 0) {
          releaseNotes += "## Miscellaneous Changes";
          for (const pr of miscellaneousChanges) {
            releaseNotes += `- ${pr.title}: #${pr.number}`;
          }
        }
        // Generate list of contributors
        const contributors = new Set();
        for (const pr of mergedPullRequests) {
          contributors.add(pr.user?.login);
        }
        if (contributors.size > 0) {
          releaseNotes += "## Contributors";
          releaseNotes += "A big thank you to our contributors ";
          const contributorsArray = Array.from(contributors);
          for (const [index, contributor] of contributorsArray.entries()) {
            if (index === contributorsArray.length - 1) {
              releaseNotes += `and @${contributor}.`;
            } else {
              releaseNotes += `@${contributor}, `;
            }
          }
        }
      }

      if (!latestRelease) {
        console.log("No releases found for repository");
        return;
      }

      const name = `${tag_name}`;
      const body = `New canary release based on ${latestRelease.tag_name}\n\n${releaseNotes}`;
      await context.octokit.repos.createRelease({
        owner,
        repo,
        tag_name,
        name,
        body,
        prerelease: true,
      });
    }
  });
};
