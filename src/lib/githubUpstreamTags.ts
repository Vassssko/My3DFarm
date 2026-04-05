import { pickHighestSemverTag } from "./semverFirmware";

const GITHUB_API = "https://api.github.com";
/** GitHub REST requires a User-Agent. */
const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "User-Agent": "My3DFarm/1.0 (desktop; Klipper farm manager)",
};

export const GITHUB_UPSTREAM_FETCH_TIMEOUT_MS = 10_000;
const TAGS_PER_PAGE = 100;

export type UpstreamRepoRef = { owner: string; repo: string };

export function upstreamRepoKey(r: UpstreamRepoRef): string {
  return `${r.owner}/${r.repo}`;
}

/** Deduplicate by owner/repo so GitHub is queried once per upstream (not per printer / package row). */
export function dedupeUpstreamRepoRefs(repos: readonly UpstreamRepoRef[]): UpstreamRepoRef[] {
  const unique = new Map<string, UpstreamRepoRef>();
  for (const r of repos) {
    unique.set(upstreamRepoKey(r), r);
  }
  return [...unique.values()];
}

type GithubTag = { name?: string };

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) {
      return m[1];
    }
  }
  return null;
}

async function fetchJsonTagsPage(
  url: string,
  signal: AbortSignal,
): Promise<{ names: string[]; nextUrl: string | null }> {
  const r = await fetch(url, { headers: GITHUB_HEADERS, signal });
  if (!r.ok) {
    throw new Error(`github tags ${r.status}`);
  }
  const data = (await r.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("github tags: not an array");
  }
  const names: string[] = [];
  for (const item of data) {
    const name = (item as GithubTag).name;
    if (typeof name === "string" && name.length > 0) {
      names.push(name);
    }
  }
  const nextUrl = parseLinkNext(r.headers.get("Link"));
  return { names, nextUrl };
}

/**
 * Walk Git tag pages until we have names or hit max pages (Klipper/Moonraker have few tags).
 */
export async function fetchHighestSemverTagForRepo(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController();
  const ac = signal ?? controller.signal;
  const timeout =
    signal === undefined
      ? setTimeout(() => controller.abort(), GITHUB_UPSTREAM_FETCH_TIMEOUT_MS)
      : undefined;

  try {
    let url = `${GITHUB_API}/repos/${owner}/${repo}/tags?per_page=${TAGS_PER_PAGE}`;
    const allNames: string[] = [];
    const maxPages = 5;

    for (let i = 0; i < maxPages; i++) {
      const { names, nextUrl } = await fetchJsonTagsPage(url, ac);
      allNames.push(...names);
      if (!nextUrl) {
        break;
      }
      url = nextUrl;
    }
    return pickHighestSemverTag(allNames);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

/**
 * Fetches latest semver tag for each unique owner/repo in one parallel batch.
 * Call this once per refresh; compare results to per-printer Moonraker versions locally.
 */
export async function fetchHighestSemverTagsForUniqueRepos(
  repos: readonly UpstreamRepoRef[],
  signal?: AbortSignal,
): Promise<Map<string, string | null>> {
  const unique = dedupeUpstreamRepoRefs(repos);
  const entries = await Promise.all(
    unique.map(async (r) => {
      const tag = await fetchHighestSemverTagForRepo(r.owner, r.repo, signal);
      return [upstreamRepoKey(r), tag] as const;
    }),
  );
  return new Map(entries);
}

export const UPSTREAM_KLIPPER_REPO = { owner: "Klipper3d", repo: "klipper" } as const;
export const UPSTREAM_MOONRAKER_REPO = { owner: "Arksine", repo: "moonraker" } as const;
