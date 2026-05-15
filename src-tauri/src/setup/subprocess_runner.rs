use std::process::{Command, Stdio};

#[derive(Debug, Clone)]
pub struct CmdResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    match Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
    {
        Ok(o) => CmdResult {
            success: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).trim().to_string(),
            code: o.status.code(),
        },
        Err(e) => CmdResult {
            success: false,
            stdout: String::new(),
            stderr: e.to_string(),
            code: None,
        },
    }
}

pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd("cmd.exe", &["/d", "/s", "/c", command])
}

pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    )
}
