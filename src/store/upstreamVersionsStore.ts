import { create } from "zustand";
import {
  fetchHighestSemverTagsForUniqueRepos,
  upstreamRepoKey,
  UPSTREAM_KLIPPER_REPO,
  UPSTREAM_MOONRAKER_REPO,
} from "../lib/githubUpstreamTags";

/** Every GitHub repo used for “newer upstream” hints; deduped before any API calls. */
export const GITHUB_UPSTREAM_REPOS_FOR_VERSION_HINTS = [
  UPSTREAM_KLIPPER_REPO,
  UPSTREAM_MOONRAKER_REPO,
] as const;

const CACHE_MS = 60 * 60 * 1000;
const ERROR_BACKOFF_MS = 2 * 60 * 1000;

type UpstreamState = {
  klipperTag: string | null;
  moonrakerTag: string | null;
  status: "idle" | "loading" | "ready" | "error";
  fetchedAt: number;
  ensureFetched: () => Promise<void>;
};

let inflight: Promise<void> | null = null;

export const useUpstreamVersionsStore = create<UpstreamState>((set, get) => ({
  klipperTag: null,
  moonrakerTag: null,
  status: "idle",
  fetchedAt: 0,

  ensureFetched: async () => {
    const { status, fetchedAt } = get();
    const age = Date.now() - fetchedAt;
    if (status === "ready" && age < CACHE_MS) {
      return;
    }
    if (status === "error" && age < ERROR_BACKOFF_MS) {
      return;
    }
    if (inflight) {
      return inflight;
    }

    inflight = (async () => {
      set({ status: "loading" });
      try {
        const tagByRepo = await fetchHighestSemverTagsForUniqueRepos(GITHUB_UPSTREAM_REPOS_FOR_VERSION_HINTS);
        set({
          klipperTag: tagByRepo.get(upstreamRepoKey(UPSTREAM_KLIPPER_REPO)) ?? null,
          moonrakerTag: tagByRepo.get(upstreamRepoKey(UPSTREAM_MOONRAKER_REPO)) ?? null,
          status: "ready",
          fetchedAt: Date.now(),
        });
      } catch {
        set({ status: "error", fetchedAt: Date.now() });
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },
}));
