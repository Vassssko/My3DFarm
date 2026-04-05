//! SSH helpers: identity on disk, password-based authorized_keys install, whitelisted remote commands.
//! Uses `russh` (pure Rust) so Windows release builds do not require Perl/OpenSSL for `openssl-sys`.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use russh::client::{self, AuthResult, Msg};
use russh::Disconnect;
use tauri::Manager;
use russh::keys::key::PrivateKeyWithHashAlg;
use russh::keys::{load_secret_key, PublicKey};
use russh::ChannelMsg;

const IDENTITY_BASE: &str = "my3dfarm_ed25519";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshIdentityInfo {
    pub private_key_path: String,
    pub public_key_openssh: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshEndpoint {
    pub host: String,
    pub port: u16,
    pub user: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshDeployKeyResult {
    pub host: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshExecResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SshProbeKind {
    Ok,
    Unreachable,
    AuthFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshProbeResult {
    pub kind: SshProbeKind,
}

struct ClientAcceptHost;

impl client::Handler for ClientAcceptHost {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

fn ssh_config() -> Arc<client::Config> {
    Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(120)),
        ..Default::default()
    })
}

fn identity_paths(dir: &Path) -> (PathBuf, PathBuf) {
    (
        dir.join(format!("{IDENTITY_BASE}")),
        dir.join(format!("{IDENTITY_BASE}.pub")),
    )
}

fn run_ssh_keygen(private_path: &Path) -> Result<(), String> {
    let status = Command::new("ssh-keygen")
        .arg("-t")
        .arg("ed25519")
        .arg("-f")
        .arg(private_path)
        .arg("-N")
        .arg("")
        .arg("-q")
        .status()
        .map_err(|e| {
            format!("ssh-keygen failed to start (install OpenSSH client): {e}")
        })?;
    if !status.success() {
        return Err("ssh-keygen exited with error".to_string());
    }
    Ok(())
}

/// Ensure Ed25519 identity exists under the app data directory; return paths and public key text.
#[tauri::command]
pub fn ssh_ensure_identity(app: tauri::AppHandle) -> Result<SshIdentityInfo, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let (prv, pubp) = identity_paths(&dir);
    if !prv.exists() {
        run_ssh_keygen(&prv)?;
    }
    let public_key_openssh = std::fs::read_to_string(&pubp).map_err(|e| e.to_string())?;
    Ok(SshIdentityInfo {
        private_key_path: prv.to_string_lossy().to_string(),
        public_key_openssh,
    })
}

async fn collect_exec_output(
    mut channel: russh::Channel<Msg>,
) -> Result<(Option<i32>, String, String), String> {
    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut exit_code: Option<i32> = None;

    while let Some(msg) = channel.wait().await {
        match msg {
            ChannelMsg::Data { data } => {
                stdout.push_str(&String::from_utf8_lossy(&*data));
            }
            ChannelMsg::ExtendedData { data, ext } if ext == 1 => {
                stderr.push_str(&String::from_utf8_lossy(&*data));
            }
            ChannelMsg::ExitStatus { exit_status } => {
                exit_code = Some(exit_status as i32);
            }
            _ => {}
        }
    }

    Ok((exit_code, stdout, stderr))
}

async fn run_exec_on_session(
    handle: client::Handle<ClientAcceptHost>,
    command: String,
) -> Result<SshExecResult, String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .exec(true, command)
        .await
        .map_err(|e| e.to_string())?;

    let (exit_code, stdout, stderr) = collect_exec_output(channel).await?;

    let _ = handle
        .disconnect(Disconnect::ByApplication, "", "English")
        .await;

    Ok(SshExecResult {
        exit_code,
        stdout,
        stderr,
    })
}

async fn deploy_authorized_key_impl(
    app: tauri::AppHandle,
    endpoint: SshEndpoint,
    password: &str,
) -> Result<SshDeployKeyResult, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (prv, _) = identity_paths(&dir);
    if !prv.exists() {
        return Err("SSH identity missing — open Settings and generate a key first.".to_string());
    }
    let pub_line = std::fs::read_to_string(dir.join(format!("{IDENTITY_BASE}.pub")))
        .map_err(|e| e.to_string())?;
    let pub_line = pub_line.trim().to_string();
    if pub_line.is_empty() {
        return Err("Public key file is empty.".to_string());
    }

    let host = endpoint.host.clone();

    let remote_cmd = format!(
        "mkdir -p \"$HOME/.ssh\" && chmod 700 \"$HOME/.ssh\" && touch \"$HOME/.ssh/authorized_keys\" && chmod 600 \"$HOME/.ssh/authorized_keys\" && grep -qxF {qkey} \"$HOME/.ssh/authorized_keys\" 2>/dev/null || echo {qkey} >> \"$HOME/.ssh/authorized_keys\"",
        qkey = shell_single_quote(&pub_line)
    );
    let wrapped = format!("bash -lc {}", shell_single_quote(&remote_cmd));

    let work = async {
        let mut handle = client::connect(
            ssh_config(),
            (endpoint.host.as_str(), endpoint.port),
            ClientAcceptHost {},
        )
        .await
        .map_err(|e| e.to_string())?;

        let auth = handle
            .authenticate_password(endpoint.user.clone(), password)
            .await
            .map_err(|e| format!("auth failed: {e}"))?;

        if auth != AuthResult::Success {
            let _ = handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await;
            return Ok(SshDeployKeyResult {
                host: host.clone(),
                ok: false,
                message: "Authentication failed".to_string(),
            });
        }

        let r = run_exec_on_session(handle, wrapped).await?;
        let ok = r.exit_code.unwrap_or(-1) == 0;
        Ok(SshDeployKeyResult {
            host,
            ok,
            message: if ok {
                "authorized_keys updated".to_string()
            } else {
                format!(
                    "remote command failed (exit {:?}): {} {}",
                    r.exit_code, r.stderr, r.stdout
                )
            },
        })
    };

    tokio::time::timeout(Duration::from_secs(90), work)
        .await
        .map_err(|_| "SSH deploy timed out".to_string())?
}

/// Append one line to `authorized_keys` using password authentication (one-time; password not stored).
#[tauri::command]
pub async fn ssh_deploy_authorized_key(
    app: tauri::AppHandle,
    endpoint: SshEndpoint,
    password: String,
) -> Result<SshDeployKeyResult, String> {
    deploy_authorized_key_impl(app, endpoint, &password).await
}

#[tauri::command]
pub async fn ssh_mass_deploy_keys(
    app: tauri::AppHandle,
    password: String,
    targets: Vec<SshEndpoint>,
) -> Result<Vec<SshDeployKeyResult>, String> {
    let mut out = Vec::with_capacity(targets.len());
    for t in targets {
        let r = deploy_authorized_key_impl(app.clone(), t, &password).await?;
        out.push(r);
    }
    Ok(out)
}

fn shell_single_quote(s: &str) -> String {
    let escaped = s.replace('\'', "'\\''");
    format!("'{escaped}'")
}

/// Preset remote scripts (fixed strings only — no user-controlled shell).
fn preset_script(preset: &str) -> Option<&'static str> {
    match preset {
        "diagnostics_core" => Some(
            "printf '\\n=== UNAME ===\\n'; uname -a; \
             printf '\\n=== UPTIME ===\\n'; uptime; \
             printf '\\n=== IP LINK ===\\n'; ip -s link 2>/dev/null || true; \
             printf '\\n=== CAN (if any) ===\\n'; ip -details link show can0 2>/dev/null || true; \
             printf '\\n=== JOURNAL KLIPPER (tail) ===\\n'; journalctl -u klipper -n 120 --no-pager 2>/dev/null || true; \
             printf '\\n=== JOURNAL MOONRAKER (tail) ===\\n'; journalctl -u moonraker -n 80 --no-pager 2>/dev/null || true;",
        ),
        "klippy_log_tail" => Some(
            "for f in \"$HOME/printer_data/logs/klippy.log\" /tmp/klippy.log /var/log/klipper/klippy.log; do \
             if [ -f \"$f\" ]; then echo \"=== TAIL $f ===\"; tail -n 900 \"$f\"; break; fi; done; \
             if [ ! -f \"$HOME/printer_data/logs/klippy.log\" ] && [ ! -f /tmp/klippy.log ]; then \
             journalctl -u klipper -n 500 --no-pager 2>/dev/null || true; fi",
        ),
        "apt_simulate" => Some(
            "export DEBIAN_FRONTEND=noninteractive; \
             apt-get update -qq && apt-get -s upgrade 2>/dev/null | head -n 200",
        ),
        "host_software_snapshot" => Some(
            "export DEBIAN_FRONTEND=noninteractive; \
             apt-get update -qq 2>/dev/null || true; \
             c=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' || true); \
             echo MY3DFARM_APT_COUNT=${c:-0}; \
             echo MY3DFARM_KERNEL=$(uname -r); \
             echo MY3DFARM_ARCH=$(uname -m); \
            ",
        ),
        _ => None,
    }
}

/// Try TCP + SSH handshake + public key auth (no remote command). For UI status on the hub.
#[tauri::command]
pub async fn ssh_probe_pubkey(
    app: tauri::AppHandle,
    endpoint: SshEndpoint,
) -> Result<SshProbeResult, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (prv, _) = identity_paths(&dir);
    if !prv.exists() {
        return Ok(SshProbeResult {
            kind: SshProbeKind::AuthFailed,
        });
    }

    let key = match load_secret_key(&prv, None) {
        Ok(k) => Arc::new(k),
        Err(_) => {
            return Ok(SshProbeResult {
                kind: SshProbeKind::AuthFailed,
            });
        }
    };
    let user = endpoint.user.clone();

    let work = async {
        let mut handle = client::connect(
            ssh_config(),
            (endpoint.host.as_str(), endpoint.port),
            ClientAcceptHost {},
        )
        .await
        .map_err(|e| e.to_string())?;

        let auth = handle
            .authenticate_publickey(user, PrivateKeyWithHashAlg::new(key, None))
            .await;

        let kind = match auth {
            Ok(AuthResult::Success) => SshProbeKind::Ok,
            Ok(_) => SshProbeKind::AuthFailed,
            Err(_) => SshProbeKind::AuthFailed,
        };

        let _ = handle
            .disconnect(Disconnect::ByApplication, "", "English")
            .await;

        Ok::<SshProbeKind, String>(kind)
    };

    let outcome = tokio::time::timeout(Duration::from_secs(12), work).await;

    match outcome {
        Err(_) => Ok(SshProbeResult {
            kind: SshProbeKind::Unreachable,
        }),
        Ok(Ok(kind)) => Ok(SshProbeResult { kind }),
        Ok(Err(_)) => Ok(SshProbeResult {
            kind: SshProbeKind::Unreachable,
        }),
    }
}

/// Run a whitelisted remote script using publickey auth.
#[tauri::command]
pub async fn ssh_exec_preset(
    app: tauri::AppHandle,
    endpoint: SshEndpoint,
    preset: String,
) -> Result<SshExecResult, String> {
    let script = preset_script(&preset).ok_or_else(|| format!("unknown preset: {preset}"))?;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (prv, _) = identity_paths(&dir);
    if !prv.exists() {
        return Err("SSH identity missing.".to_string());
    }

    let key = Arc::new(
        load_secret_key(&prv, None).map_err(|e| format!("load SSH key: {e}"))?,
    );
    let user = endpoint.user.clone();
    let wrapped = format!("bash -lc {}", shell_single_quote(script));

    let work = async {
        let mut handle = client::connect(
            ssh_config(),
            (endpoint.host.as_str(), endpoint.port),
            ClientAcceptHost {},
        )
        .await
        .map_err(|e| e.to_string())?;

        let auth = handle
            .authenticate_publickey(user, PrivateKeyWithHashAlg::new(key, None))
            .await
            .map_err(|e| format!("pubkey auth failed: {e}"))?;

        if auth != AuthResult::Success {
            let _ = handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await;
            return Err("SSH public key authentication failed.".to_string());
        }

        run_exec_on_session(handle, wrapped).await
    };

    tokio::time::timeout(Duration::from_secs(300), work)
        .await
        .map_err(|_| "SSH command timed out".to_string())?
}
