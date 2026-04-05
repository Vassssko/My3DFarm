//! LAN discovery: mDNS `_moonraker._tcp.local.` (Moonraker zeroconf) + HTTP probe on port 7125.

use if_addrs::IfAddr;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use std::collections::hash_map::Entry;
use std::collections::{HashMap, HashSet};
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

const MOONRAKER_SERVICE_TYPE: &str = "_moonraker._tcp.local.";
const SCAN_PORT: u16 = 7125;
const MDNS_COLLECT_MS: u64 = 3500;
/// Slow Wi‑Fi / Pi: short timeouts miss Moonraker on port 7125.
const HTTP_PROBE_MS: u64 = 2000;
const SCAN_CONCURRENCY: usize = 80;
/// Emit UI progress after each chunk (smaller = smoother bar, more events).
const SCAN_PROGRESS_CHUNK: usize = 40;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredHost {
    pub base_url: String,
    pub label: String,
    pub sources: Vec<String>,
}

fn emit_progress(
    app: &tauri::AppHandle,
    phase: &str,
    message: &str,
    scanned: u32,
    total: u32,
    current: Option<&str>,
    found_moonraker: u32,
) {
    let _ = app.emit(
        "discovery-progress",
        serde_json::json!({
            "phase": phase,
            "message": message,
            "scanned": scanned,
            "total": total,
            "current": current,
            "foundMoonraker": found_moonraker,
        }),
    );
}

fn emit_log(app: &tauri::AppHandle, level: &str, message: &str) {
    let _ = app.emit(
        "discovery-log",
        serde_json::json!({
            "level": level,
            "message": message,
        }),
    );
}

fn route_prefix_from_properties(info: &mdns_sd::ServiceInfo) -> String {
    match info.get_property_val_str("route_prefix") {
        None | Some("") => String::new(),
        Some(p) if p.starts_with('/') => p.to_string(),
        Some(p) => format!("/{p}"),
    }
}

/// Returns `true` if this base URL was newly inserted (so UI can add the tile immediately).
fn insert_host(
    map: &mut HashMap<String, DiscoveredHost>,
    base_url: String,
    label: String,
    source: &str,
) -> bool {
    let key = base_url.clone();
    match map.entry(key) {
        Entry::Occupied(mut occ) => {
            let h = occ.get_mut();
            if !h.sources.iter().any(|s| s == source) {
                h.sources.push(source.to_string());
            }
            if h.label.len() < label.len()
                || (h.label.chars().all(|c| c.is_ascii_digit() || c == '.')
                    && !label.chars().all(|c| c.is_ascii_digit() || c == '.'))
            {
                h.label = label.clone();
            }
            false
        }
        Entry::Vacant(vac) => {
            vac.insert(DiscoveredHost {
                base_url,
                label,
                sources: vec![source.to_string()],
            });
            true
        }
    }
}

fn emit_discovery_candidate(app: &tauri::AppHandle, host: &DiscoveredHost) {
    let _ = app.emit("discovery-candidate", host);
}

fn collect_mdns(
    app: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> Result<HashMap<String, DiscoveredHost>, String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon
        .browse(MOONRAKER_SERVICE_TYPE)
        .map_err(|e| format!("mDNS browse: {e}"))?;

    let mut map: HashMap<String, DiscoveredHost> = HashMap::new();
    let deadline = Instant::now() + Duration::from_millis(MDNS_COLLECT_MS);

    while Instant::now() < deadline {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        let wait = remaining.min(Duration::from_millis(250));
        match receiver.recv_timeout(wait) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let port = info.get_port();
                let prefix = route_prefix_from_properties(&info);
                let full = info.get_fullname().to_string();
                let label = full
                    .split('.')
                    .next()
                    .unwrap_or("Moonraker")
                    .to_string();

                for addr in info.get_addresses().iter().copied() {
                    if let std::net::IpAddr::V4(ip) = addr {
                        if ip.is_loopback() || ip.is_link_local() {
                            continue;
                        }
                        let base = format!("http://{ip}:{port}{prefix}");
                        if insert_host(&mut map, base.clone(), label.clone(), "mdns") {
                            if let Some(h) = map.get(&base) {
                                emit_discovery_candidate(&app, h);
                            }
                        }
                    }
                }
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }

    let _ = daemon.shutdown();
    Ok(map)
}

/// Full 192.168.x.1–254 (and same for 10.x.y, 172.16–31) — robust when Windows reports /32 or odd masks.
fn slash24_for_private(ip: Ipv4Addr) -> Vec<Ipv4Addr> {
    if ip.is_loopback() || !ip.is_private() {
        return Vec::new();
    }
    let o = ip.octets();
    (1u8..=254)
        .map(|d| Ipv4Addr::new(o[0], o[1], o[2], d))
        .collect()
}

fn ipv4_scan_targets(iface: &if_addrs::Interface) -> Vec<Ipv4Addr> {
    let IfAddr::V4(v4) = &iface.addr else {
        return Vec::new();
    };
    if v4.ip.is_loopback() {
        return Vec::new();
    }

    let ip_u32: u32 = v4.ip.into();
    let mask_u32: u32 = v4.netmask.into();
    let network = ip_u32 & mask_u32;
    let wildcard = !mask_u32;
    let host_count = wildcard.wrapping_add(1);

    let mut out = Vec::new();
    if host_count > 4096 {
        let o = v4.ip.octets();
        for d in 1u8..=254 {
            out.push(Ipv4Addr::new(o[0], o[1], o[2], d));
        }
    } else if host_count > 2 {
        for off in 1u32..(host_count - 1).min(4096) {
            let ip = Ipv4Addr::from(network.wrapping_add(off));
            if !ip.is_broadcast() {
                out.push(ip);
            }
        }
    }

    // VPN/Wi‑Fi often shows /32 or host_count ≤ 2 → mask-based list empty; still sweep the /24.
    if v4.ip.is_private() && out.is_empty() {
        out.extend(slash24_for_private(v4.ip));
    }

    out
}

/// Moonraker: 200 OK; 401 API key; 403 when IP not in `[authorization] trusted_clients` (still a printer).
fn looks_like_moonraker_status(code: u16) -> bool {
    (200..=299).contains(&code) || code == 401 || code == 403
}

async fn probe_http(client: &reqwest::Client, ip: Ipv4Addr) -> bool {
    let url = format!("http://{ip}:{SCAN_PORT}/server/info");
    match client
        .get(&url)
        .header("Accept", "application/json")
        .timeout(Duration::from_millis(HTTP_PROBE_MS))
        .send()
        .await
    {
        Ok(r) => looks_like_moonraker_status(r.status().as_u16()),
        Err(_) => false,
    }
}

/// If PC is not on 192.168.1.x but printers are (common farm layout), still probe these /24s once.
fn fallback_private_slash24s() -> Vec<Ipv4Addr> {
    let mut v = Vec::with_capacity(254 * 2);
    for d in 1u8..=254 {
        v.push(Ipv4Addr::new(192, 168, 0, d));
    }
    for d in 1u8..=254 {
        v.push(Ipv4Addr::new(192, 168, 1, d));
    }
    v
}

/// Preferred `192.168.x.0/24` third octets for home routers (lower index = scanned earlier).
/// `100` is common on ISP CPE but less "classic" than .0/.1/.88 — place after typical LANs.
const HOME_192_168_THIRD_ORDER: &[u8] = &[
    0, 1, 88, // classic + Keenetic
    2, 8, 10, 11, // common alternates / regional CPE
    20, 21, 30, 31, 32, // ISP mesh / fiber boxes
    50, 55, 60, 64, 70, // guest / secondary LAN presets
    101, 178, 200, // operator defaults in some regions
    100, // 192.168.100.0/24 — often ISP, after the usual suspects
];

fn rank_192_168_third(third: u8) -> u16 {
    if let Some(i) = HOME_192_168_THIRD_ORDER.iter().position(|&x| x == third) {
        return i as u16;
    }
    // Any other /24 after the table, stable numeric order.
    500u16.saturating_add(third as u16)
}

/// Sort key: `192.168.*` with home-friendly third-octet order, then `10.*`, then `172.16–31.*` (Docker/VPN), then the rest.
fn scan_target_sort_key(ip: &Ipv4Addr) -> (u8, u16, u32) {
    let o = ip.octets();
    if o[0] == 192 && o[1] == 168 {
        let rank = rank_192_168_third(o[2]);
        let host = (o[2] as u32) << 8 | o[3] as u32;
        (0, rank, host)
    } else if o[0] == 10 {
        let host = (o[1] as u32) << 16 | (o[2] as u32) << 8 | o[3] as u32;
        (1, 0, host)
    } else if o[0] == 172 && (16..=31).contains(&o[1]) {
        let host = (o[1] as u32) << 16 | (o[2] as u32) << 8 | o[3] as u32;
        (2, 0, host)
    } else {
        let host = (o[0] as u32) << 24
            | (o[1] as u32) << 16
            | (o[2] as u32) << 8
            | o[3] as u32;
        (3, 0, host)
    }
}

fn sort_scan_targets_home_friendly(mut targets: Vec<Ipv4Addr>) -> Vec<Ipv4Addr> {
    targets.sort_unstable_by_key(scan_target_sort_key);
    targets.dedup();
    targets
}

/// Scan `priority` subnets first (e.g. printers already on the farm), then the rest — home-friendly order within each block.
fn merge_scan_order(priority: Vec<Ipv4Addr>, rest: Vec<Ipv4Addr>) -> Vec<Ipv4Addr> {
    let p = sort_scan_targets_home_friendly(priority);
    let seen: HashSet<Ipv4Addr> = p.iter().copied().collect();
    let rest_filtered: Vec<Ipv4Addr> = rest.into_iter().filter(|ip| !seen.contains(ip)).collect();
    let r = sort_scan_targets_home_friendly(rest_filtered);
    let mut out = p;
    out.extend(r);
    out
}

fn parse_octet(s: &str) -> Result<u8, String> {
    s.trim()
        .parse::<u8>()
        .map_err(|_| "invalidPrefix".to_string())
}

/// One /24: `a.b.c` or `a.b.c.0` → hosts .1–.254.
fn slash24_from_prefix(s: &str) -> Result<Vec<Ipv4Addr>, String> {
    let s = s.trim();
    if s.is_empty() {
        return Ok(Vec::new());
    }
    let parts: Vec<&str> = s.split('.').map(str::trim).filter(|p| !p.is_empty()).collect();
    let (a, b, c) = match parts.as_slice() {
        [a, b, c] => (parse_octet(a)?, parse_octet(b)?, parse_octet(c)?),
        [a, b, c, d] => {
            let last = parse_octet(d)?;
            if last != 0 {
                return Err("invalidPrefix".to_string());
            }
            (parse_octet(a)?, parse_octet(b)?, parse_octet(c)?)
        }
        _ => return Err("invalidPrefix".to_string()),
    };
    Ok((1u8..=254)
        .map(|d| Ipv4Addr::new(a, b, c, d))
        .collect())
}

fn flatten_network_prefix_tokens(inputs: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for s in inputs {
        for part in s.split(&[',', ';', '\n', '\r'][..]) {
            let p = part.trim();
            if !p.is_empty() {
                out.push(p.to_string());
            }
        }
    }
    out
}

fn parse_user_subnet_targets(inputs: &[String]) -> Result<Vec<Ipv4Addr>, String> {
    let tokens = flatten_network_prefix_tokens(inputs);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }
    let mut all: Vec<Ipv4Addr> = Vec::new();
    for t in &tokens {
        all.extend(slash24_from_prefix(t)?);
    }
    all.sort_unstable();
    all.dedup();
    Ok(all)
}

/// HTTP sweep with progress events (`discovery-progress`). Returns `(found, cancelled)`.
async fn scan_ips(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    targets: Vec<Ipv4Addr>,
    phase: &str,
    mdns_count: u32,
    cancel: Arc<AtomicBool>,
) -> (HashSet<Ipv4Addr>, bool) {
    let targets = sort_scan_targets_home_friendly(targets);
    let total = targets.len() as u32;

    if total == 0 {
        emit_progress(app, phase, phase, 0, 0, None, mdns_count);
        return (HashSet::new(), false);
    }

    let found = std::sync::Arc::new(tokio::sync::Mutex::new(HashSet::<Ipv4Addr>::new()));
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(SCAN_CONCURRENCY));

    let mut scanned: u32 = 0;
    let mut cancelled = false;
    for chunk in targets.chunks(SCAN_PROGRESS_CHUNK) {
        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            emit_log(
                app,
                "warn",
                "Поиск остановлен пользователем (сканирование адресов прервано).",
            );
            break;
        }
        let app_emit = app.clone();
        let mut join = tokio::task::JoinSet::new();
        for &ip in chunk {
            let c = client.clone();
            let found = found.clone();
            let permit_owner = sem.clone();
            let app_ip = app_emit.clone();
            join.spawn(async move {
                let _permit = permit_owner.acquire_owned().await.ok();
                if probe_http(&c, ip).await {
                    let mut g = found.lock().await;
                    if g.insert(ip) {
                        drop(g);
                        let h = DiscoveredHost {
                            base_url: format!("http://{ip}:{SCAN_PORT}"),
                            label: ip.to_string(),
                            sources: vec!["scan".to_string()],
                        };
                        emit_discovery_candidate(&app_ip, &h);
                    }
                }
            });
        }
        while join.join_next().await.is_some() {}

        scanned += chunk.len() as u32;
        let current = chunk.last().map(|ip| ip.to_string());
        let scan_found = found.lock().await.len() as u32;
        emit_progress(
            app,
            phase,
            "scan",
            scanned,
            total,
            current.as_deref(),
            mdns_count + scan_found,
        );
    }

    let out = found.lock().await.clone();
    (out, cancelled)
}

fn collect_scan_targets() -> (Vec<Ipv4Addr>, Option<String>) {
    let mut targets: Vec<Ipv4Addr> = Vec::new();
    let mut warn: Option<String> = None;
    match if_addrs::get_if_addrs() {
        Ok(ifaces) => {
            for iface in &ifaces {
                targets.extend(ipv4_scan_targets(iface));
                if let IfAddr::V4(v4) = &iface.addr {
                    if !v4.ip.is_loopback() && v4.ip.is_private() {
                        targets.extend(slash24_for_private(v4.ip));
                    }
                }
            }
        }
        Err(e) => {
            warn = Some(format!("if_addrs: {e}"));
        }
    }
    (targets, warn)
}

pub(crate) async fn discover_moonraker_hosts(
    app: tauri::AppHandle,
    network_prefixes: Vec<String>,
    priority_network_prefixes: Vec<String>,
    cancel: Arc<AtomicBool>,
) -> Result<Vec<DiscoveredHost>, String> {
    emit_progress(
        &app,
        "mdns",
        "mdns",
        0,
        0,
        None,
        0,
    );

    let cancel_mdns = cancel.clone();
    let app_mdns = app.clone();
    let mdns_map = tokio::task::spawn_blocking(move || collect_mdns(app_mdns, cancel_mdns))
        .await
        .map_err(|e| e.to_string())??;

    let mdns_n = mdns_map.len() as u32;
    emit_progress(
        &app,
        "mdns_done",
        "mdns_done",
        1,
        1,
        None,
        mdns_n,
    );

    if cancel.load(Ordering::Relaxed) {
        emit_log(
            &app,
            "warn",
            "Поиск остановлен пользователем (после локального обнаружения).",
        );
        emit_progress(
            &app,
            "stopped",
            "stopped",
            0,
            0,
            None,
            mdns_n,
        );
        return finish_discovery_list(&app, mdns_map, HashSet::new());
    }

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;

    let priority_targets = parse_user_subnet_targets(&priority_network_prefixes)?;
    let user_targets = parse_user_subnet_targets(&network_prefixes)?;

    let (scan_result, scan_cancelled) = if !user_targets.is_empty() {
        let merged = merge_scan_order(priority_targets, user_targets);
        emit_progress(
            &app,
            "user_prepare",
            "user_prepare",
            0,
            merged.len() as u32,
            None,
            mdns_n,
        );
        scan_ips(
            &app,
            &client,
            merged,
            "user_scan",
            mdns_n,
            cancel.clone(),
        )
        .await
    } else {
        let (mut iface_targets, if_err) = collect_scan_targets();
        if let Some(msg) = if_err {
            emit_log(&app, "warn", &msg);
        }

        let phase1_targets = merge_scan_order(priority_targets.clone(), iface_targets.clone());

        emit_progress(
            &app,
            "scan_prepare",
            "scan_prepare",
            0,
            phase1_targets.len() as u32,
            None,
            mdns_n,
        );

        let (mut r, mut cancelled) = scan_ips(
            &app,
            &client,
            phase1_targets,
            "scan",
            mdns_n,
            cancel.clone(),
        )
        .await;

        // Interface-based sweep found nothing: try common farm subnets 192.168.1.x / 192.168.0.x.
        if !cancelled && r.is_empty() {
            emit_progress(
                &app,
                "fallback_prepare",
                "fallback_prepare",
                0,
                508,
                None,
                mdns_n,
            );
            iface_targets.extend(fallback_private_slash24s());
            let phase2_targets = merge_scan_order(priority_targets, iface_targets);
            let (r2, c2) =
                scan_ips(&app, &client, phase2_targets, "fallback", mdns_n, cancel.clone()).await;
            r = r2;
            cancelled = c2;
        }
        (r, cancelled)
    };

    if scan_cancelled {
        emit_progress(
            &app,
            "stopped",
            "stopped",
            0,
            0,
            None,
            mdns_n + scan_result.len() as u32,
        );
        return finish_discovery_list(&app, mdns_map, scan_result);
    }

    finish_discovery_list(&app, mdns_map, scan_result)
}

fn finish_discovery_list(
    app: &tauri::AppHandle,
    mut merged: HashMap<String, DiscoveredHost>,
    scan_result: HashSet<Ipv4Addr>,
) -> Result<Vec<DiscoveredHost>, String> {
    for ip in scan_result {
        let base = format!("http://{ip}:{SCAN_PORT}");
        let _ = insert_host(&mut merged, base, ip.to_string(), "scan");
    }

    let mut list: Vec<DiscoveredHost> = merged.into_values().collect();
    list.sort_by(|a, b| a.base_url.cmp(&b.base_url));

    emit_progress(
        app,
        "done",
        "done",
        1,
        1,
        None,
        list.len() as u32,
    );

    Ok(list)
}

#[cfg(test)]
mod scan_order_tests {
    use super::*;

    #[test]
    fn home_sort_192_168_0_before_1_before_88_before_100() {
        let v = sort_scan_targets_home_friendly(vec![
            Ipv4Addr::new(192, 168, 100, 5),
            Ipv4Addr::new(192, 168, 88, 1),
            Ipv4Addr::new(192, 168, 1, 2),
            Ipv4Addr::new(192, 168, 0, 1),
        ]);
        assert_eq!(v[0], Ipv4Addr::new(192, 168, 0, 1));
        assert_eq!(v[1], Ipv4Addr::new(192, 168, 1, 2));
        assert_eq!(v[2], Ipv4Addr::new(192, 168, 88, 1));
        assert_eq!(v[3], Ipv4Addr::new(192, 168, 100, 5));
    }

    #[test]
    fn private_192_168_before_10_before_172_docker() {
        let v = sort_scan_targets_home_friendly(vec![
            Ipv4Addr::new(172, 26, 0, 1),
            Ipv4Addr::new(10, 0, 0, 1),
            Ipv4Addr::new(192, 168, 50, 1),
        ]);
        assert_eq!(v[0], Ipv4Addr::new(192, 168, 50, 1));
        assert_eq!(v[1], Ipv4Addr::new(10, 0, 0, 1));
        assert_eq!(v[2], Ipv4Addr::new(172, 26, 0, 1));
    }

    #[test]
    fn merge_scan_order_puts_priority_block_first() {
        let priority = vec![Ipv4Addr::new(10, 0, 0, 50)];
        let rest = vec![
            Ipv4Addr::new(192, 168, 1, 2),
            Ipv4Addr::new(10, 0, 0, 50),
        ];
        let m = merge_scan_order(priority, rest);
        assert_eq!(m[0], Ipv4Addr::new(10, 0, 0, 50));
        assert_eq!(m[1], Ipv4Addr::new(192, 168, 1, 2));
        assert_eq!(m.len(), 2);
    }
}
