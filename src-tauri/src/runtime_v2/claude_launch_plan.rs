#[derive(Debug, Clone)]
pub struct ClaudeLaunchPlan {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub reason: String,
}

impl ClaudeLaunchPlan {
    pub fn command_parts(&self, claude_args: &[String]) -> (String, Vec<String>) {
        let mut args = self.args_prefix.clone();
        args.extend_from_slice(claude_args);
        (self.program.clone(), args)
    }

    pub fn version_args(&self) -> Vec<String> {
        let mut args = self.args_prefix.clone();
        args.push("--version".to_string());
        args
    }
}
