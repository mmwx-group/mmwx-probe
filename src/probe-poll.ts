// 轮询与 WebSocket 重连的节奏。
//
// 轮询是 WebSocket 的兜底:有的代理握手成功后不再转发后续帧,只靠 WebSocket 网速会停在第一帧。
// 但 WebSocket 正常推送时再每 5 秒拉一次是重复的 —— 每个打开的页面一天 17280 次请求,
// 都要经过 Worker 再打到主控。所以只在 WebSocket 一段时间没来帧、且页面在前台时才拉。

// 轮询间隔
export const POLL_INTERVAL_MS = 5000;
// WebSocket 多久没来帧算「不新鲜」,开始轮询。主控默认 3 秒推一帧,留出两帧多的余量。
export const STREAM_FRESH_MS = 10_000;

export function shouldPoll(
  now: number,
  lastFrameAt: number,
  hidden: boolean,
): boolean {
  if (hidden) return false;
  return now - lastFrameAt >= STREAM_FRESH_MS;
}

// WebSocket 断开后的重连等待:5、10、20、40 秒,之后固定 60 秒。
// 连不上的环境(代理不支持 WebSocket)里不能按固定短间隔一直重试。
export function reconnectDelay(attempt: number): number {
  return Math.min(60_000, 5000 * 2 ** Math.max(0, Math.min(attempt, 10)));
}
