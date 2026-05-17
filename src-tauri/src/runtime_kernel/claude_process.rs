/// v29: Claude CLI 进程管理辅助函数
/// 当前逻辑内嵌在 manager.rs 中，此文件提供辅助函数供未来重构使用。

use std::process::{Child, Command, Stdio};
use std::io;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 创建一个隐藏窗口的 Claude CLI 子进程
pub fn spawn_claude_process(cwd: &str, args: &[&str]) -> io::Result<Child> {
    let mut cmd = Command::new("claude");
    cmd.args(args)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
}
