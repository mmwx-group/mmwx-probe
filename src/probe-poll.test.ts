import {
  POLL_INTERVAL_MS,
  reconnectDelay,
  shouldPoll,
  STREAM_FRESH_MS,
} from "./probe-poll";

function check(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

const now = 1_700_000_000_000;

// 还没收到过任何帧(lastFrameAt = 0):首屏要立刻拉
check(shouldPoll(now, 0, false), "没收到过帧时应当轮询");
// WebSocket 刚来过帧:不重复拉
check(!shouldPoll(now, now - 3000, false), "WebSocket 刚来过帧时不应轮询");
check(
  !shouldPoll(now, now - STREAM_FRESH_MS + 1, false),
  "还在新鲜期内不应轮询",
);
// WebSocket 停了(代理不转发后续帧):恢复轮询
check(shouldPoll(now, now - STREAM_FRESH_MS, false), "超过新鲜期应当轮询");
check(shouldPoll(now, now - 60_000, false), "WebSocket 停了很久应当轮询");
// 页面在后台:不拉,回到前台再拉
check(!shouldPoll(now, 0, true), "页面在后台时不应轮询");
check(!shouldPoll(now, now - 60_000, true), "页面在后台时不应轮询");
// 新鲜期要比轮询间隔长,否则 WebSocket 正常时也会每次都拉
check(STREAM_FRESH_MS > POLL_INTERVAL_MS, "新鲜期应当长于轮询间隔");

check(reconnectDelay(0) === 5000, "第一次重连等 5 秒");
check(reconnectDelay(1) === 10_000, "第二次重连等 10 秒");
check(reconnectDelay(3) === 40_000, "第四次重连等 40 秒");
check(reconnectDelay(4) === 60_000, "之后固定 60 秒");
check(reconnectDelay(50) === 60_000, "重试很多次也不超过 60 秒");
check(reconnectDelay(-1) === 5000, "异常入参按第一次算");
