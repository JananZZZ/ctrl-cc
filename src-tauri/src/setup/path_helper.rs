use std::env;
use std::path::PathBuf;

pub fn user_home() -> PathBuf {
    env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn claude_config_dir() -> PathBuf {
    user_home().join(".claude")
}

pub fn claude_settings_path() -> PathBuf {
    claude_config_dir().join("settings.json")
}

pub fn claude_json_path() -> PathBuf {
    user_home().join(".claude.json")
}

pub fn npm_global_path() -> Option<PathBuf> {
    let out = crate::setup::subprocess_runner::run_cmd_shell("npm root -g");
    if out.success && !out.stdout.trim().is_empty() {
        Some(PathBuf::from(out.stdout.trim()))
    } else {
        None
    }
}

pub fn find_on_path(exe: &str) -> Option<PathBuf> {
    let path_env = env::var_os("PATH")?;
    for dir in env::split_paths(&path_env) {
        let p = dir.join(exe);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

pub fn appdata() -> Option<PathBuf> {
    env::var("APPDATA").ok().map(PathBuf::from)
}

pub fn has_chinese_in_path(path: &str) -> bool {
    path.contains(|c: char| c as u32 >= 0x4E00 && c as u32 <= 0x9FFF)
}

pub fn check_path_for_spaces(path: &str) -> bool {
    path.contains(' ')
}
