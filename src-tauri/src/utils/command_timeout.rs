use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
    pub timed_out: bool,
}

pub fn run_with_timeout(mut cmd: Command, timeout: Duration) -> Result<CommandResult, String> {
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {}", e))?;
    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                let mut stderr = String::new();

                if let Some(mut out) = child.stdout.take() {
                    let _ = out.read_to_string(&mut stdout);
                }
                if let Some(mut err) = child.stderr.take() {
                    let _ = err.read_to_string(&mut stderr);
                }

                return Ok(CommandResult {
                    stdout,
                    stderr,
                    code: status.code().unwrap_or(-1),
                    timed_out: false,
                });
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();

                    return Ok(CommandResult {
                        stdout: String::new(),
                        stderr: format!("Command timed out after {:?}", timeout),
                        code: -1,
                        timed_out: true,
                    });
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("try_wait failed: {}", e)),
        }
    }
}
