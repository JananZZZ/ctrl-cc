use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone)]
pub struct CmdResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
    pub timed_out: bool,
    pub duration_ms: u128,
}

impl CmdResult {
    pub fn timeout(program: &str, timeout: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: format!("Command `{}` timed out after {}ms", program, timeout.as_millis()),
            code: None,
            timed_out: true,
            duration_ms: timeout.as_millis(),
        }
    }

    pub fn error(err: impl ToString, elapsed: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: err.to_string(),
            code: None,
            timed_out: false,
            duration_ms: elapsed.as_millis(),
        }
    }
}

pub fn default_timeout() -> Duration { Duration::from_secs(4) }
pub fn heavy_timeout() -> Duration { Duration::from_secs(30) }
pub fn install_timeout() -> Duration { Duration::from_secs(600) }

fn build_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    { cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd
}

pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    run_cmd_timeout(program, args, default_timeout())
}

pub fn run_cmd_timeout(program: &str, args: &[&str], timeout: Duration) -> CmdResult {
    let start = Instant::now();

    let mut child = match build_hidden_command(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return CmdResult::error(e, start.elapsed()),
    };

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                let mut stderr = String::new();
                if let Some(mut out) = child.stdout.take() { let _ = out.read_to_string(&mut stdout); }
                if let Some(mut err) = child.stderr.take() { let _ = err.read_to_string(&mut stderr); }
                return CmdResult {
                    success: status.success(),
                    stdout: stdout.trim().to_string(),
                    stderr: stderr.trim().to_string(),
                    code: status.code(),
                    timed_out: false,
                    duration_ms: start.elapsed().as_millis(),
                };
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return CmdResult::timeout(program, timeout);
                }
                thread::sleep(Duration::from_millis(30));
            }
            Err(e) => {
                let _ = child.kill();
                return CmdResult::error(e, start.elapsed());
            }
        }
    }
}

pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], default_timeout())
}

pub fn run_cmd_shell_heavy(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], heavy_timeout())
}

pub fn run_cmd_shell_install(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], install_timeout())
}

pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        default_timeout(),
    )
}

pub fn run_powershell_heavy(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        heavy_timeout(),
    )
}
