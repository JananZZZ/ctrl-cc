use std::process::{Command, Stdio};

pub fn canary_program(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("spawn failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "exit={:?}, stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn canary_program_owned(program: &str, args: &[String]) -> Result<String, String> {
    let ref_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    canary_program(program, &ref_args)
}
