import { isTauri } from "./isTauri";

export type SshEndpointPayload = { host: string; port: number; user: string };

export type SshIdentityInfo = {
  privateKeyPath: string;
  publicKeyOpenssh: string;
};

export type SshDeployKeyResult = { host: string; ok: boolean; message: string };

export type SshExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type SshProbeKind = "ok" | "unreachable" | "authFailed";

export async function invokeSshEnsureIdentity(): Promise<SshIdentityInfo | null> {
  if (!isTauri()) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SshIdentityInfo>("ssh_ensure_identity");
}

export async function invokeSshDeployKey(
  endpoint: SshEndpointPayload,
  password: string,
): Promise<SshDeployKeyResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SshDeployKeyResult>("ssh_deploy_authorized_key", { endpoint, password });
}

export async function invokeSshMassDeploy(
  password: string,
  targets: SshEndpointPayload[],
): Promise<SshDeployKeyResult[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SshDeployKeyResult[]>("ssh_mass_deploy_keys", { password, targets });
}

export async function invokeSshProbe(endpoint: SshEndpointPayload): Promise<SshProbeKind | null> {
  if (!isTauri()) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const r = await invoke<{ kind: SshProbeKind }>("ssh_probe_pubkey", { endpoint });
  return r.kind;
}

export async function invokeSshExecPreset(
  endpoint: SshEndpointPayload,
  preset: "diagnostics_core" | "klippy_log_tail" | "apt_simulate" | "host_software_snapshot",
): Promise<SshExecResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  const r = await invoke<{ exitCode: number | null; stdout: string; stderr: string }>(
    "ssh_exec_preset",
    { endpoint, preset },
  );
  return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}
