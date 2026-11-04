import {
  createContext,
  Fragment,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import {
  Activity,
  BarChart3,
  Gauge,
  Server,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CircleHelp,
  Clock,
  CloudDownload,
  CloudUpload,
  Cpu,
  HardDrive,
  LayoutGrid,
  List,
  LockKeyhole,
  LockKeyholeOpen,
  MapPin,
  MemoryStick,
  Monitor,
  Network,
  PieChart,
  Search,
  TriangleAlert,
  Wallet,
  Wifi,
} from "lucide-react";
import {
  siAlmalinux,
  siAlpinelinux,
  siApple,
  siArchlinux,
  siCentos,
  siDebian,
  siFedora,
  siFreebsd,
  siGentoo,
  siKalilinux,
  siLinux,
  siLinuxmint,
  siNixos,
  siOpensuse,
  siProxmox,
  siRedhat,
  siRockylinux,
  siUbuntu,
} from "simple-icons";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { triISPRows } from "./tri-isp";
import {
  UNLOCK_CATEGORIES,
  groupUnlocks,
  isUnlocked,
  unlockServiceMeta,
  unlockStatusMeta,
  unlockStatusText,
  unlockTitle,
  type UnlockCategory,
  type UnlockServiceMeta,
  type UnlockTone,
} from "./unlock-services";
import type {
  ProbeBucket,
  ProbePingSeries,
  ProbeReturnRoute,
  ProbeUnlock,
  ProbeServer,
  TriISPPublic,
} from "./types";
import { useProbe } from "./use-probe";
import { connHistoryFromSeries, type ProbeMetricPoint } from "./conn-sparkline";
import {
  resourceHistoryFromSeries,
  type ResourceMetric,
  type ResourceSeriesInput,
} from "./resource-history";
import {
  effectiveProbeRange,
  probeRangeBucketCount,
  probeRangeBucketSec,
  probeRangeOptions,
} from "./probe-ranges";
import { ThemeSwitch } from "./ThemeSwitch";
import {
  PROBE_SORT_KEYS,
  formatCapacity,
  formatSize,
  probeHealthIssue,
  relativeTime,
  sortProbeServers,
  todayTrafficTotal,
  type ProbeHealthIssue,
  type ProbeSortKey,
  connectionTotals,
  dailyTrafficSeries,
  latencySummary,
  monthlyCost,
  nextExpiry,
  quotaSummary,
  kpiColumns,
  connHistoryTotals,
  upcomingExpiries,
} from "./probe-overview";
import { PasskeyLogin } from "./PasskeyLogin";
import { Twemoji } from "./Twemoji";
import { displayServerName } from "./server-name";
import {
  billableTraffic,
  bootTraffic,
  dailyTrafficRows,
  hasTrafficPeriod,
  trafficFormulaLabel,
  trafficRuleLabel,
  trafficUsageLabel,
  type TrafficRange,
} from "./traffic-display";
import commonRouteAnimation from "./assets/return-route/common.json";
import premiumRouteAnimation from "./assets/return-route/premium.json";
import {
  effectiveProbeLineKey,
  probeLinesForScope,
  type ProbeLineScope,
} from "./probe-line-scope";

const colors = [
  "#8b5cf6",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
const RegionGlobe = lazy(() =>
  import("./RegionGlobe").then((module) => ({ default: module.RegionGlobe })),
);
const PremiumProbePage = lazy(() =>
  import("./PremiumProbePage").then((module) => ({
    default: module.PremiumProbePage,
  })),
);
// 曲线弹窗可选的时间范围随主控的保留天数（history_days）变，由 App 注入。
const HistoryDaysContext = createContext(1);

// useProbeRange 弹窗的时间范围；保留期调短后选中的范围可能已不存在，回落 1h。
function useProbeRange() {
  const options = probeRangeOptions(useContext(HistoryDaysContext));
  const [picked, setRange] = useState("1h");
  return [effectiveProbeRange(picked, options), setRange, options] as const;
}

function formatAxisDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

function HorizontalChart({
  children,
  width,
}: {
  children: ReactNode;
  width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  // 最新的数据在最右边:图比容器宽时默认滚到最右。多天范围的图有几千像素宽,
  // 停在最左边只看得到最早、多半还没有数据的那一段,看着像整张图是空的。
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [width]);
  // 固定纵轴要和滚动区里的图一样高:横向滚动条(Windows / 常显滚动条时)占掉的那截不算,
  // 否则两边纵轴比例对不上,刻度错开几像素叠成「重影」(#973)。
  const [gutter, setGutter] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setGutter(Math.max(0, el.offsetHeight - el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="chart-scroll-frame">
      <div
        className="chart-fixed-y-axis"
        aria-hidden="true"
        style={{ bottom: gutter }}
      >
        <div className="chart-scroll-inner" style={{ width, minWidth: "100%" }}>
          {children}
        </div>
      </div>
      <div
        ref={ref}
        className="chart-scroll"
        style={{ touchAction: "pan-x pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft };
          ref.current.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && ref.current)
            ref.current.scrollLeft =
              drag.current.left - (e.clientX - drag.current.x);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          ref.current?.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="chart-scroll-inner" style={{ width, minWidth: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function bytes(value = 0, decimal = true, base = 1024): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Math.max(0, value);
  let i = 0;
  // 到 1000 就进下一级(除数仍是 base):「1000 GB」四位数太长,卡片里会把前面的标签挤成省略号
  while (n >= Math.min(base, 1000) && i < units.length - 1) {
    n /= base;
    i++;
  }
  const text = n.toFixed(decimal && i >= 2 ? 1 : 0).replace(/\.0$/, "");
  return `${text} ${units[i]}`;
}

// 悬停说明挂到 body 上、按触发元素 fixed 定位:放在卡片里绝对定位会被 .server-card 的
// overflow:hidden 裁掉。离视口顶不足 180px(放不下)就放到下方;只响应鼠标,触屏点按照旧打开弹窗。
function useHoverBubble() {
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  }>();
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(undefined);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);
  const show = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const r = event.currentTarget.getBoundingClientRect();
    const left = Math.min(
      Math.max(r.left + r.width / 2, 140),
      window.innerWidth - 140,
    );
    setPos(
      r.top > 180
        ? { left, bottom: window.innerHeight - r.top + 7 }
        : { left, top: r.bottom + 7 },
    );
  };
  return { pos, show, hide: () => setPos(undefined) };
}

function signedBytes(value: number): string {
  if (value === 0) return bytes(0, false);
  return `${value > 0 ? "+" : "−"}${bytes(Math.abs(value), false)}`;
}

// 网速按十进制进位(1 MB/s = 1e6 B/s):汇总卡的 Mbps 天生是十进制,
// 这里若沿用流量的 1024 进位,单机的 "1.53 MB/s × 8 = 12.2 Mbps" 会和
// 「网络情况 · 实时汇总」的 12.9 Mbps 对不上(#892)。流量仍按 1024 进位。
function speed(value = 0): string {
  return `${bytes(value, true, 1000)}/s`;
}
const cycleLabel = {
  month: "月",
  quarter: "季",
  half_year: "半年",
  year: "年",
  two_year: "两年",
  three_year: "三年",
  permanent: "永久",
} as const;
function expiring(server: ProbeServer): boolean {
  if (!server.expires_at) return false;
  const days =
    (new Date(`${server.expires_at}T23:59:59`).getTime() - Date.now()) /
    86400000;
  return days >= 0 && days <= 30;
}
function expired(server: ProbeServer): boolean {
  return (
    !!server.expires_at &&
    new Date(`${server.expires_at}T23:59:59`).getTime() < Date.now()
  );
}
function remainingDays(value?: string): string {
  if (!value) return "";
  const days = Math.ceil(
    (new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `剩余 ${days} 天`;
}
function regionFlag(region?: string): string {
  const points = [...(region?.trim() || "")].map(
    (char) => char.codePointAt(0) || 0,
  );
  if (
    points.length === 2 &&
    points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
  )
    return region!.trim();
  const country = region
    ?.trim()
    .split(/[·,\s]+/)[0]
    ?.toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(
    ...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
function countryCodeFromRegion(value?: string): string {
  const text = value?.trim() || "";
  const flag = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0];
  if (flag) {
    return [...flag]
      .map((char) =>
        String.fromCharCode((char.codePointAt(0) || 0) - 0x1f1e6 + 65),
      )
      .join("");
  }
  const code = text.split(/[·,\s]+/)[0]?.toUpperCase() || "";
  return /^[A-Z]{2}$/.test(code) ? code : "";
}
// 管理员在主控探针设置里手动选的国旗(region)优先;region_country 是许可证服务按 IP 网段自动识别的,
// 只在没手动选时兜底。反过来的话,IP 库认错国家(香港机被认成美国)时手动改了也不生效。
function probeRegion(server: {
  region?: string;
  region_country?: string;
}): string {
  return server.region?.trim() || server.region_country || "";
}
function probeCountryCode(server: ProbeServer): string {
  return (
    countryCodeFromRegion(server.region) ||
    countryCodeFromRegion(server.region_country)
  );
}
function pct(used = 0, total = 0): number {
  return total > 0 ? Math.min(100, (used * 100) / total) : 0;
}

function Meter({
  icon,
  label,
  value,
  percent,
  sub,
  subRight,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
  /** 进度条下方的小字:CPU 核心数、内存 / 硬盘「已用 / 总量」 */
  sub?: ReactNode;
  subRight?: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const body = (
    <>
      <div className="metric-head">
        <span>
          {icon}
          <span className="metric-label">{label}</span>
        </span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <i
          className={percent > 90 ? "bad" : percent > 70 ? "warn" : undefined}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      {(sub || subRight) && (
        <div className="metric-sub">
          <span>{sub}</span>
          {subRight && <span>{subRight}</span>}
        </div>
      )}
    </>
  );
  // 可点的（CPU / 内存 / 硬盘点开看历史）沿用流量那格的按钮样式。
  return onClick ? (
    <button
      type="button"
      className="metric metric-button"
      onClick={onClick}
      title={title}
    >
      {body}
    </button>
  ) : (
    <div className="metric" title={title}>
      {body}
    </div>
  );
}

// 「4 核 · 8 线程」;线程数与核心数相同时只写核心
function cpuCoresLabel(server: ProbeServer): string | undefined {
  if (!server.cpu_cores && !server.cpu_threads) return undefined;
  const cores = server.cpu_cores ? `${server.cpu_cores} 核` : "";
  const threads =
    server.cpu_threads && server.cpu_threads !== server.cpu_cores
      ? `${server.cpu_threads} 线程`
      : "";
  return [cores, threads].filter(Boolean).join(" · ") || undefined;
}

// 离线卡片的规格行:「2 核 · 1 GB 内存 · 20 GB 硬盘」
function specsLabel(server: ProbeServer): string | undefined {
  const parts = [
    server.cpu_cores ? `${server.cpu_cores} 核` : "",
    server.mem_total ? `${formatSize(server.mem_total)} 内存` : "",
    server.disk_total ? `${formatSize(server.disk_total)} 硬盘` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

const healthLabels: Record<ProbeHealthIssue["key"], string> = {
  cpu: "CPU",
  mem: "内存",
  disk: "硬盘",
  traffic: "流量",
};

function TrafficDialog({
  server,
  close,
}: {
  server: ProbeServer;
  close: () => void;
}) {
  const hasPeriod = hasTrafficPeriod(server);
  const [range, setRange] = useState<TrafficRange>(() =>
    hasPeriod ? "period" : "recent7",
  );
  const rows = dailyTrafficRows(server, range);
  const total = rows.reduce(
    (sum, row) => sum + (row.total || row.uplink + row.downlink),
    0,
  );
  const formula = trafficFormulaLabel(server);
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{server.name} · 原始上下行日流量趋势</h2>
          <button type="button" aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="traffic-dialog-toolbar">
          <div className="traffic-range" role="group" aria-label="趋势范围">
            {hasPeriod && (
              <button
                type="button"
                className={range === "period" ? "active" : ""}
                onClick={() => setRange("period")}
              >
                当前周期
              </button>
            )}
            <button
              type="button"
              className={range === "recent7" ? "active" : ""}
              onClick={() => setRange("recent7")}
            >
              最近 7 日
            </button>
          </div>
          <strong>
            {range === "period" ? "当前周期" : "最近 7 日"}原始合计：
            {bytes(total, false)}
          </strong>
          <small>
            趋势展示原始上、下行，不应用计费方向或对账调整；卡片按
            {trafficRuleLabel(server)}计费
            {formula ? `（${formula}）` : ""}。
          </small>
        </div>
        <div className="chart">
          {rows.length === 0 ? (
            <div className="empty traffic-empty">暂无每日流量趋势数据</div>
          ) : (
            <HorizontalChart width={Math.max(760, rows.length * 82)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    minTickGap={28}
                  />
                  <YAxis
                    width={62}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => bytes(Number(value), false)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    labelFormatter={(value) => String(value)}
                    formatter={(value, name) => [
                      bytes(Number(value)),
                      name === "uplink" || name === "上行" ? "上行" : "下行",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="uplink"
                    name="上行"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="downlink"
                    name="下行"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </HorizontalChart>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

// 连接数是纯计数，**不要**套 bytes()/speed() 那类进位格式化（#892 就是 1024 与 1000
// 两套进位混用出的 bug），只加千分位方便读大数。未上报（老 agent 或非 Linux agent）→ "—"，
// 不能退化成 0：那会跟"真的一条连接都没有"混掉。
export function connCount(value?: number): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "—";
}

export const CONN_COUNT_HINT =
  "TCP 为整机 ESTABLISHED 连接数（不含 LISTEN / TIME_WAIT），UDP 为整机打开的 UDP socket 数。统计的是整台机器，不只是代理用户的连接。";

function systemTitle(server: ProbeServer): string {
  return (
    [server.os, server.kernel, server.arch].filter(Boolean).join(" · ") ||
    "系统信息未上报"
  );
}
const systemIcons = [
  { terms: ["alma"], icon: siAlmalinux },
  { terms: ["alpine"], icon: siAlpinelinux },
  { terms: ["arch"], icon: siArchlinux },
  { terms: ["centos"], icon: siCentos },
  { terms: ["debian"], icon: siDebian },
  { terms: ["fedora"], icon: siFedora },
  { terms: ["freebsd"], icon: siFreebsd },
  { terms: ["gentoo"], icon: siGentoo },
  { terms: ["kali"], icon: siKalilinux },
  { terms: ["mint"], icon: siLinuxmint },
  { terms: ["nixos", "nix os"], icon: siNixos },
  { terms: ["opensuse", "open suse", "suse"], icon: siOpensuse },
  { terms: ["proxmox"], icon: siProxmox },
  { terms: ["red hat", "redhat", "rhel"], icon: siRedhat },
  { terms: ["rocky"], icon: siRockylinux },
  { terms: ["ubuntu"], icon: siUbuntu },
  { terms: ["darwin", "macos", "mac os"], icon: siApple },
];
function SystemIcon({ server }: { server: ProbeServer }) {
  const os = (server.os || "").toLowerCase();
  if (os.includes("windows")) return <Monitor size={16} />;
  const icon =
    systemIcons.find(({ terms }) => terms.some((term) => os.includes(term)))
      ?.icon ?? siLinux;
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      role="img"
      viewBox="0 0 24 24"
      fill={`#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  );
}

function averagePing(series: ProbePingSeries[]): ProbePingSeries {
  const count = series[0]?.buckets.length || 0;
  const buckets: ProbeBucket[] = Array.from({ length: count }, (_, index) => {
    const values = series.map((item) => item.buckets[index]).filter(Boolean);
    const ms = values.filter((v) => v.ms >= 0).map((v) => v.ms);
    const loss = values.filter((v) => v.loss >= 0).map((v) => v.loss);
    return {
      ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : -1,
      loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : -1,
    };
  });
  const current = series
    .filter((item) => item.current_ms >= 0)
    .map((item) => item.current_ms);
  return {
    key: "__avg__",
    label: "平均",
    current_ms: current.length
      ? current.reduce((a, b) => a + b, 0) / current.length
      : -1,
    loss_pct: series.length
      ? series.reduce((sum, item) => sum + item.loss_pct, 0) / series.length
      : 0,
    buckets,
  };
}

function lossScale(rows: Array<Record<string, string | number | null>>) {
  const peak = Math.max(
    0,
    ...rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== "time")
        .map(([, value]) => (typeof value === "number" ? value : 0)),
    ),
  );
  const scales = [
    { max: 0.1, step: 0.025 },
    { max: 0.2, step: 0.05 },
    { max: 0.5, step: 0.1 },
    { max: 1, step: 0.25 },
    { max: 2, step: 0.5 },
    { max: 5, step: 1 },
    { max: 10, step: 2 },
    { max: 20, step: 5 },
    { max: 50, step: 10 },
    { max: 100, step: 25 },
  ];
  const selected =
    scales.find((item) => peak <= item.max) ?? scales[scales.length - 1];
  return {
    max: selected.max,
    ticks: Array.from(
      { length: Math.round(selected.max / selected.step) + 1 },
      (_, index) => Number((index * selected.step).toFixed(3)),
    ),
  };
}

function formatLossTick(value: number): string {
  const digits = value < 0.1 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0;
  return `${value.toFixed(digits).replace(/\.?0+$/, "")}%`;
}

function TrendDialog({
  serverIndex,
  initial,
  targetKey,
  title,
  mode,
  close,
}: {
  serverIndex: number;
  initial: ProbePingSeries[];
  targetKey: string;
  title: string;
  mode: "latency" | "loss";
  close: () => void;
}) {
  const [range, setRange, rangeOptions] = useProbeRange();
  const [series, setSeries] = useState<ProbePingSeries[]>(initial);
  const [lineScope, setLineScope] = useState<ProbeLineScope>("all");
  const [selectedLineKey, setSelectedLineKey] = useState(targetKey);
  const [loading, setLoading] = useState(false);
  const [timeMeta, setTimeMeta] = useState({
    generatedAt: Math.floor(Date.now() / 1000),
    bucketSec: 300,
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/series?server=${serverIndex}&range=${range}&all=1`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          success: boolean;
          series?: ProbePingSeries;
          all_series?: ProbePingSeries[];
          generated_at?: number;
          bucket_sec?: number;
        }>;
      })
      .then((payload) => {
        if (payload.success) {
          setSeries([
            ...(payload.series
              ? [{ ...payload.series, key: "__avg__", label: "平均" }]
              : []),
            ...(payload.all_series || []),
          ]);
          setTimeMeta({
            generatedAt: payload.generated_at ?? Math.floor(Date.now() / 1000),
            bucketSec: payload.bucket_sec ?? probeRangeBucketSec(range),
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, serverIndex]);

  const visibleSeries = useMemo(
    () => probeLinesForScope(series, lineScope),
    [series, lineScope],
  );
  const effectiveLineKey = effectiveProbeLineKey(
    series,
    lineScope,
    selectedLineKey,
  );

  useEffect(() => {
    if (effectiveLineKey !== selectedLineKey) {
      setSelectedLineKey(effectiveLineKey);
    }
  }, [effectiveLineKey, selectedLineKey]);

  const rows = useMemo(
    () =>
      Array.from(
        { length: visibleSeries[0]?.buckets.length || 0 },
        (_, index) => {
          const row: Record<string, string | number | null> = {
            time: formatAxisDateTime(
              timeMeta.generatedAt -
                (timeMeta.generatedAt % timeMeta.bucketSec) -
                ((visibleSeries[0]?.buckets.length || 0) - 1 - index) *
                  timeMeta.bucketSec,
            ),
          };
          for (const item of visibleSeries) {
            const bucket = item.buckets[index];
            const value = mode === "loss" ? bucket?.loss : bucket?.ms;
            row[item.key || item.label] =
              value !== undefined && value >= 0 ? value : null;
          }
          return row;
        },
      ),
    [visibleSeries, mode, timeMeta],
  );
  const dynamicLossScale = useMemo(() => lossScale(rows), [rows]);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>
            {title} · {mode === "loss" ? "丢包率趋势" : "延迟趋势"}
          </h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {rangeOptions.map((item) => (
            <button
              type="button"
              className={range === item.key ? "active" : ""}
              onClick={() => setRange(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
          <span className="ranges-sep" />
          {(["all", "cn", "idc"] as const).map((scope) => (
            <button
              type="button"
              className={lineScope === scope ? "active" : ""}
              onClick={() => setLineScope(scope)}
              key={scope}
            >
              {scope === "all" ? "全部" : scope === "cn" ? "内地" : "海外"}
            </button>
          ))}
          {visibleSeries.length > 0 && (
            <select
              aria-label="当前探测线路"
              value={effectiveLineKey}
              onChange={(event) => setSelectedLineKey(event.target.value)}
            >
              {visibleSeries.map((item) => {
                const key = item.key || item.label;
                return (
                  <option value={key} key={key}>
                    {item.label}
                  </option>
                );
              })}
            </select>
          )}
        </div>
        <div className="chart">
          {loading && <div className="loading-overlay">加载中…</div>}
          {!loading && visibleSeries.length === 0 && (
            <div className="chart-empty">
              该服务器未配置{lineScope === "cn" ? "内地" : "海外"}探测点
            </div>
          )}
          <HorizontalChart width={Math.max(760, rows.length * 82)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={28}
                />
                <YAxis
                  width={52}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit={mode === "loss" ? undefined : "ms"}
                  domain={
                    mode === "loss" ? [0, dynamicLossScale.max] : undefined
                  }
                  ticks={mode === "loss" ? dynamicLossScale.ticks : undefined}
                  tickFormatter={
                    mode === "loss"
                      ? (value) => formatLossTick(Number(value))
                      : undefined
                  }
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value, _name, item) => [
                    `${Number(value).toFixed(mode === "loss" ? 1 : 0)}${mode === "loss" ? "%" : "ms"}`,
                    visibleSeries.find(
                      (line) => (line.key || line.label) === item.dataKey,
                    )?.label || String(item.dataKey),
                  ]}
                />
                {visibleSeries.map((item, index) => {
                  const key = item.key || item.label;
                  const active = key === effectiveLineKey;
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={item.label}
                      stroke={
                        key === "__avg__"
                          ? "var(--foreground, #2f2350)"
                          : colors[index % colors.length]
                      }
                      strokeWidth={active ? 2.5 : 1}
                      strokeOpacity={active ? 1 : 0.45}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </HorizontalChart>
        </div>
        {visibleSeries.length > 1 && (
          <div className="legend">
            {visibleSeries.map((item, index) => {
              const key = item.key || item.label;
              return (
                <span
                  className={key === effectiveLineKey ? "active" : ""}
                  key={key}
                >
                  <i
                    style={{
                      background:
                        key === "__avg__"
                          ? "var(--foreground, #2f2350)"
                          : colors[index % colors.length],
                    }}
                  />
                  {item.label}
                </span>
              );
            })}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

type ConnSeriesPayload = {
  series?: {
    tcp_connections?: ProbeMetricPoint[];
    udp_connections?: ProbeMetricPoint[];
  };
  bucket_sec?: number;
  buckets?: number;
  generated_at?: number;
};

// ConnDialog 系统连接数历史（TCP / UDP 两条线），时间范围同延迟弹窗、随保留天数变。
// 1 小时先用卡片上已有的 conn_history 顶着，其余范围向 /api/series?metric=system 取。
function ConnDialog({
  serverIndex,
  title,
  fallback,
  close,
}: {
  serverIndex: number;
  title: string;
  fallback?: ProbeServer["conn_history"];
  close: () => void;
}) {
  const [range, setRange, rangeOptions] = useProbeRange();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<
    (ConnSeriesPayload & { range: string }) | null
  >(null);
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(
      `/api/series?server=${serverIndex}&metric=system&range=${range}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<
          ConnSeriesPayload & { success: boolean }
        >;
      })
      .then((body) => setPayload(body.success ? { ...body, range } : null))
      .catch(() => {
        if (!controller.signal.aborted) setPayload(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, serverIndex]);

  const current = payload?.range === range ? payload : null;
  const history = connHistoryFromSeries(
    current?.series?.tcp_connections,
    current?.series?.udp_connections,
    current?.generated_at ?? openedAt,
    current?.bucket_sec ?? probeRangeBucketSec(range),
    current?.buckets ?? probeRangeBucketCount(range),
  );
  const useFallback = !current && range === "1h" && !!fallback;
  const rows = history.times.map((t, i) => ({
    time: formatAxisDateTime(t),
    tcp: useFallback ? (fallback!.tcp[i] ?? null) : history.tcp[i],
    udp: useFallback ? (fallback!.udp[i] ?? null) : history.udp[i],
  }));

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title} · 系统连接数趋势</h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {rangeOptions.map((item) => (
            <button
              type="button"
              className={range === item.key ? "active" : ""}
              onClick={() => setRange(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chart">
          {loading && !useFallback && (
            <div className="loading-overlay">加载中…</div>
          )}
          <HorizontalChart width={Math.max(760, rows.length * 82)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={28}
                />
                <YAxis
                  width={52}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value, name) => [
                    Number(value).toLocaleString("en-US"),
                    String(name),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="tcp"
                  name="TCP"
                  stroke="var(--conn-tcp, #3b82f6)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="udp"
                  name="UDP"
                  stroke="var(--conn-udp, #8b5cf6)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </HorizontalChart>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--conn-tcp, #3b82f6)" }} />
            TCP
          </span>
          <span>
            <i style={{ background: "var(--conn-udp, #8b5cf6)" }} />
            UDP
          </span>
          <span title={CONN_COUNT_HINT}>整机连接数，每个时间桶取均值</span>
        </div>
      </section>
    </div>,
    document.body,
  );
}

// 资源使用率三条线配色（CPU / 内存 / 硬盘），主题可用 --res-* 覆盖。
const RESOURCE_COLORS: Record<ResourceMetric, string> = {
  cpu: "var(--res-cpu, #3b82f6)",
  mem: "var(--res-mem, #10b981)",
  disk: "var(--res-disk, #f59e0b)",
};
const RESOURCE_NAMES: Record<ResourceMetric, string> = {
  cpu: "CPU",
  mem: "内存",
  disk: "硬盘",
};

// ResourceDialog CPU / 内存 / 硬盘使用率历史（三条线同一张 0–100% 的图），
// 点哪一格打开就加粗哪一条。与连接数同一个 /api/series?metric=system，
// 老主控不带 disk 列时硬盘那条为空。
function ResourceDialog({
  serverIndex,
  title,
  focus,
  close,
}: {
  serverIndex: number;
  title: string;
  focus: ResourceMetric;
  close: () => void;
}) {
  const [range, setRange, rangeOptions] = useProbeRange();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<{
    range: string;
    series?: ResourceSeriesInput;
    bucket_sec?: number;
    buckets?: number;
    generated_at?: number;
  } | null>(null);
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(
      `/api/series?server=${serverIndex}&metric=system&range=${range}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          success: boolean;
          series?: ResourceSeriesInput;
          bucket_sec?: number;
          buckets?: number;
          generated_at?: number;
        }>;
      })
      .then((body) => setPayload(body.success ? { ...body, range } : null))
      .catch(() => {
        if (!controller.signal.aborted) setPayload(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, serverIndex]);

  const current = payload?.range === range ? payload : null;
  const history = resourceHistoryFromSeries(
    current?.series,
    current?.generated_at ?? openedAt,
    current?.bucket_sec ?? probeRangeBucketSec(range),
    current?.buckets ?? probeRangeBucketCount(range),
  );
  const rows = history.times.map((t, i) => ({
    time: formatAxisDateTime(t),
    cpu: history.cpu[i],
    mem: history.mem[i],
    disk: history.disk[i],
  }));
  const metrics: ResourceMetric[] = ["cpu", "mem", "disk"];

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title} · 资源使用率趋势</h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {rangeOptions.map((item) => (
            <button
              type="button"
              className={range === item.key ? "active" : ""}
              onClick={() => setRange(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chart">
          {loading && <div className="loading-overlay">加载中…</div>}
          <HorizontalChart width={Math.max(760, rows.length * 82)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={28}
                />
                <YAxis
                  width={44}
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(1)} %`,
                    String(name),
                  ]}
                />
                {metrics.map((m) => (
                  <Line
                    key={m}
                    type="monotone"
                    dataKey={m}
                    name={RESOURCE_NAMES[m]}
                    stroke={RESOURCE_COLORS[m]}
                    strokeWidth={m === focus ? 2.5 : 1.25}
                    strokeOpacity={m === focus ? 1 : 0.6}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </HorizontalChart>
        </div>
        <div className="legend">
          {metrics.map((m) => (
            <span key={m}>
              <i style={{ background: RESOURCE_COLORS[m] }} />
              {RESOURCE_NAMES[m]}
            </span>
          ))}
          <span>每个时间桶取均值</span>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PingPanel({
  ping,
  serverIndex,
  triISP,
}: {
  ping: ProbePingSeries[];
  serverIndex: number;
  triISP?: TriISPPublic;
}) {
  const [mode, setMode] = useState<"latency" | "loss" | null>(null);
  const [selected, setSelected] = useState("__avg__");
  const average = averagePing(ping);
  const lines = [{ ...average, key: "__avg__" }, ...ping];
  const current =
    selected === "__avg__"
      ? average
      : ping.find((item) => (item.key || item.label) === selected) || average;
  // 按传入的 buckets 渲染色块条 —— 三网模式下每行画自己那条,
  // 原来闭包在 current 上只能画"当前选中的那一条"。
  const blocksOf = (
    buckets: ProbePingSeries["buckets"],
    kind: "latency" | "loss",
  ) =>
    buckets.map((bucket, index) => {
      const value = kind === "loss" ? bucket.loss : bucket.ms;
      const level =
        value < 0
          ? "none"
          : kind === "loss"
            ? value >= 20
              ? "bad"
              : value > 0
                ? "warn"
                : "good"
            : value >= 200
              ? "warn"
              : "good";
      return <i key={index} className={level} />;
    });
  // 三网行按 key 从本机实测序列里取 —— 与主控同一套 triISPRows,
  // 两处画的是同一份数据,匹配规则不一致会让同一台机器在内外探针上显示不同。
  const triRows = triISPRows(triISP, ping);
  // 一个探测点一组:第一行「名称 · 延迟 · 丢包」,第二行左延迟条、右丢包条(与内置探针同形)。
  const row = (
    key: string,
    label: ReactNode,
    cur: ProbePingSeries | undefined,
    pick: (kind: "latency" | "loss") => void,
  ) => (
    <div key={key} className="ping-row">
      {/* 表头与色块条同一套两列:延迟在左列末端(延迟条上方)、丢包在右列末端(#1620) */}
      <div className="ping-row-head">
        <div className="ping-row-head-main">
          <span>{label}</span>
          <strong>
            {!cur
              ? "—"
              : cur.current_ms < 0
                ? "超时"
                : `${cur.current_ms.toFixed(0)} ms`}
          </strong>
        </div>
        <em className={cur && cur.loss_pct > 0 ? "warning" : undefined}>
          丢包 {!cur ? "—" : `${cur.loss_pct.toFixed(1)}%`}
        </em>
      </div>
      <div className="ping-row-bars">
        <button
          className="ping-blocks"
          type="button"
          aria-label="延迟趋势"
          disabled={!cur}
          onClick={() => cur && pick("latency")}
        >
          {blocksOf(cur?.buckets ?? [], "latency")}
        </button>
        <button
          className="ping-blocks"
          type="button"
          aria-label="丢包率趋势"
          disabled={!cur}
          onClick={() => cur && pick("loss")}
        >
          {blocksOf(cur?.buckets ?? [], "loss")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="ping-rows">
        {triRows.length > 0
          ? triRows.map((r) =>
              row(r.isp, r.label, r.series, (kind) => {
                setSelected(r.series!.key || r.series!.label);
                setMode(kind);
              }),
            )
          : row(
              "single",
              <>
                <Clock size={14} />
                <select
                  value={selected}
                  aria-label="延迟目标"
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="__avg__">平均</option>
                  {ping.map((item) => (
                    <option
                      key={item.key || item.label}
                      value={item.key || item.label}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </>,
              current,
              (kind) => setMode(kind),
            )}
      </div>
      {mode && (
        <TrendDialog
          serverIndex={serverIndex}
          initial={lines}
          targetKey={selected}
          title={current.label}
          mode={mode}
          close={() => setMode(null)}
        />
      )}
    </>
  );
}

const routeCarrierLabels = {
  telecom: "电信",
  unicom: "联通",
  mobile: "移动",
} as const;
const goldRoutes = new Set(["CN2GIA", "CTGGIA", "9929", "CMIN2", "163PP"]);
function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, "") === "CMIN"
    ? "CMI"
    : route;
}

// 回程奖牌:每张卡片三枚、各是一个循环 Lottie(500×500、带表达式,却只显示 16px)。
// 几十台服务器就是上百个同时逐帧渲染,桌面端明显卡顿。同步主控探针的两点优化:
//   1. 滚进视口附近才挂载,视口外只留等大占位;
//   2. 按动画自身 30 帧渲染(setSubframe(false)),不跟显示器刷新率(120Hz 屏上每枚每秒 120 次)。
function ReturnRouteIcon({ premium }: { premium: boolean }) {
  const holder = useRef<HTMLSpanElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  // 没有 IntersectionObserver 的环境直接挂,不做懒加载
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={holder} className="route-badge-icon" aria-hidden="true">
      {visible && (
        <Lottie
          lottieRef={lottieRef}
          animationData={premium ? premiumRouteAnimation : commonRouteAnimation}
          style={{ width: "100%", height: "100%" }}
          loop
          onDOMLoaded={() => lottieRef.current?.setSubframe(false)}
        />
      )}
    </span>
  );
}

function ReturnRouteBadges({
  routes,
  telecomPaidPeer,
}: {
  routes: ProbeReturnRoute[];
  telecomPaidPeer?: boolean;
}) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]));
  return (
    <div className="return-route-badges">
      {(["telecom", "unicom", "mobile"] as const).map((carrier) => {
        const route = byCarrier.get(carrier);
        const detectedRouteType = displayReturnRoute(
          route?.route_type || "Unknown",
        );
        const routeType =
          carrier === "telecom" &&
          telecomPaidPeer &&
          detectedRouteType === "163"
            ? "163 PP"
            : detectedRouteType;
        const premium = goldRoutes.has(
          routeType.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        );
        return (
          <div
            className="route-badge"
            key={carrier}
            title={route?.region ? `${route.region} · ${routeType}` : routeType}
          >
            <div
              className={
                premium
                  ? "route-badge-animation gold"
                  : "route-badge-animation silver"
              }
            >
              <ReturnRouteIcon premium={premium} />
            </div>
            <div
              className={
                premium ? "route-badge-text gold" : "route-badge-text silver"
              }
            >
              <small>{routeCarrierLabels[carrier]}</small>
              <strong>{routeType}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UnlockServiceIcon({ meta }: { meta: UnlockServiceMeta }) {
  if (meta.icon) {
    return (
      <svg
        aria-hidden="true"
        className="unlock-badge-brand"
        role="img"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d={meta.icon.path} />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" className="unlock-badge-letter">
      {meta.short}
    </span>
  );
}

export function UnlockStateIcon({ tone }: { tone: UnlockTone }) {
  if (tone === "ok" || tone === "partial") {
    return <LockKeyholeOpen aria-hidden="true" className="unlock-badge-lock" />;
  }
  if (tone === "muted") {
    return <CircleHelp aria-hidden="true" className="unlock-badge-lock" />;
  }
  return <LockKeyhole aria-hidden="true" className="unlock-badge-lock" />;
}

export function UnlockTabbedList({
  unlocks,
  className,
}: {
  unlocks: ProbeUnlock[];
  className?: string;
}) {
  const [tab, setTab] = useState<UnlockCategory>("streaming");
  const groups = groupUnlocks(unlocks);
  const rows = groups[tab];
  return (
    <div className={className ? `unlock-list ${className}` : "unlock-list"}>
      <div className="unlock-tabs">
        {UNLOCK_CATEGORIES.map((c) => {
          const list = groups[c.key];
          const ok = list.filter((u) => isUnlocked(u.status)).length;
          return (
            <button
              key={c.key}
              type="button"
              data-active={tab === c.key || undefined}
              onClick={() => setTab(c.key)}
            >
              {c.zh}
              <small>
                {ok}/{list.length}
              </small>
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <p className="unlock-empty">—</p>
      ) : (
        <ul>
          {rows.map((u) => {
            const meta = unlockServiceMeta(u.service);
            const st = unlockStatusMeta(u.status);
            return (
              <li key={u.service} title={unlockTitle(u, true)}>
                <UnlockServiceIcon meta={meta} />
                <span className="unlock-row-label">{meta.label}</span>
                <span
                  className="unlock-row-status"
                  data-tone={meta.info ? "info" : st.tone}
                >
                  <span>{unlockStatusText(u, true)}</span>
                  {!meta.info && <UnlockStateIcon tone={st.tone} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function UnlockHoverIcon({ unlocks }: { unlocks: ProbeUnlock[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>();
  const anchor = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const unlocked = unlocks.filter((u) => isUnlocked(u.status)).length;

  const show = () => {
    window.clearTimeout(closeTimer.current);
    const r = anchor.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const label = `解锁 ${unlocked}/${unlocks.length}`;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="unlock-hover-trigger"
        data-unlocked={unlocked > 0 || undefined}
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (open ? setOpen(false) : show())}
      >
        {unlocked > 0 ? (
          <LockKeyholeOpen aria-hidden="true" />
        ) : (
          <LockKeyhole aria-hidden="true" />
        )}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            role="dialog"
            aria-label={label}
            className="unlock-popover"
            style={{ top: pos.top, right: pos.right }}
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={hide}
          >
            <div className="unlock-popover-head">
              <span>解锁检测</span>
              <span>
                {unlocked}/{unlocks.length}
              </span>
            </div>
            <UnlockTabbedList unlocks={unlocks} />
          </div>,
          document.body,
        )}
    </>
  );
}

function ServerCard({
  server,
  index,
  triISP,
  dense = false,
}: {
  server: ProbeServer;
  index: number;
  triISP?: TriISPPublic;
  /** 紧凑模式:去掉延迟和回程线路,一屏放更多台(网速 / 连接数 / 开机以来同在一行,藏了也不省高度) */
  dense?: boolean;
}) {
  const [trafficOpen, setTrafficOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [resourceFocus, setResourceFocus] = useState<ResourceMetric | null>(
    null,
  );
  const trafficBubble = useHoverBubble();
  const name = server.name || `服务器 ${index + 1}`;
  const flag = regionFlag(probeRegion(server));
  const trafficUsed = billableTraffic(server);
  const currentBoot = bootTraffic(server);
  const formula = trafficFormulaLabel(server);
  const issue = probeHealthIssue(server, trafficUsed);
  const hasMetric =
    server.cpu_pct !== undefined ||
    (server.mem_total ?? 0) > 0 ||
    (server.disk_total ?? 0) > 0;
  const cpuInfo =
    [
      server.cpu_model,
      server.cpu_cores ? `${server.cpu_cores} 核` : "",
      server.cpu_threads ? `${server.cpu_threads} 线程` : "",
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  const meta = (server.expires_at ||
    server.renewal_price !== undefined ||
    server.renewal_cycle === "permanent") && (
    <div className="server-meta">
      {/* 永久(一次性买断)没有到期日:显示「永久」,不显示倒计时 */}
      {server.renewal_cycle === "permanent" && !server.expires_at && (
        <span>
          <CalendarClock size={13} />
          永久
        </span>
      )}
      {server.expires_at &&
        (server.provider_url ? (
          <a
            href={server.provider_url}
            target="_blank"
            rel="noopener noreferrer"
            className={expiring(server) || expired(server) ? "warning" : ""}
            title={
              server.provider_name
                ? `前往 ${server.provider_name} 续费`
                : "前往服务商续费"
            }
          >
            <CalendarClock size={13} />
            {remainingDays(server.expires_at)}
          </a>
        ) : (
          <span
            className={expiring(server) || expired(server) ? "warning" : ""}
          >
            <CalendarClock size={13} />
            {remainingDays(server.expires_at)}
          </span>
        ))}
      {server.renewal_price !== undefined && (
        <span>
          <Wallet size={13} />
          {server.renewal_price_cny !== undefined
            ? `¥${server.renewal_price_cny.toFixed(2)}`
            : `${server.renewal_currency || "CNY"} ${server.renewal_price}`}{" "}
          / {cycleLabel[server.renewal_cycle || "month"]}
          {server.renewal_price_cny !== undefined &&
            server.renewal_currency !== "CNY" && (
              <small>
                （{server.renewal_currency} {server.renewal_price}）
              </small>
            )}
        </span>
      )}
    </div>
  );

  const title = (
    <div className="server-title">
      <span className={server.online ? "status online" : "status"} />
      <h2>
        <Twemoji>
          {displayServerName(name, `服务器 ${index + 1}`, flag)}
        </Twemoji>
      </h2>
      {issue ? (
        <em className="health-badge bad">
          <TriangleAlert size={11} />
          {healthLabels[issue.key]} {issue.pct.toFixed(0)}%
        </em>
      ) : (
        server.online && hasMetric && <em className="health-badge ok">健康</em>
      )}
      <i className="server-title-gap" />
      {!!server.unlocks?.length && <UnlockHoverIcon unlocks={server.unlocks} />}
      <span title={systemTitle(server)}>
        <SystemIcon server={server} />
      </span>
    </div>
  );

  // 离线:数据都是旧的,只留规格、最后在线时间和续费信息
  if (!server.online) {
    const specs = specsLabel(server);
    return (
      <article className="server-card offline">
        {title}
        {specs && <div className="server-specs">{specs}</div>}
        <div className="offline-note">
          离线
          {server.last_seen && ` · 最后在线 ${relativeTime(server.last_seen)}`}
        </div>
        {meta}
      </article>
    );
  }

  return (
    <article className="server-card" data-alert={issue ? "true" : undefined}>
      {title}
      <div className="metrics">
        {server.cpu_pct !== undefined && (
          <Meter
            icon={<Cpu size={14} />}
            label="CPU"
            value={`${server.cpu_pct.toFixed(1)}%`}
            percent={server.cpu_pct}
            sub={cpuCoresLabel(server)}
            title={cpuInfo}
            onClick={() => setResourceFocus("cpu")}
          />
        )}
        {server.mem_total !== undefined && (
          <Meter
            icon={<MemoryStick size={14} />}
            label="内存"
            value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`}
            percent={pct(server.mem_used, server.mem_total)}
            sub={
              server.mem_total > 0
                ? formatCapacity(server.mem_used ?? 0, server.mem_total)
                : undefined
            }
            onClick={() => setResourceFocus("mem")}
          />
        )}
        {server.disk_total !== undefined && (
          <Meter
            icon={<HardDrive size={14} />}
            label="硬盘"
            value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`}
            percent={pct(server.disk_used, server.disk_total)}
            sub={
              server.disk_total > 0
                ? formatCapacity(server.disk_used ?? 0, server.disk_total)
                : undefined
            }
            onClick={() => setResourceFocus("disk")}
          />
        )}
        {trafficUsed !== undefined && (
          <button
            type="button"
            className="metric metric-button"
            onClick={() => {
              trafficBubble.hide();
              setTrafficOpen(true);
            }}
            onPointerEnter={trafficBubble.show}
            onPointerLeave={trafficBubble.hide}
          >
            <div className="metric-head">
              <span>
                <PieChart size={14} />
                <span className="metric-label">
                  {trafficUsageLabel(server)}
                </span>
              </span>
              <strong>
                {server.traffic_limit
                  ? `${bytes(trafficUsed, false)} / ${bytes(server.traffic_limit, false)}`
                  : bytes(trafficUsed, false)}
              </strong>
            </div>
            <div className="meter">
              <i
                className={
                  pct(trafficUsed, server.traffic_limit) > 90
                    ? "bad"
                    : undefined
                }
                style={{
                  width: `${pct(trafficUsed, server.traffic_limit)}%`,
                }}
              />
            </div>
            <div className="metric-sub">
              <span>
                {server.traffic_limit
                  ? `${pct(trafficUsed, server.traffic_limit).toFixed(0)}%`
                  : "不限量"}
              </span>
              {server.period_end && (
                <span>{server.period_end.slice(5).replace("-", "/")} 重置</span>
              )}
            </div>
            {trafficBubble.pos &&
              createPortal(
                <span className="metric-hover-detail" style={trafficBubble.pos}>
                  <small>计费规则：{trafficRuleLabel(server)}</small>
                  {formula && <small>计费用量 = {formula}</small>}
                  {(server.traffic_used_up !== undefined ||
                    server.traffic_used_down !== undefined) && (
                    <small>
                      原始周期 ↑ {bytes(server.traffic_used_up, false)} · ↓{" "}
                      {bytes(server.traffic_used_down, false)}
                    </small>
                  )}
                  {server.traffic_adjustment !== undefined &&
                    server.traffic_adjustment !== 0 && (
                      <small>
                        对账调整：{signedBytes(server.traffic_adjustment)}
                      </small>
                    )}
                  {server.period_start && server.period_end && (
                    <small>
                      {server.period_start} — {server.period_end}
                    </small>
                  )}
                  {!!server.daily_traffic?.length && (
                    <small>点击查看原始上下行趋势</small>
                  )}
                </span>,
                document.body,
              )}
          </button>
        )}
      </div>
      {(server.upload_speed !== undefined ||
        server.download_speed !== undefined ||
        currentBoot.uplink !== undefined ||
        currentBoot.downlink !== undefined ||
        server.tcp_connections !== undefined ||
        server.udp_connections !== undefined) && (
        <div className="net-boxes">
          {(server.upload_speed !== undefined ||
            server.download_speed !== undefined) && (
            <div className="net-box">
              <small>网速</small>
              <span className="download">↓ {speed(server.download_speed)}</span>
              <span className="upload">↑ {speed(server.upload_speed)}</span>
            </div>
          )}
          {(server.tcp_connections !== undefined ||
            server.udp_connections !== undefined) && (
            <button
              type="button"
              className="net-box"
              title={CONN_COUNT_HINT}
              disabled={!server.conn_history}
              aria-label={server.conn_history ? "查看连接数历史" : undefined}
              onClick={() => server.conn_history && setConnOpen(true)}
            >
              <small>系统连接数</small>
              <span>TCP {connCount(server.tcp_connections)}</span>
              <span>UDP {connCount(server.udp_connections)}</span>
            </button>
          )}
          {(currentBoot.uplink !== undefined ||
            currentBoot.downlink !== undefined) && (
            <div className="net-box" title="本次开机以来网卡收发">
              <small>开机以来</small>
              <span>↓ {bytes(currentBoot.downlink, false)}</span>
              <span>↑ {bytes(currentBoot.uplink, false)}</span>
            </div>
          )}
          {connOpen && (
            <ConnDialog
              serverIndex={index}
              title={name}
              fallback={server.conn_history}
              close={() => setConnOpen(false)}
            />
          )}
        </div>
      )}
      {!dense && !!server.ping?.length && (
        <PingPanel ping={server.ping} serverIndex={index} triISP={triISP} />
      )}
      {!dense && !!server.return_routes?.length && (
        <ReturnRouteBadges
          routes={server.return_routes}
          telecomPaidPeer={server.telecom_paid_peer}
        />
      )}
      {meta}
      {trafficOpen && (
        <TrafficDialog server={server} close={() => setTrafficOpen(false)} />
      )}
      {resourceFocus && (
        <ResourceDialog
          serverIndex={index}
          title={name}
          focus={resourceFocus}
          close={() => setResourceFocus(null)}
        />
      )}
    </article>
  );
}

// 列表模式一格指标:数值 / 细条 / 小字三层,各列定宽,一列里的数字上下对齐(与内置探针同形)。
function TableMetric({
  value,
  percent,
  sub,
  subRight,
}: {
  value: string;
  percent?: number;
  sub?: ReactNode;
  subRight?: ReactNode;
}) {
  return (
    <div className="table-metric">
      <span className="table-metric-value">{value}</span>
      <div className="meter">
        {percent !== undefined && (
          <i
            className={percent > 90 ? "bad" : percent > 70 ? "warn" : undefined}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        )}
      </div>
      {(sub || subRight) && (
        <div className="metric-sub">
          <span>{sub}</span>
          {subRight && <span>{subRight}</span>}
        </div>
      )}
    </div>
  );
}

// 计费流量格:用量 / 限额 + 细条 + 百分比与重置日;计费口径(规则、公式、原始上下行、对账调整、周期)
// 改为悬停气泡,点开看日流量 —— 原来整段口径平铺在格子里,一行被撑得很高。
function TableTraffic({ server }: { server: ProbeServer }) {
  const [open, setOpen] = useState(false);
  const bubble = useHoverBubble();
  const trafficUsed = billableTraffic(server);
  const formula = trafficFormulaLabel(server);
  if (trafficUsed === undefined) return <span className="dash">—</span>;
  const limit = server.traffic_limit ?? 0;
  const usedPct = pct(trafficUsed, limit);
  return (
    <>
      <button
        type="button"
        className="metric-button"
        onClick={() => {
          bubble.hide();
          setOpen(true);
        }}
        onPointerEnter={bubble.show}
        onPointerLeave={bubble.hide}
      >
        <TableMetric
          value={
            limit
              ? `${bytes(trafficUsed, false)} / ${bytes(limit, false)}`
              : bytes(trafficUsed, false)
          }
          percent={limit ? usedPct : undefined}
          sub={limit ? `${usedPct.toFixed(0)}%` : "不限量"}
          subRight={
            server.period_end
              ? `${server.period_end.slice(5).replace("-", "/")} 重置`
              : undefined
          }
        />
        {bubble.pos &&
          createPortal(
            <span className="metric-hover-detail" style={bubble.pos}>
              <small>计费规则：{trafficRuleLabel(server)}</small>
              {formula && <small>计费用量 = {formula}</small>}
              {(server.traffic_used_up !== undefined ||
                server.traffic_used_down !== undefined) && (
                <small>
                  原始周期 ↑ {bytes(server.traffic_used_up, false)} · ↓{" "}
                  {bytes(server.traffic_used_down, false)}
                </small>
              )}
              {server.traffic_adjustment !== undefined &&
                server.traffic_adjustment !== 0 && (
                  <small>
                    对账调整：{signedBytes(server.traffic_adjustment)}
                  </small>
                )}
              {server.period_start && server.period_end && (
                <small>
                  {server.period_start} — {server.period_end}
                </small>
              )}
              {!!server.daily_traffic?.length && (
                <small>点击查看原始上下行趋势</small>
              )}
            </span>,
            document.body,
          )}
      </button>
      {open && <TrafficDialog server={server} close={() => setOpen(false)} />}
    </>
  );
}

function tablePingBlocks(
  buckets: ProbePingSeries["buckets"],
  kind: "latency" | "loss",
) {
  return buckets.map((bucket, index) => {
    const value = kind === "loss" ? bucket.loss : bucket.ms;
    const level =
      bucket.ms < 0 && bucket.loss < 0
        ? "none"
        : kind === "loss"
          ? value < 0
            ? "none"
            : value >= 20
              ? "bad"
              : value > 0
                ? "warn"
                : "good"
          : value < 0
            ? "bad"
            : value >= 200
              ? "warn"
              : "good";
    return <i key={index} className={level} />;
  });
}

// 列表模式延迟格:每个探测目标一行「名称 | 色块条 | 延迟」,丢包大于 0 才标黄跟在后面;
// 三网时正好三行,与资源格、三网回程行高对齐。点色块条打开同一个曲线弹窗。
function TablePing({
  ping,
  serverIndex,
  triISP,
}: {
  ping?: ProbePingSeries[];
  serverIndex: number;
  triISP?: TriISPPublic;
}) {
  const [chart, setChart] = useState<{
    targetKey: string;
    title: string;
    mode: "latency" | "loss";
  } | null>(null);
  if (!ping?.length) return <span className="dash">—</span>;
  const average = averagePing(ping);
  const lines = [{ ...average, key: "__avg__" }, ...ping];
  const triRows = triISPRows(triISP, ping);
  const lossText = (loss: number) => `${loss.toFixed(loss < 10 ? 1 : 0)}%`;
  const line = (
    key: string,
    label: ReactNode,
    cur: ProbePingSeries | undefined,
    mode: "latency" | "loss",
    targetKey: string,
  ) => {
    const loss = cur?.loss_pct ?? 0;
    return (
      <div className="table-ping-line" key={key}>
        <small>{label}</small>
        <button
          type="button"
          className="ping-blocks"
          title={mode === "loss" ? "点击查看丢包率趋势" : "点击查看延迟趋势"}
          onClick={() => cur && setChart({ targetKey, title: cur.label, mode })}
        >
          {tablePingBlocks(cur?.buckets ?? [], mode)}
        </button>
        <span className="table-ping-value">
          {!cur ? (
            <span className="dash">—</span>
          ) : mode === "loss" ? (
            <em className={loss > 0 ? "warning" : undefined}>
              {lossText(loss)}
            </em>
          ) : (
            <>
              <strong>
                {cur.current_ms < 0
                  ? "超时"
                  : `${cur.current_ms.toFixed(0)} ms`}
              </strong>
              {loss > 0 && <em className="warning">{lossText(loss)}</em>}
            </>
          )}
        </span>
      </div>
    );
  };
  return (
    <>
      <div className="table-ping-lines">
        {triRows.length > 0
          ? triRows.map((row) =>
              line(
                row.isp,
                row.label,
                row.series,
                "latency",
                row.series?.key || row.series?.label || "__avg__",
              ),
            )
          : [
              line("latency", "延迟", average, "latency", "__avg__"),
              line("loss", "丢包", average, "loss", "__avg__"),
            ]}
      </div>
      {chart && (
        <TrendDialog
          serverIndex={serverIndex}
          initial={lines}
          targetKey={chart.targetKey}
          title={chart.title}
          mode={chart.mode}
          close={() => setChart(null)}
        />
      )}
    </>
  );
}

// 列表模式三网回程:三行小标签竖排,精品线路琥珀色、普通线路灰,不放卡片里的奖牌动画。
function TableReturnRoutes({
  routes,
  telecomPaidPeer,
}: {
  routes: ProbeReturnRoute[];
  telecomPaidPeer?: boolean;
}) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]));
  return (
    <div className="table-route-list">
      {(["telecom", "unicom", "mobile"] as const).map((carrier) => {
        const route = byCarrier.get(carrier);
        const detected = displayReturnRoute(route?.route_type || "Unknown");
        const routeType =
          carrier === "telecom" && telecomPaidPeer && detected === "163"
            ? "163 PP"
            : detected;
        const premium = goldRoutes.has(
          routeType.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        );
        return (
          <div
            key={carrier}
            className={premium ? "table-route gold" : "table-route"}
            title={route?.region ? `${route.region} · ${routeType}` : routeType}
          >
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TableRenewal({ server }: { server: ProbeServer }) {
  const permanent = server.renewal_cycle === "permanent";
  if (!server.expires_at && server.renewal_price === undefined && !permanent)
    return <span className="dash">—</span>;
  const warn = expiring(server) || expired(server) ? "warning" : undefined;
  return (
    <div className="table-renewal">
      {permanent && !server.expires_at && (
        <span>
          <CalendarClock size={13} /> 永久
        </span>
      )}
      {server.expires_at &&
        (server.provider_url ? (
          <a
            href={server.provider_url}
            target="_blank"
            rel="noopener noreferrer"
            className={warn}
          >
            <CalendarClock size={13} /> {remainingDays(server.expires_at)}
          </a>
        ) : (
          <span className={warn}>
            <CalendarClock size={13} /> {remainingDays(server.expires_at)}
          </span>
        ))}
      {server.renewal_price !== undefined && (
        <span>
          <Wallet size={13} />
          {server.renewal_price_cny !== undefined
            ? `¥${server.renewal_price_cny.toFixed(2)}`
            : `${server.renewal_currency || "CNY"} ${server.renewal_price}`}{" "}
          / {cycleLabel[server.renewal_cycle || "month"]}
        </span>
      )}
    </div>
  );
}

function ServerTable({
  items,
  triISP,
}: {
  items: { server: ProbeServer; index: number }[];
  triISP?: TriISPPublic;
}) {
  const dash = <span className="dash">—</span>;
  return (
    <section className="server-table-wrap">
      <div className="table-scroll">
        <table className="server-table">
          <thead>
            <tr>
              <th>服务器</th>
              <th>CPU</th>
              <th>内存</th>
              <th>硬盘</th>
              <th>计费流量</th>
              <th>网速</th>
              <th>本次开机网卡</th>
              <th>延迟</th>
              <th>三网回程</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ server, index }) => {
              const name = (
                <Twemoji>
                  {displayServerName(
                    server.name,
                    `服务器 ${index + 1}`,
                    regionFlag(probeRegion(server)),
                  )}
                </Twemoji>
              );
              const hasMem =
                !!server.mem_total && server.mem_used !== undefined;
              const hasDisk =
                !!server.disk_total && server.disk_used !== undefined;
              const currentBoot = bootTraffic(server);
              return (
                <tr
                  key={`${server.name}-${index}`}
                  className={server.online ? undefined : "offline"}
                >
                  <td className="table-name">
                    <span className="table-name-line">
                      <i
                        className={
                          server.online ? "status-dot online" : "status-dot"
                        }
                        title={server.online ? "在线" : "离线"}
                      />
                      <span className="table-name-text">
                        {server.provider_url ? (
                          <a
                            href={server.provider_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {name}
                          </a>
                        ) : (
                          name
                        )}
                      </span>
                      {!!server.unlocks?.length && (
                        <UnlockHoverIcon unlocks={server.unlocks} />
                      )}
                      <span className="table-os" title={systemTitle(server)}>
                        <SystemIcon server={server} />
                      </span>
                      {!server.online && (
                        <span className="table-offline-tag">离线</span>
                      )}
                    </span>
                    <TableRenewal server={server} />
                  </td>
                  <td className="table-col-metric">
                    {server.online && server.cpu_pct !== undefined ? (
                      <TableMetric
                        value={`${server.cpu_pct.toFixed(1)}%`}
                        percent={server.cpu_pct}
                        sub={cpuCoresLabel(server)}
                      />
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="table-col-metric">
                    {server.online && hasMem ? (
                      <TableMetric
                        value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`}
                        percent={pct(server.mem_used, server.mem_total)}
                        sub={formatCapacity(
                          server.mem_used ?? 0,
                          server.mem_total ?? 0,
                        )}
                      />
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="table-col-metric">
                    {server.online && hasDisk ? (
                      <TableMetric
                        value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`}
                        percent={pct(server.disk_used, server.disk_total)}
                        sub={formatCapacity(
                          server.disk_used ?? 0,
                          server.disk_total ?? 0,
                        )}
                      />
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="table-col-traffic">
                    <TableTraffic server={server} />
                  </td>
                  <td>
                    {server.online ? (
                      <span className="table-speed">
                        <span className="download">
                          ↓ {speed(server.download_speed)}
                        </span>
                        <span className="upload">
                          ↑ {speed(server.upload_speed)}
                        </span>
                      </span>
                    ) : (
                      dash
                    )}
                  </td>
                  <td>
                    {currentBoot.uplink !== undefined ||
                    currentBoot.downlink !== undefined ? (
                      <span className="table-cumulative">
                        <span>↓ {bytes(currentBoot.downlink, false)}</span>
                        <span>↑ {bytes(currentBoot.uplink, false)}</span>
                      </span>
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="table-col-ping">
                    <TablePing
                      ping={server.ping}
                      serverIndex={index}
                      triISP={triISP}
                    />
                  </td>
                  <td>
                    {server.return_routes?.length ? (
                      <TableReturnRoutes
                        routes={server.return_routes}
                        telecomPaidPeer={server.telecom_paid_peer}
                      />
                    ) : (
                      dash
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProbeLicenseNameplate({
  name,
  displayName,
}: {
  name?: string;
  displayName?: string;
}) {
  const label = [name?.trim(), displayName?.trim()].filter(Boolean).join(" · ");
  const plateRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const starsRef = useRef<HTMLSpanElement>(null);
  const shineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const plate = plateRef.current;
    const text = textRef.current;
    const stars = starsRef.current;
    const shine = shineRef.current;
    if (!plate || !text || !stars || !shine) return;

    const palette = ["#f9a8d4", "#f472b6", "#ec4899", "#fbcfe8", "#ff8fc7"];
    const random = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const easeOutBack = (value: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
    };
    const easeInBack = (value: number) => {
      const c1 = 1.70158;
      return (c1 + 1) * value * value * value - c1 * value * value;
    };

    stars.innerHTML = "";
    const height = stars.clientHeight || 24;
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement("i");
      star.className = "spark";
      star.style.color = palette[Math.floor(Math.random() * palette.length)];
      const size = Math.round(random(8, 13));
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.top = `${Math.round(topFor(size))}px`;
      star.style.left = `${Math.round(random(0, 12))}px`;
      stars.appendChild(star);
    };
    for (let index = 0; index < 5; index++)
      makeStar((size) => random(0, Math.max(0, height - size)));
    makeStar((size) => -size * 0.6);
    makeStar((size) => height - size * 0.4);

    let width = plate.offsetWidth;
    const updateWidth = () => {
      width = plate.offsetWidth;
    };
    window.addEventListener("resize", updateWidth);
    let frameID = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = ((now - start) % 5500) / 5500;
      const reveal = clamp(progress / 0.36, 0, 1);
      let rotateX = 0;
      let scale = 1;
      let opacity = 1;
      if (progress < 0.08) {
        const amount = progress / 0.08;
        const eased = easeOutBack(amount);
        rotateX = -92 * (1 - eased);
        scale = 0.86 + 0.14 * eased;
        opacity = clamp(amount * 2.2, 0, 1);
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15;
        const eased = easeInBack(amount);
        rotateX = 84 * eased;
        scale = 1 - 0.14 * eased;
        opacity = clamp(1 - amount * 1.5, 0, 1);
      }
      const starOpacity =
        progress < 0.04
          ? progress / 0.04
          : progress < 0.32
            ? 1
            : progress < 0.37
              ? clamp(1 - (progress - 0.32) / 0.05, 0, 1)
              : 0;
      const shineProgress = clamp((progress - 0.42) / 0.28, 0, 1);
      const shineActive = progress >= 0.42 && progress <= 0.7;
      const shineOpacity = shineActive
        ? shineProgress < 0.1
          ? shineProgress / 0.1
          : shineProgress > 0.85
            ? clamp((1 - shineProgress) / 0.15, 0, 1)
            : 1
        : 0;

      plate.style.opacity = String(opacity);
      plate.style.transform = `perspective(340px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      text.style.clipPath = `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)`;
      stars.style.transform = `translateX(${(13 + reveal * (width - 26)).toFixed(1)}px)`;
      stars.style.opacity = String(starOpacity);
      shine.style.transform = `translateX(${(((-55 + shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)`;
      shine.style.opacity = String(shineOpacity);
      frameID = requestAnimationFrame(frame);
    };
    frameID = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameID);
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  if (!label) return null;
  return (
    <span ref={plateRef} className="probe-license-nameplate">
      <strong ref={textRef} className="probe-license-text">
        {label}
      </strong>
      <span className="probe-license-shine-clip" aria-hidden="true">
        <span ref={shineRef} className="probe-license-shine" />
      </span>
      <span ref={starsRef} className="probe-license-stars" aria-hidden="true" />
    </span>
  );
}

type ProbeFilter =
  "all" | "online" | "offline" | "expiring" | "expired" | "renewal" | "alert";
type ProbeGroupBy = "none" | "region";
type ProbeDensity = "standard" | "dense";

// 工具条的排序 / 分组 / 紧凑选择记在浏览器里;隐私模式等拿不到存储时照常工作
function readPref<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 忽略
  }
}

const sortLabels: Record<ProbeSortKey, string> = {
  default: "默认顺序",
  name: "名称",
  cpu: "CPU",
  mem: "内存",
  speed: "网速",
  traffic: "计费用量",
  expiry: "到期日",
  latency: "延迟",
};

// 顶部指标格:可点击的就是一个筛选入口
// 与主仓内置探针 probe-page.tsx 的 ProbeStat 同一套布局:三行定高,右侧可挂一栏小图。
/**
 * 一行放不下就等比缩小字号直到放得下(最小 minPx),不折行、不截断。用于实时网速这类关键数字:
 * 宽字体主题 / 窄格子下宁可字小一点,也不能显示成「1.29 M…」。fitKey 变了(数值变了)重新量。
 */
function FitText({
  children,
  fitKey,
  minPx = 9,
  className,
}: {
  children: ReactNode;
  fitKey: string;
  minPx?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    // 观察格子本身而不是父元素:父元素(文字栏)的宽度跟着文字字号变,观察它会「缩字号 → 父元素变窄 →
    // 回调里重置字号 → 又变宽」来回打架,停在没缩的状态;格子宽度只由汇总网格决定
    const box = el?.closest(".kpi") ?? el?.parentElement;
    if (!el || !box) return;
    const shrink = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      // 字距 / 图标宽度不随字号等比缩,一次算不准,收敛几轮
      for (let i = 0; i < 6 && size > minPx; i++) {
        const need = el.scrollWidth;
        const avail = el.clientWidth;
        if (avail <= 0 || need <= avail + 0.5) break;
        size = Math.max(
          minPx,
          Math.floor(((size * avail) / need) * 10) / 10 - 0.2,
        );
        el.style.fontSize = `${size}px`;
      }
      return el.scrollWidth <= el.clientWidth + 0.5;
    };
    // 最小字号都放不下时再藏掉可省的说明字(.fit-drop),只留数值
    const fit = () => {
      delete el.dataset.overflow;
      if (!shrink()) {
        el.dataset.overflow = "1";
        shrink();
      }
    };
    fit();
    // 格子变宽窄、或字体 / 主题变了(文字自身宽度变)都要重量;合到下一帧做一次,
    // 回调里改字号引起的尺寸变化也只会再排一帧,不会来回打架
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(box);
    ro.observe(el);
    // 字体晚到会改变宽度,到了再量一次
    void document.fonts?.ready.then(fit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitKey, minPx]);
  return (
    <span
      ref={ref}
      className={className ? `fit-text ${className}` : "fit-text"}
    >
      {children}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  chart,
  aside,
  onClick,
  onMouseLeave,
  fitSub,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** 第三行里跟小字排在一起的小图(进度条 / 分段条) */
  chart?: ReactNode;
  /** 右侧独占一栏的图(折线 / 柱状),占满格子高度,不挤文字 */
  aside?: ReactNode;
  onClick?: () => void;
  onMouseLeave?: () => void;
  /** 小字是关键数据(实时网速峰值):放不下时缩字号而不是截成「…」,fitSub 是用来判断要不要重量的文本 */
  fitSub?: string;
}) {
  const text = (
    <div className="stat-text">
      <span className="stat-label">
        <Icon size={14} />
        <span>{label}</span>
      </span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-sub">
        {chart}
        {sub !== undefined &&
          (fitSub !== undefined ? (
            <FitText fitKey={fitSub} className="stat-sub-fit">
              {sub}
            </FitText>
          ) : (
            <span className="stat-sub-text">{sub}</span>
          ))}
      </span>
    </div>
  );
  const body = aside ? (
    <div
      className={
        fitSub !== undefined ? "stat-with-aside fit-sub" : "stat-with-aside"
      }
    >
      {text}
      <div className="stat-aside">{aside}</div>
    </div>
  ) : (
    text
  );
  const cls = fitSub !== undefined ? "kpi stat speed-cell" : "kpi stat";
  return onClick ? (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      onMouseLeave={onMouseLeave}
    >
      {body}
    </button>
  ) : (
    <div className={cls} onMouseLeave={onMouseLeave}>
      {body}
    </div>
  );
}

// ---- 汇总格里的小图(纯 SVG / flex,随容器拉伸) ----

function areaPath(
  values: (number | null)[],
  max: number,
  w: number,
  h: number,
) {
  const pts = values
    .map((v, i) =>
      v === null
        ? null
        : [
            values.length > 1 ? (i / (values.length - 1)) * w : w / 2,
            h - (max > 0 ? (v / max) * (h - 2) : 0) - 1,
          ],
    )
    .filter((p): p is number[] => p !== null);
  if (!pts.length) return { line: "", area: "" };
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join("");
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${h}L${pts[0][0].toFixed(1)},${h}Z`;
  return { line, area };
}

function MiniArea({
  series,
  height = 40,
}: {
  series: { values: (number | null)[]; color: string }[];
  height?: number;
}) {
  const W = 300;
  const max = Math.max(
    0,
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="mini-area"
      style={{ height }}
      aria-hidden
    >
      {series.map((s, i) => {
        const { line, area } = areaPath(s.values, max, W, height);
        return (
          <g key={i}>
            <path d={area} fill={s.color} fillOpacity={0.14} />
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** 柱状图:最后一根高亮(今天) */
function MiniBars({
  values,
  height = 34,
  titles,
}: {
  values: number[];
  height?: number;
  titles?: string[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="mini-bars" style={{ height }} aria-hidden>
      {values.map((v, i) => (
        <i
          key={i}
          title={titles?.[i]}
          className={i === values.length - 1 ? "today" : undefined}
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** 分段条:各段按数值占比 */
function SegmentBar({
  parts,
}: {
  parts: { value: number; color: string; title?: string }[];
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <span className="seg-bar">
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p, i) => (
            <i
              key={i}
              title={p.title}
              style={{
                width: `${(p.value / total) * 100}%`,
                background: p.color,
              }}
            />
          ))}
    </span>
  );
}

const money = (v: number) => `¥${v >= 1000 ? v.toFixed(0) : v.toFixed(2)}`;

export function App() {
  const { data, error } = useProbe();
  const [view, setView] = useState<"card" | "list">(() =>
    localStorage.getItem("probe-view") === "list" ? "list" : "card",
  );
  const [filter, setFilter] = useState<ProbeFilter>("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKeyState] = useState<ProbeSortKey>(() =>
    readPref("probe-sort", PROBE_SORT_KEYS, "default"),
  );
  const [groupBy, setGroupByState] = useState<ProbeGroupBy>(() =>
    readPref("probe-group", ["none", "region"] as const, "none"),
  );
  const [density, setDensityState] = useState<ProbeDensity>(() =>
    readPref("probe-density", ["standard", "dense"] as const, "standard"),
  );
  // 宽屏把地球放在指标右边常驻;窄屏放到下面、保持可折叠
  const setSortKey = (v: ProbeSortKey) => {
    setSortKeyState(v);
    writePref("probe-sort", v);
  };
  const setGroupBy = (v: ProbeGroupBy) => {
    setGroupByState(v);
    writePref("probe-group", v);
  };
  const setDensity = (v: ProbeDensity) => {
    setDensityState(v);
    writePref("probe-density", v);
  };
  const setMode = (next: "card" | "list") => {
    setView(next);
    localStorage.setItem("probe-view", next);
  };
  // 实时网速折线:每收到一帧快照记一个点(留 40 个 ≈ 3 分钟),只存在这个页面里;
  // 悬停折线上的某一列 → 大数字与小字换成那一刻的上下行。hooks 必须排在下面的早返回之前。
  const [speedHistory, setSpeedHistory] = useState<{ d: number; u: number }[]>(
    [],
  );
  const [speedHover, setSpeedHover] = useState<number | null>(null);
  // 汇总卡实际宽度 → 决定排几列(见 kpiColumns)。卡片是条件渲染的,用回调 ref 挂观察器。
  const [kpiWidth, setKpiWidth] = useState(0);
  const kpiObserver = useRef<ResizeObserver | null>(null);
  const kpiGridRef = useCallback((el: HTMLDivElement | null) => {
    kpiObserver.current?.disconnect();
    kpiObserver.current = null;
    if (!el) return;
    const ro = new ResizeObserver(() => setKpiWidth(el.clientWidth));
    ro.observe(el);
    setKpiWidth(el.clientWidth);
    kpiObserver.current = ro;
  }, []);
  const liveDown = (data?.servers || []).reduce(
    (sum, server) => sum + (server.download_speed || 0),
    0,
  );
  const liveUp = (data?.servers || []).reduce(
    (sum, server) => sum + (server.upload_speed || 0),
    0,
  );
  useEffect(() => {
    if (!data) return;
    setSpeedHistory((prev) => [...prev, { d: liveDown, u: liveUp }].slice(-40));
  }, [liveDown, liveUp, data]);
  if (!data && !error)
    return (
      <main className="center">
        <Activity className="pulse" />
        正在连接主控…
      </main>
    );
  if (error && !data)
    return (
      <main className="center error">
        主控暂时不可用
        <br />
        <small>{error}</small>
      </main>
    );
  if (!data?.enabled) return <main className="center">探针尚未启用</main>;
  if (data.appearance?.theme === "premium") {
    return (
      <Suspense
        fallback={<main className="center">正在加载 Premium 主题…</main>}
      >
        <PremiumProbePage data={data} isLoading={false} isError={false} />
      </Suspense>
    );
  }
  const title = data.title?.trim() || "服务器状态";
  const servers = data.servers || [];
  const onlineCount = servers.filter((server) => server.online).length;
  const offlineCount = servers.length - onlineCount;
  const expiringCount = servers.filter(expiring).length;
  const expiredCount = servers.filter(expired).length;
  const renewalServers = servers.filter(
    (server) => expiring(server) || expired(server),
  );
  const renewalCount = renewalServers.length;
  const renewalAmount = renewalServers.reduce(
    (sum, server) => sum + (server.renewal_price_cny ?? 0),
    0,
  );
  const regions = [
    ...new Set(
      servers
        .map((server) => server.region?.trim())
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const globeRegions = servers.map(probeCountryCode).filter(Boolean);
  const selectFilter = (next: ProbeFilter) => {
    setFilter(next);
    setRegion("all");
  };
  const selectRegion = (next: string) => {
    setRegion(next);
    setFilter("all");
  };
  const clearFilters = () => {
    setFilter("all");
    setRegion("all");
    setSearch("");
  };
  const hasExpiry = servers.some((server) => !!server.expires_at);
  const healthOf = (server: ProbeServer) =>
    probeHealthIssue(server, billableTraffic(server));
  const alertCount = servers.filter((server) => !!healthOf(server)).length;
  const hasMetrics = servers.some(
    (server) =>
      server.cpu_pct !== undefined ||
      server.mem_total !== undefined ||
      server.disk_total !== undefined ||
      billableTraffic(server) !== undefined,
  );
  const keyword = search.trim().toLowerCase();
  const visible = sortProbeServers(
    servers
      .map((server, index) => ({ server, index }))
      .filter(({ server }) => {
        const matchesStatus =
          filter === "all" ||
          (filter === "online" && server.online) ||
          (filter === "offline" && !server.online) ||
          (filter === "expiring" && expiring(server)) ||
          (filter === "expired" && expired(server)) ||
          (filter === "renewal" && (expiring(server) || expired(server))) ||
          (filter === "alert" && !!healthOf(server));
        const matchesSearch =
          !keyword ||
          (server.name || "").toLowerCase().includes(keyword) ||
          (server.region || "").toLowerCase().includes(keyword);
        return (
          matchesStatus &&
          matchesSearch &&
          (region === "all" || server.region?.trim() === region)
        );
      }),
    sortKey,
    (server) => billableTraffic(server as ProbeServer) ?? 0,
  );
  // 按地区分组(仅卡片视图):组按地区名排,没设地区的放最后
  const groups =
    groupBy === "region"
      ? [
          ...visible
            .reduce((map, item) => {
              const key = item.server.region?.trim() || "";
              map.set(key, [...(map.get(key) ?? []), item]);
              return map;
            }, new Map<string, typeof visible>())
            .entries(),
        ]
          .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "zh-CN")))
          .map(([key, items]) => ({
            key: key || "__none__",
            label: key || "未设置地区",
            flag: regionFlag(
              items[0] ? probeRegion(items[0].server) : undefined,
            ),
            items,
          }))
      : [{ key: "__all__", label: "", flag: "", items: visible }];
  const hasSpeed = servers.some(
    (server) =>
      server.upload_speed !== undefined || server.download_speed !== undefined,
  );
  const totalUpload = servers.reduce(
    (sum, server) => sum + (server.upload_speed || 0),
    0,
  );
  const totalDownload = servers.reduce(
    (sum, server) => sum + (server.download_speed || 0),
    0,
  );
  const todayTraffic = todayTrafficTotal(servers);
  const dailySeries = dailyTrafficSeries(servers, 14);
  const conns = connectionTotals(servers);
  const quota = quotaSummary(servers, (s) => billableTraffic(s as ProbeServer));
  const latency = latencySummary(servers);
  const monthly = monthlyCost(servers);
  const upcoming = nextExpiry(servers);
  // 汇总格右栏:宽屏时格子很宽,三行文字只占左边一截,右栏放点有信息量的图
  const connHist = connHistoryTotals(servers);
  const expiries = upcomingExpiries(servers);
  const showGlobe = !!data.show_globe && globeRegions.length > 0;
  const regionCount = new Set(globeRegions).size;
  const hov =
    speedHover !== null && speedHover < speedHistory.length
      ? speedHistory[speedHover]
      : null;
  const speedAgo =
    speedHover !== null ? (speedHistory.length - 1 - speedHover) * 3 : 0;
  // 峰值写成「3 分钟峰值 ↓ x · ↑ y」:去掉「近」省宽度,放不下时缩字号(见 FitText)
  const speedSub = hov
    ? speedAgo === 0
      ? "现在"
      : `${speedAgo} 秒前`
    : speedHistory.length > 1
      ? `3 分钟峰值|${speed(Math.max(...speedHistory.map((p) => p.d)))}|${speed(Math.max(...speedHistory.map((p) => p.u)))}`
      : "全部服务器合计";
  const speedValue = `${speed(hov ? hov.d : liveDown)}|${speed(hov ? hov.u : liveUp)}`;
  const kpis = [
    <Stat
      key="servers"
      icon={Server}
      label="服务器"
      value={
        <>
          <span className="online">{onlineCount}</span>
          <span className="stat-dim"> / {servers.length} 在线</span>
        </>
      }
      sub={
        <>
          离线{" "}
          <b className={offlineCount > 0 ? "offline" : ""}>{offlineCount}</b>
          {" · "}告警{" "}
          <b className={alertCount > 0 ? "offline" : ""}>{alertCount}</b>
          {regionCount > 0 && ` · ${regionCount} 个地区`}
        </>
      }
      onClick={() => selectFilter(offlineCount > 0 ? "offline" : "all")}
    />,
    hasSpeed && (
      <Stat
        key="speed"
        fitSub={speedSub}
        icon={Activity}
        label="实时网速"
        value={
          <FitText fitKey={speedValue} minPx={10} className="stat-speed">
            <span className="down">↓ {speed(hov ? hov.d : liveDown)}</span>{" "}
            <span className="up">↑ {speed(hov ? hov.u : liveUp)}</span>
          </FitText>
        }
        sub={
          speedSub.includes("|") ? (
            <>
              <span className="fit-drop">{speedSub.split("|")[0]} </span>↓{" "}
              {speedSub.split("|")[1]} · ↑ {speedSub.split("|")[2]}
            </>
          ) : (
            speedSub
          )
        }
        onMouseLeave={() => setSpeedHover(null)}
        aside={
          speedHistory.length > 1 ? (
            <>
              <div className="stat-aside-fill">
                <MiniArea
                  height={48}
                  series={[
                    { values: speedHistory.map((p) => p.d), color: "#22c55e" },
                    { values: speedHistory.map((p) => p.u), color: "#f97316" },
                  ]}
                />
              </div>
              {/* 透明列:hover 哪一列就读哪一刻;竖线标出位置 */}
              <div
                className="stat-aside-cols"
                style={{
                  gridTemplateColumns: `repeat(${speedHistory.length}, minmax(0, 1fr))`,
                }}
              >
                {speedHistory.map((_, i) => (
                  <span
                    key={i}
                    className={speedHover === i ? "hot" : undefined}
                    onMouseEnter={() => setSpeedHover(i)}
                  />
                ))}
              </div>
            </>
          ) : undefined
        }
      />
    ),
    conns && (
      <Stat
        key="conns"
        icon={Network}
        label="连接数"
        value={conns.total.toLocaleString()}
        sub={`TCP ${conns.tcp.toLocaleString()} · UDP ${conns.udp.toLocaleString()}`}
        aside={
          connHist && connHist.tcp.length > 1 ? (
            <div className="stat-aside-bottom">
              <MiniArea
                height={48}
                series={[
                  { values: connHist.tcp, color: "#3b82f6" },
                  { values: connHist.udp, color: "#a855f7" },
                ]}
              />
            </div>
          ) : undefined
        }
      />
    ),
    todayTraffic !== undefined && (
      <Stat
        key="today"
        icon={BarChart3}
        label="今日流量"
        value={bytes(todayTraffic, false)}
        sub={
          dailySeries.length > 1
            ? `近 ${dailySeries.length} 天 ${bytes(
                dailySeries.reduce((a, d) => a + d.total, 0),
                false,
              )}`
            : "全部服务器合计"
        }
        aside={
          dailySeries.length > 1 ? (
            <div className="stat-aside-bottom">
              <MiniBars
                values={dailySeries.map((d) => d.total)}
                titles={dailySeries.map(
                  (d) => `${d.date} ${bytes(d.total, false)}`,
                )}
              />
            </div>
          ) : undefined
        }
      />
    ),
    (quota || latency) && (
      <Stat
        key="quota-latency"
        icon={Gauge}
        label={[quota && "本期流量额度", latency && "网络质量"]
          .filter(Boolean)
          .join(" · ")}
        value={
          <span className="stat-pair">
            {quota && <span>{quota.pct.toFixed(quota.pct < 10 ? 1 : 0)}%</span>}
            {latency && (
              <span>
                {latency.avgMs !== undefined ? (
                  <>
                    {latency.avgMs}
                    <span className="stat-dim"> ms</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            )}
          </span>
        }
        chart={
          <span className="stat-inline-charts">
            {quota && (
              <>
                <span className="seg-bar grow">
                  <i
                    style={{
                      width: `${Math.min(100, quota.pct)}%`,
                      background:
                        quota.pct >= 90
                          ? "#ef4444"
                          : quota.pct >= 80
                            ? "#f59e0b"
                            : "var(--primary)",
                    }}
                  />
                </span>
                <span>
                  {bytes(quota.used, false)} / {bytes(quota.limit, false)}
                </span>
              </>
            )}
            {latency && (
              <>
                <span className="seg-wrap">
                  <SegmentBar
                    parts={[
                      {
                        value: latency.good,
                        color: "#22c55e",
                        title: `优 ${latency.good}`,
                      },
                      {
                        value: latency.fair,
                        color: "#f59e0b",
                        title: `中 ${latency.fair}`,
                      },
                      {
                        value: latency.poor,
                        color: "#ef4444",
                        title: `差 ${latency.poor}`,
                      },
                    ]}
                  />
                </span>
                <span>
                  丢包 {latency.avgLoss.toFixed(latency.avgLoss < 10 ? 1 : 0)}%
                </span>
              </>
            )}
          </span>
        }
      />
    ),
    hasExpiry && (
      <Stat
        key="renewal"
        icon={Wallet}
        aside={
          expiries.length > 0 ? (
            <div className="expiry-list">
              {expiries.map((e) => (
                <span key={e.name}>
                  <span>{e.name || "—"}</span>
                  <span
                    className={
                      e.days < 0 ? "gone" : e.days <= 7 ? "soon" : undefined
                    }
                  >
                    {e.days < 0
                      ? `过期 ${-e.days} 天`
                      : e.days === 0
                        ? "今天"
                        : `${e.days} 天`}
                  </span>
                </span>
              ))}
            </div>
          ) : undefined
        }
        label="续费"
        value={
          <>
            <span className={renewalCount > 0 ? "warn" : undefined}>
              {renewalCount}
            </span>
            <span className="stat-dim"> 台 30 天内到期</span>
          </>
        }
        sub={[
          renewalAmount > 0 && money(renewalAmount),
          monthly !== undefined && `月均 ${money(monthly)}`,
          upcoming &&
            `最近 ${upcoming.name || "—"} ${
              upcoming.days === 0 ? "今天" : `${upcoming.days} 天`
            }`,
        ]
          .filter(Boolean)
          .join(" · ")}
        onClick={() => selectFilter("renewal")}
      />
    ),
  ].filter(Boolean);
  const globeBody = (
    <Suspense fallback={<div className="globe-loading">正在加载国界数据…</div>}>
      <RegionGlobe regions={globeRegions} compact />
    </Suspense>
  );
  // 按卡宽算列数、各行格数均分(见 kpiColumns):auto-fit 在宽屏上会排成 5 + 2,第二行右边空一大块
  const kpiGrid = (
    <div
      ref={kpiGridRef}
      className="kpi-grid six"
      style={{
        gridTemplateColumns: `repeat(${kpiColumns(kpis.length, kpiWidth)}, minmax(0, 1fr))`,
      }}
    >
      {kpis}
    </div>
  );
  return (
    <HistoryDaysContext.Provider value={data.history_days ?? 1}>
      <div
        className={
          data.license_badge ? "app-shell has-license-footer" : "app-shell"
        }
      >
        <header className="topbar">
          <div>
            {data.logo && <img src={data.logo} alt="" />}
            <h1>{title}</h1>
          </div>
          <nav>
            <ThemeSwitch appearance={data.appearance} />
            <PasskeyLogin />
            <button
              aria-label="卡片视图"
              title="卡片视图"
              className={view === "card" ? "active" : ""}
              onClick={() => setMode("card")}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              aria-label="列表视图"
              title="列表视图"
              className={view === "list" ? "active" : ""}
              onClick={() => setMode("list")}
            >
              <List size={18} />
            </button>
          </nav>
        </header>
        {servers.length > 0 &&
          (showGlobe ? (
            <section className="overview with-globe">
              {kpiGrid}
              {/* 右侧只放地球本身,不再带地区标签:标签占掉一半宽度让地球只有 112px */}
              <article className="globe-mini">
                <div className="globe-mini-stage">{globeBody}</div>
              </article>
            </section>
          ) : (
            <section className="overview">{kpiGrid}</section>
          ))}
        <section className="probe-toolbar">
          <div className="filters">
            <label className="probe-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索服务器名称…"
                aria-label="搜索服务器"
              />
            </label>
            <div role="group" aria-label="状态筛选" className="filter-seg">
              {(
                [
                  ["all", "全部", servers.length, ""],
                  ["online", "在线", onlineCount, ""],
                  ["offline", "离线", offlineCount, "danger"],
                  hasMetrics && ["alert", "告警", alertCount, "danger"],
                  hasExpiry && ["renewal", "待续费", renewalCount, "warning"],
                  hasExpiry && [
                    "expiring",
                    "即将到期",
                    expiringCount,
                    "warning",
                  ],
                  hasExpiry && ["expired", "已到期", expiredCount, "danger"],
                ].filter(Boolean) as [ProbeFilter, string, number, string][]
              ).map(([key, label, count, tone]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  title={
                    key === "alert"
                      ? "CPU、内存、硬盘或计费用量超过 90%"
                      : undefined
                  }
                  onClick={() => selectFilter(key)}
                >
                  {label}{" "}
                  <em className={count > 0 ? tone : undefined}>{count}</em>
                </button>
              ))}
            </div>
            <div className="toolbar-end">
              {regions.length > 0 && (
                <label className="region-filter">
                  <MapPin size={14} />
                  <select
                    aria-label="地区筛选"
                    value={region}
                    onChange={(event) => selectRegion(event.target.value)}
                  >
                    <option value="all">全部地区</option>
                    {regions.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="region-filter">
                排序
                <select
                  aria-label="排序"
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(event.target.value as ProbeSortKey)
                  }
                >
                  {PROBE_SORT_KEYS.map((key) => (
                    <option value={key} key={key}>
                      {sortLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              {view === "card" && (
                <>
                  {regions.length > 0 && (
                    <label className="region-filter">
                      分组
                      <select
                        aria-label="分组"
                        value={groupBy}
                        onChange={(event) =>
                          setGroupBy(event.target.value as ProbeGroupBy)
                        }
                      >
                        <option value="none">不分组</option>
                        <option value="region">按地区</option>
                      </select>
                    </label>
                  )}
                  <span className="density-toggle">
                    <button
                      className={density === "standard" ? "active" : ""}
                      onClick={() => setDensity("standard")}
                    >
                      标准
                    </button>
                    <button
                      className={density === "dense" ? "active" : ""}
                      onClick={() => setDensity("dense")}
                    >
                      紧凑
                    </button>
                  </span>
                </>
              )}
            </div>
          </div>
        </section>
        <main
          key={view}
          className={`servers ${view}${view === "card" ? " grouped" : ""}`}
        >
          {visible.length ? (
            view === "card" ? (
              groups.map((group) => (
                <section key={group.key} className="server-group">
                  {groupBy === "region" && (
                    <h2 className="group-heading">
                      <Twemoji>
                        {group.flag
                          ? `${group.flag} ${group.label}`
                          : group.label}
                      </Twemoji>
                      <small>{group.items.length} 台</small>
                    </h2>
                  )}
                  <div
                    className={[
                      "server-grid",
                      density === "dense" ? "dense" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {group.items.map(({ server, index }) => (
                      <ServerCard
                        key={server.name || index}
                        server={server}
                        index={index}
                        triISP={data?.tri_isp}
                        dense={density === "dense"}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <ServerTable items={visible} triISP={data?.tri_isp} />
            )
          ) : (
            <div className="empty">
              <span>暂无符合筛选条件的服务器</span>
              <button type="button" onClick={clearFilters}>
                查看全部
              </button>
            </div>
          )}
        </main>
        <footer>
          Powered by{" "}
          <a
            href="https://github.com/mmwx-group"
            target="_blank"
            rel="noreferrer"
          >
            MMWX Group
          </a>
        </footer>
        {data.license_badge && (
          <div className="probe-license-footer">
            <ProbeLicenseNameplate
              name={data.license_badge.name}
              displayName={data.license_badge.display_name}
            />
          </div>
        )}
      </div>
    </HistoryDaysContext.Provider>
  );
}
