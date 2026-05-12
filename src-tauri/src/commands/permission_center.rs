use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRule {
    pub id: String,
    pub tool_name: String,
    pub action: String,
    pub level: String,
    pub created_at: String,
}

pub struct PermissionCenter {
    rules: Mutex<HashMap<String, PermissionRule>>,
    allowlist: Mutex<Vec<String>>,
    denylist: Mutex<Vec<String>>,
    auto_trust_level: Mutex<u32>,
}

impl PermissionCenter {
    pub fn new() -> Self {
        Self {
            rules: Mutex::new(HashMap::new()),
            allowlist: Mutex::new(vec!["read".into(), "glob".into(), "grep".into(), "list".into()]),
            denylist: Mutex::new(vec!["rm -rf".into(), "git push --force".into()]),
            auto_trust_level: Mutex::new(0),
        }
    }

    pub fn check(&self, tool: &str, command: &str) -> PermissionResult {
        let allowlist = self.allowlist.lock().expect("mutex poisoned");
        let denylist = self.denylist.lock().expect("mutex poisoned");
        let level = *self.auto_trust_level.lock().expect("mutex poisoned");

        // Check denylist first
        for pattern in denylist.iter() {
            if command.contains(pattern) {
                return PermissionResult { allowed: false, reason: format!("Blocked by denylist: {}", pattern), require_confirm: true };
            }
        }

        // Auto-trust based on level
        let is_readonly = ["read", "glob", "grep", "list", "ls", "cat", "head", "tail", "git log", "git status", "git diff", "git branch"].iter().any(|t| tool.contains(t));
        if level >= 1 && is_readonly { return PermissionResult { allowed: true, reason: "Auto-trusted (level 1+: read-only)".into(), require_confirm: false }; }
        if level >= 2 && !denylist.iter().any(|p| command.contains(p)) { return PermissionResult { allowed: true, reason: "Auto-trusted (level 2+: safe)".into(), require_confirm: false }; }
        if level >= 3 && ["bash", "execute", "run", "test", "build"].iter().any(|t| tool.contains(t)) { return PermissionResult { allowed: true, reason: "Auto-trusted (level 3+: build/test)".into(), require_confirm: false }; }
        if level >= 5 { return PermissionResult { allowed: true, reason: "Auto-trusted (level 5: max)".into(), require_confirm: false }; }

        // Check allowlist for level 4
        if level >= 4 && allowlist.iter().any(|a| tool.contains(a)) { return PermissionResult { allowed: true, reason: "Auto-trusted (level 4: allowlist)".into(), require_confirm: false }; }

        PermissionResult { allowed: true, reason: "Requires user confirmation".into(), require_confirm: true }
    }

    #[allow(dead_code)]
    pub fn add_rule(&self, rule: PermissionRule) { self.rules.lock().expect("mutex poisoned").insert(rule.id.clone(), rule); }
    #[allow(dead_code)]
    pub fn remove_rule(&self, id: &str) { self.rules.lock().expect("mutex poisoned").remove(id); }
    pub fn list_rules(&self) -> Vec<PermissionRule> { self.rules.lock().expect("mutex poisoned").values().cloned().collect() }
    pub fn set_auto_trust(&self, level: u32) { *self.auto_trust_level.lock().expect("mutex poisoned") = level.min(5); }
    pub fn add_allow(&self, tool: String) { self.allowlist.lock().expect("mutex poisoned").push(tool); }
    pub fn add_deny(&self, pattern: String) { self.denylist.lock().expect("mutex poisoned").push(pattern); }
}

#[derive(Debug, Clone, Serialize)]
pub struct PermissionResult {
    pub allowed: bool,
    pub reason: String,
    #[serde(rename = "requireConfirm")]
    pub require_confirm: bool,
}

#[tauri::command]
pub fn check_permission(center: tauri::State<'_, PermissionCenter>, tool: String, command: String) -> PermissionResult {
    center.check(&tool, &command)
}

#[tauri::command]
pub fn set_auto_trust_level(center: tauri::State<'_, PermissionCenter>, level: u32) -> Result<(), String> {
    center.set_auto_trust(level);
    Ok(())
}

#[tauri::command]
pub fn list_permission_rules(center: tauri::State<'_, PermissionCenter>) -> Result<Vec<PermissionRule>, String> {
    Ok(center.list_rules())
}

#[tauri::command]
pub fn add_allow_tool(center: tauri::State<'_, PermissionCenter>, tool: String) -> Result<(), String> {
    center.add_allow(tool);
    Ok(())
}

#[tauri::command]
pub fn add_deny_pattern(center: tauri::State<'_, PermissionCenter>, pattern: String) -> Result<(), String> {
    center.add_deny(pattern);
    Ok(())
}
