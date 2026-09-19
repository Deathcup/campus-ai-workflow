import { describe, expect, it } from "vitest";
import { parseMergeRequestUrl } from "./git-workspace.js";

describe("parseMergeRequestUrl", () => {
  it("parses GitHub pull request URLs", () => {
    expect(parseMergeRequestUrl("https://github.com/acme/platform/pull/42")).toEqual({
      provider: "github",
      repositoryUrl: "https://github.com/acme/platform.git",
      fetchRef: "refs/pull/42/head",
      number: 42
    });
  });

  it("parses nested GitLab merge request URLs", () => {
    expect(parseMergeRequestUrl("https://git.example.com/group/team/platform/-/merge_requests/17")).toEqual({
      provider: "gitlab",
      repositoryUrl: "https://git.example.com/group/team/platform.git",
      fetchRef: "refs/merge-requests/17/head",
      number: 17
    });
  });

  it("rejects unsupported links", () => {
    expect(() => parseMergeRequestUrl("https://github.com/acme/platform/issues/1")).toThrow(
      "仅支持 GitHub PR 或 GitLab MR 链接"
    );
  });
});
