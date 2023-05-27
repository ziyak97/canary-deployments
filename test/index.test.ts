// You can import your modules
// import index from '../src/index'

import nock from "nock";
// Requiring our app implementation
import myProbotApp from "../src";
import { Probot, ProbotOctokit } from "probot";
// Requiring our fixtures
const fs = require("fs");
const path = require("path");

const privateKey = fs.readFileSync(
  path.join(__dirname, "fixtures/mock-cert.pem"),
  "utf-8"
);

describe("My Probot app", () => {
  let probot: any;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  test("creates a canary release from a stable release with a major release bump", async () => {
    const mock = nock("https://api.github.com")
      // Test that a release is created
      .post("/repos/hiimbex/testing-things/releases", (body: any) => {
        expect(body).toMatchObject({
          name: "v2.0.0-canary.0 Pre-release",
          tag_name: "v2.0.0-canary.0",
        });

        return true;
      })
      .reply(200)

      // Test that releases are listed
      .get("/repos/hiimbex/testing-things/pulls?state=closed")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/pulls/1",
          number: 1,
          title: "Add new feature",
          user: {
            login: "contributor1",
          },
          labels: [
            {
              name: "area:core",
            },
          ],
          merged_at: "2022-01-02T00:00:00Z",
        },
      ])

      .get("/repos/hiimbex/testing-things/releases")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/releases/1",
          tag_name: "v1.0.0",
          name: "Version 1.0.0",
          body: "This is the first release",
          published_at: "2022-01-01T00:00:00Z",
        },
      ]);

    // Receive a webhook event
    await probot.receive({
      name: "repository_dispatch",
      payload: {
        action: "create_canary_release",
        client_payload: {
          release_type: "major",
        },
        repository: {
          name: "testing-things",
          owner: {
            login: "hiimbex",
          },
        },
      },
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("creates a canary release from a stable release with a minor release bump", async () => {
    const mock = nock("https://api.github.com")
      // Test that a release is created
      .post("/repos/hiimbex/testing-things/releases", (body: any) => {
        expect(body).toMatchObject({
          name: "v1.1.0-canary.0 Pre-release",
          tag_name: "v1.1.0-canary.0",
        });

        return true;
      })
      .reply(200)

      // Test that releases are listed
      .get("/repos/hiimbex/testing-things/pulls?state=closed")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/pulls/1",
          number: 1,
          title: "Add new feature",
          user: {
            login: "contributor1",
          },
          labels: [
            {
              name: "area:core",
            },
          ],
          merged_at: "2022-01-02T00:00:00Z",
        },
      ])

      .get("/repos/hiimbex/testing-things/releases")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/releases/1",
          tag_name: "v1.0.0",
          name: "Version 1.0.0",
          body: "This is the first release",
          published_at: "2022-01-01T00:00:00Z",
        },
      ]);

    // Receive a webhook event
    await probot.receive({
      name: "repository_dispatch",
      payload: {
        action: "create_canary_release",
        client_payload: {
          release_type: "minor",
        },
        repository: {
          name: "testing-things",
          owner: {
            login: "hiimbex",
          },
        },
      },
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("creates a canary release from a stable release with a patch release bump", async () => {
    const mock = nock("https://api.github.com")
      // Test that a release is created
      .post("/repos/hiimbex/testing-things/releases", (body: any) => {
        expect(body).toMatchObject({
          name: "v1.0.1-canary.0 Pre-release",
          tag_name: "v1.0.1-canary.0",
        });

        return true;
      })
      .reply(200)

      // Test that releases are listed
      .get("/repos/hiimbex/testing-things/pulls?state=closed")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/pulls/1",
          number: 1,
          title: "Add new feature",
          user: {
            login: "contributor1",
          },
          labels: [
            {
              name: "area:core",
            },
          ],
          merged_at: "2022-01-02T00:00:00Z",
        },
      ])

      .get("/repos/hiimbex/testing-things/releases")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/releases/1",
          tag_name: "v1.0.0",
          name: "Version 1.0.0",
          body: "This is the first release",
          published_at: "2022-01-01T00:00:00Z",
        },
      ]);

    // Receive a webhook event
    await probot.receive({
      name: "repository_dispatch",
      payload: {
        action: "create_canary_release",
        client_payload: {
          release_type: "patch",
        },
        repository: {
          name: "testing-things",
          owner: {
            login: "hiimbex",
          },
        },
      },
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("creates a canary release from a another canary", async () => {
    const mock = nock("https://api.github.com")
      // Test that a release is created
      .post("/repos/hiimbex/testing-things/releases", (body: any) => {
        expect(body).toMatchObject({
          name: "v1.0.0-canary.1 Pre-release",
          tag_name: "v1.0.0-canary.1",
        });

        return true;
      })
      .reply(200)

      // Test that releases are listed
      .get("/repos/hiimbex/testing-things/pulls?state=closed")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/pulls/1",
          number: 1,
          title: "Add new feature",
          user: {
            login: "contributor1",
          },
          labels: [
            {
              name: "area:core",
            },
          ],
          merged_at: "2022-01-02T00:00:00Z",
        },
      ])

      .get("/repos/hiimbex/testing-things/releases")
      .reply(200, [
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/releases/1",
          tag_name: "v1.0.0-canary.0",
          name: "Version 1.0.0-canary.0",
          body: "This is the first release",
          published_at: "2022-01-01T00:00:00Z",
        },
        {
          url: "https://api.github.com/repos/hiimbex/testing-things/releases/2",
          tag_name: "v1.0.0-canary.0",
          name: "Version 1.0.0 Canary 0",
          body: "This is the first canary release",
          published_at: "2022-01-02T00:00:00Z",
        },
      ]);

    // Receive a webhook event
    await probot.receive({
      name: "repository_dispatch",
      payload: {
        action: "create_canary_release",
        client_payload: {
          release_type: "patch",
        },
        repository: {
          name: "testing-things",
          owner: {
            login: "hiimbex",
          },
        },
      },
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
