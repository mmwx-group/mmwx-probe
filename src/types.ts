export type ThemeName = string;

export interface ProbeAppearance {
  theme: ThemeName;
  color_mode?: "light" | "dark" | "system";
  revision?: string;
}

export interface ProbeBucket {
  ms: number;
  loss: number;
}

export interface ProbePingSeries {
  key?: string;
  label: string;
  isp?: string;
  current_ms: number;
  loss_pct: number;
  buckets: ProbeBucket[];
  /** 三网兜底序号 1..3:一个三网代表点都没探到时由主控按延迟列表配置顺序标出。 */
  tri_fallback?: number;
}

export interface ProbeConnHistory {
  tcp: (number | null)[];
  udp: (number | null)[];
}

export interface ProbeServer {
  name?: string;
  region?: string;
  region_country?: string;
  region_name?: string;
  region_city?: string;
  online: boolean;
  /** 离线时的最后心跳(RFC3339);在线时不下发 */
  last_seen?: string;
  upload_speed?: number;
  download_speed?: number;
  traffic_used?: number;
  traffic_used_up?: number;
  traffic_used_down?: number;
  traffic_used_total?: number;
  traffic_limit?: number;
  traffic_source?: "xray" | "system";
  traffic_stats_mode?: "both" | "upload" | "download" | "max";
  traffic_adjustment?: number;
  traffic_used_scope?: "configured_period" | "counter_since_reset" | string;
  period_start?: string;
  period_end?: string;
  daily_traffic_scope?:
    "configured_period_and_recent_7d" | "recent_7d" | string;
  daily_traffic_start?: string;
  daily_traffic_end?: string;
  boot_traffic_up?: number;
  boot_traffic_down?: number;
  boot_traffic_scope?: "current_boot" | string;
  cumulative_up?: number;
  cumulative_down?: number;
  cumulative_traffic_scope?: "current_boot" | string;
  daily_traffic?: Array<{
    date: string;
    uplink: number;
    downlink: number;
    total: number;
  }>;
  cpu_pct?: number;
  loadavg?: string;
  mem_used?: number;
  mem_total?: number;
  disk_used?: number;
  disk_total?: number;
  uptime?: number;
  cpu_model?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  os?: string;
  kernel?: string;
  arch?: string;
  // 系统级连接数（**整机**，不是代理用户的连接数）。口径由 agent 定：
  // TCP 只数 /proc/net/tcp{,6} 的 ESTABLISHED，UDP 数 /proc/net/udp{,6} 的全部 socket。
  // 老 agent 与非 Linux agent 不上报 → 后端整个字段省略 → 这里缺省 → UI 显示 "—"。
  tcp_connections?: number;
  udp_connections?: number;
  // 近 1 小时连接数（12 格 × 5 分钟，从旧到新，没样本的格为 null），
  // 主控的探针配置里开了「连接数折线图」才下发。
  conn_history?: ProbeConnHistory;
  ping?: ProbePingSeries[];
  expires_at?: string;
  renewal_price?: number;
  renewal_price_cny?: number;
  renewal_cycle?:
    | "month"
    | "quarter"
    | "half_year"
    | "year"
    | "two_year"
    | "three_year"
    | "permanent";
  renewal_currency?: string;
  provider_name?: string;
  provider_url?: string;
  /** 服务商 logo(主控缓存地址);探针设置关了「服务商 logo」时不下发 */
  provider_logo?: string;
  telecom_paid_peer?: boolean;
  return_routes?: ProbeReturnRoute[];
  unlocks?: ProbeUnlock[];
}

export interface ProbeUnlock {
  service: string;
  status: string;
  region?: string;
  tested_at?: string;
}

export interface ProbeReturnRoute {
  carrier: "telecom" | "unicom" | "mobile";
  region?: string;
  route_type: string;
  tested_at?: string;
}

export interface ForwardChainServerData {
  name: string;
  to_next_ms: number;
  healthy: boolean;
  loss_pct?: number;
  /** 选路段分叉那组的成员:当前走的路 */
  route?: string;
}
export interface ForwardChainGroupData {
  name: string;
  role: "entry" | "mid" | "exit";
  to_next_ms: number;
  loss_pct?: number;
  servers: ForwardChainServerData[];
}
/** 选路段的一条路:分叉那组到下一组之间并行的几条之一 */
export interface ForwardChainRoute {
  name: string;
  /** 依次绕经的中转组;空 = 直连下一组 */
  via: string[];
  /** 经这条路到出口的总延迟;0 = 没测到 */
  latency_ms: number;
  loss_pct: number;
  selected: boolean;
  selected_by?: string[];
}
export interface ForwardChainBucket {
  ts: number;
  e2e_ms: number;
  loss: number;
}
export interface ForwardTrafficServer {
  name: string;
  group: string;
  role: string;
  daily_gb: number[];
  total_gb: number;
}
export interface ForwardChainTraffic {
  days: string[];
  servers: ForwardTrafficServer[];
  total_gb: number;
}
export interface ForwardChainData {
  name: string;
  end_to_end_ms: number;
  loss_pct: number;
  /** 有选路段时:groups[route_hop] 到下一组之间是 routes 这几条并行的路 */
  route_hop?: number;
  route_policy?: "lowest_latency" | "failover" | "weighted" | string;
  failover_ms?: number;
  routes?: ForwardChainRoute[];
  groups: ForwardChainGroupData[];
  bucket_sec: number;
  trend: ForwardChainBucket[];
  traffic?: ForwardChainTraffic | null;
  // 以下三项老主控不下发
  /** 近 24 小时可用率 0..1;这条链没有历史时为 null */
  availability_24h?: number | null;
  /** 最近一次采样的抖动(ms);超过 2 分钟没采到为 null */
  jitter_ms?: number | null;
  /** 近 24 小时状态条:72 个字符、20 分钟一格,o 正常 / d 降级 / b 中断 / n 无数据 */
  cells?: string;
}

export interface TriISPPublicSlot {
  isp: string;
  key: string;
  label: string;
}

export interface TriISPPublic {
  enabled?: boolean;
  targets?: TriISPPublicSlot[];
}

export interface ProbePayload {
  enabled: boolean;
  forward?: ForwardChainData[];
  show_globe?: boolean;
  show_daily_trend?: boolean;
  show_traffic_hotspots?: boolean;
  show_traffic_7d?: boolean;
  show_resource_heatmap?: boolean;
  show_traffic_quota?: boolean;
  show_renewal_timeline?: boolean;
  show_health_score?: boolean;
  // 曲线最长可看的天数（= 主控「延迟采样点(天)」，1–7）；老主控不下发 → 只有 24 小时以内。
  history_days?: number;
  /** 三网延迟:哪三个探测点代表电信/联通/移动。主控只下发 isp/key/label ——
   *  host/port/type 属于探测目标与探测方式,对外页面上从网络面板一眼可见,刻意不带。 */
  tri_isp?: TriISPPublic;
  title?: string;
  logo?: string;
  icon?: string;
  appearance?: ProbeAppearance;
  license_badge?: {
    name?: string;
    display_name?: string;
  };
  servers?: ProbeServer[];
}
