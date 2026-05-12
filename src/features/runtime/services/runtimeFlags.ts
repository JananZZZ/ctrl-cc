// RuntimeFlags — Section 5: 临时关闭自动启动，定位 React #185
// 确认 React #185 消失后，才将 enableAutoStartClaude 设为 true
export const RuntimeFlags = {
  enableAutoStartClaude: true, // Set to true once React #185 is confirmed fixed
  enableRuntimeIntervals: false,
  enableDockPublisher: false,
  enableConsoleLivePublisher: false,
};
