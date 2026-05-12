use crate::runtime::claude_discovery::discover_claude_path;
use crate::runtime::event_payloads::{
    PtyErrorPayload, PtyExitPayload, PtyOutputPayload, PtyResizeRequest, PtyStopRequest,
    PtyWriteRequest, StartClaudePtyRequest, StartClaudePtyResponse,
};
use anyhow::{anyhow, Context, Result};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub struct PtySession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn portable_pty::Child + Send>,
}

#[derive(Default)]
pub struct PtySessionManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtySessionManager {
    pub fn start_claude(
        &self,
        app: AppHandle,
        req: StartClaudePtyRequest,
    ) -> Result<StartClaudePtyResponse> {
        let cwd = PathBuf::from(&req.cwd);
        if !cwd.exists() || !cwd.is_dir() {
            return Err(anyhow!("cwd does not exist or is not a directory: {}", req.cwd));
        }

        let claude_path = discover_claude_path()
            .ok_or_else(|| anyhow!("claude not found in PATH. Install Claude Code CLI first."))?;

        let session_id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: req.rows.max(10),
                cols: req.cols.max(40),
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("failed to open PTY")?;

        let mut cmd = build_claude_command(&claude_path, req.session_name.as_deref());
        cmd.cwd(cwd);

        for (key, val) in build_child_env() {
            cmd.env(&key, &val);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("FORCE_COLOR", "1");
        cmd.env("CLICOLOR_FORCE", "1");

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("failed to spawn claude in PTY")?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .context("failed to clone PTY reader")?;

        let writer = pair
            .master
            .take_writer()
            .context("failed to take PTY writer")?;

        let writer = Arc::new(Mutex::new(writer));

        let reader_session_id = session_id.clone();
        let reader_app = app.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = reader_app.emit(
                            "ctrlcc://pty-exit",
                            PtyExitPayload {
                                session_id: reader_session_id.clone(),
                                code: None,
                                message: "PTY reader reached EOF".to_string(),
                            },
                        );
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = reader_app.emit(
                            "ctrlcc://pty-output",
                            PtyOutputPayload {
                                session_id: reader_session_id.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        let _ = reader_app.emit(
                            "ctrlcc://pty-error",
                            PtyErrorPayload {
                                session_id: Some(reader_session_id.clone()),
                                message: format!("PTY read error: {e}"),
                            },
                        );
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            master: pair.master,
            child,
        };

        self.sessions.lock().insert(session_id.clone(), session);

        Ok(StartClaudePtyResponse { session_id })
    }

    pub fn write(&self, req: PtyWriteRequest) -> Result<()> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&req.session_id)
            .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?;

        let mut writer = session.writer.lock();
        writer
            .write_all(req.data.as_bytes())
            .context("failed to write to PTY")?;
        writer.flush().ok();

        Ok(())
    }

    pub fn resize(&self, req: PtyResizeRequest) -> Result<()> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&req.session_id)
            .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?;

        session
            .master
            .resize(PtySize {
                rows: req.rows.max(10),
                cols: req.cols.max(40),
                pixel_width: req.pixel_width.unwrap_or(0),
                pixel_height: req.pixel_height.unwrap_or(0),
            })
            .context("failed to resize PTY")?;

        Ok(())
    }

    pub fn stop(&self, req: PtyStopRequest) -> Result<()> {
        // Single lock acquisition — acquire, remove session, drop lock
        let mut session = {
            let mut sessions = self.sessions.lock();
            sessions
                .remove(&req.session_id)
                .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?
        };
        // Lock is DROPPED here — no Mutex held during wait/kill

        // Graceful interrupt
        {
            let mut writer = session.writer.lock();
            let _ = writer.write_all(b"\x03");
            let _ = writer.flush();
        }

        std::thread::sleep(std::time::Duration::from_millis(600));

        let _ = session.child.kill();

        Ok(())
    }
}

fn build_claude_command(claude_path: &str, session_name: Option<&str>) -> CommandBuilder {
    let mut claude_args = vec!["--permission-mode".to_string(), "default".to_string()];

    if let Some(name) = session_name {
        if !name.trim().is_empty() {
            claude_args.push("--name".to_string());
            claude_args.push(name.to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // PowerShell-first strategy — avoids cmd.exe 0xc0000142 on Windows 10 Home China
        let ps_path = std::path::PathBuf::from(
            std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string())
        ).join("System32").join("WindowsPowerShell").join("v1.0").join("powershell.exe");

        if ps_path.exists() {
            let mut cmd = CommandBuilder::new(ps_path.to_string_lossy().as_ref());
            cmd.arg("-NoLogo"); cmd.arg("-NoProfile"); cmd.arg("-ExecutionPolicy"); cmd.arg("Bypass");
            cmd.arg("-Command");
            let ps_cmd = if let Some(name) = session_name {
                if !name.trim().is_empty() {
                    format!("& '{}' --permission-mode default --name '{}'", claude_path, name.replace('\'', "''"))
                } else {
                    format!("& '{}' --permission-mode default", claude_path)
                }
            } else {
                format!("& '{}' --permission-mode default", claude_path)
            };
            cmd.arg(&ps_cmd);
            return cmd;
        }

        // Strategy B: pwsh (PowerShell Core)
        if let Ok(pwsh) = which::which("pwsh") {
            let mut cmd = CommandBuilder::new(pwsh.to_string_lossy().as_ref());
            cmd.arg("-NoLogo"); cmd.arg("-NoProfile"); cmd.arg("-Command");
            cmd.arg(format!("& '{}' --permission-mode default", claude_path));
            if let Some(name) = session_name {
                if !name.trim().is_empty() {
                    cmd.arg("--name"); cmd.arg(name);
                }
            }
            return cmd;
        }

        // Fallback: cmd.exe /d /s /c
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| {
            std::env::var("SystemRoot")
                .unwrap_or_else(|_| "C:\\Windows".to_string())
                + "\\System32\\cmd.exe"
        });
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("/d"); cmd.arg("/s"); cmd.arg("/c");
        cmd.arg(claude_path);
        for arg in claude_args {
            cmd.arg(&arg);
        }
        cmd
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = CommandBuilder::new("bash");

        let mut command_line = "exec ".to_string();
        command_line.push_str(&shell_quote_path(claude_path));
        for arg in claude_args {
            command_line.push(' ');
            command_line.push_str(&shell_words::quote(&arg));
        }

        cmd.args(["-lc", &command_line]);
        cmd
    }
}

/// Build child environment with full parent env inheritance + critical variable fallbacks.
/// On Windows with ConPTY (CREATE_UNICODE_ENVIRONMENT), all env vars must be explicitly
/// set for the child process — missing SystemRoot or ComSpec causes 0xc0000142.
fn build_child_env() -> Vec<(String, String)> {
    let mut envs: Vec<(String, String)> = std::env::vars().collect();
    let must_have: &[(&str, fn() -> String)] = &[
        ("SystemRoot", || "C:\\Windows".to_string()),
        ("WINDIR", || std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string())),
        ("ComSpec", || {
            std::env::var("SystemRoot")
                .unwrap_or_else(|_| "C:\\Windows".to_string())
                + "\\System32\\cmd.exe"
        }),
        ("PATHEXT", || ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC".to_string()),
        ("TEMP", || std::env::temp_dir().to_string_lossy().to_string()),
        ("TMP", || std::env::temp_dir().to_string_lossy().to_string()),
    ];
    for (key, fallback) in must_have {
        let ku = key.to_uppercase();
        if !envs.iter().any(|(k, _)| k.to_uppercase() == ku) {
            envs.push((key.to_string(), fallback()));
        }
    }
    envs
}
