mod discovery;
mod ssh;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoonrakerProxyRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoonrakerProxyResponse {
    pub status: u16,
    pub body: String,
}

/// HTTP to Moonraker from the Rust side so the WebView is not blocked by browser CORS / private-network rules.
#[tauri::command]
async fn moonraker_proxy_request(req: MoonrakerProxyRequest) -> Result<MoonrakerProxyResponse, String> {
    let url = req.url.trim();
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must use http:// or https://".to_string());
    }
    let method = req.method.to_uppercase();
    // Refresh/upgrade can run git/apt for many minutes; cap at 5 min.
    let timeout_ms = req.timeout_ms.unwrap_or(10_000).clamp(1_000, 300_000);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        other => {
            return Err(format!("Unsupported HTTP method: {other}"));
        }
    };

    request = request.header("Accept", "application/json");
    if let Some(ref key) = req.api_key {
        if !key.is_empty() {
            request = request.header("X-Api-Key", key);
        }
    }
    if method == "POST" {
        if let Some(body) = req.body {
            request = request
                .header("Content-Type", "application/json")
                .body(body);
        }
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(MoonrakerProxyResponse { status, body })
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverMoonrakerInput {
    #[serde(default)]
    pub network_prefixes: Vec<String>,
    #[serde(default)]
    pub priority_network_prefixes: Vec<String>,
}

/// Shared cancel flag for in-flight LAN discovery (HTTP sweep + mDNS loop).
#[derive(Clone)]
pub struct DiscoveryCancel(Arc<AtomicBool>);

impl DiscoveryCancel {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }

    pub fn flag(&self) -> Arc<AtomicBool> {
        self.0.clone()
    }

    pub fn reset(&self) {
        self.0.store(false, Ordering::Relaxed);
    }

    pub fn request_stop(&self) {
        self.0.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
async fn discover_moonraker_hosts(
    app: tauri::AppHandle,
    input: DiscoverMoonrakerInput,
    cancel_state: tauri::State<'_, DiscoveryCancel>,
) -> Result<Vec<discovery::DiscoveredHost>, String> {
    cancel_state.reset();
    discovery::discover_moonraker_hosts(
        app,
        input.network_prefixes,
        input.priority_network_prefixes,
        cancel_state.flag(),
    )
    .await
}

#[tauri::command]
fn stop_discovery_scan(cancel_state: tauri::State<'_, DiscoveryCancel>) -> Result<(), String> {
    cancel_state.request_stop();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DiscoveryCancel::new())
        .invoke_handler(tauri::generate_handler![
            discover_moonraker_hosts,
            stop_discovery_scan,
            moonraker_proxy_request,
            ssh::ssh_ensure_identity,
            ssh::ssh_deploy_authorized_key,
            ssh::ssh_mass_deploy_keys,
            ssh::ssh_exec_preset,
            ssh::ssh_probe_pubkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
