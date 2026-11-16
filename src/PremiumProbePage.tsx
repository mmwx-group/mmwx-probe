import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Globe2,
  Gauge,
  Radio,
  Server,
  ShieldCheck,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { triISPRows } from "./tri-isp";
import { CONN_COUNT_HINT, connCount, UnlockTabbedList } from "./App";
import {
  ConnLegendDot,
  ConnSparkline,
  ResourceSparkline,
} from "./ConnSparkline";
import {
  resourceHistoryFromSeries,
  type ResourceSeriesInput,
} from "./resource-history";
import { connHistoryFromSeries, type ProbeMetricPoint } from "./conn-sparkline";
import {
  effectiveProbeRange,
  probeRangeBucketCount,
  probeRangeBucketSec,
  probeRangeOptions,
} from "./probe-ranges";
import type {
  ForwardChainBucket,
  ForwardChainData,
  ForwardChainTraffic,
  ForwardTrafficServer,
  ProbePingSeries,
  ProbeServer,
  ProbePayload,
  TriISPPublic,
} from "./types";
import { Twemoji } from "./Twemoji";
import { FLAG_OPTIONS } from "./country-flag";
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
import {
  clearServerDetail,
  openServerDetail,
  readServerDetailRoute,
} from "./server-detail-route";
import { BlackGoldGlobe, type PremiumProbeRegion } from "./BlackGoldGlobe";
import { ThemeSwitch } from "./ThemeSwitch";
import { PasskeyLogin } from "./PasskeyLogin";
import { ProviderLogo, providerLogoSrc } from "./ProviderLogo";
import "./premium-probe.css";

type ProbeData = ProbePayload;

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const LICENSE_CYCLE_MS = 5500;
const LICENSE_REVEAL_END = 0.36;
const licenseStarPalette = [
  "#8c5d17",
  "#d7a63d",
  "#f2d78a",
  "#fff1b9",
  "#c78e24",
];
const licenseClamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;
const licenseRandom = (min: number, max: number) =>
  min + Math.random() * (max - min);
const licenseEaseOutBack = (value: number) => {
  const strength = 1.70158;
  return (
    1 +
    (strength + 1) * Math.pow(value - 1, 3) +
    strength * Math.pow(value - 1, 2)
  );
};
const licenseEaseInBack = (value: number) => {
  const strength = 1.70158;
  return (strength + 1) * value * value * value - strength * value * value;
};

function LicenseNameplate({ label }: { label: string }) {
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

    stars.innerHTML = "";
    const height = stars.clientHeight || 24;
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement("i");
      star.className = "spark";
      star.style.color =
        licenseStarPalette[
          Math.floor(Math.random() * licenseStarPalette.length)
        ];
      const size = Math.round(licenseRandom(8, 13));
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.top = `${Math.round(topFor(size))}px`;
      star.style.left = `${Math.round(licenseRandom(0, 12))}px`;
      stars.appendChild(star);
    };
    for (let index = 0; index < 5; index++) {
      makeStar((size) => licenseRandom(0, Math.max(0, height - size)));
    }
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
      const progress = ((now - start) % LICENSE_CYCLE_MS) / LICENSE_CYCLE_MS;
      const reveal = licenseClamp(progress / LICENSE_REVEAL_END, 0, 1);
      let rotateX = 0;
      let scale = 1;
      let opacity = 1;
      if (progress < 0.08) {
        const amount = progress / 0.08;
        const eased = licenseEaseOutBack(amount);
        rotateX = -92 * (1 - eased);
        scale = 0.86 + 0.14 * eased;
        opacity = licenseClamp(amount * 2.2, 0, 1);
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15;
        const eased = licenseEaseInBack(amount);
        rotateX = 84 * eased;
        scale = 1 - 0.14 * eased;
        opacity = licenseClamp(1 - amount * 1.5, 0, 1);
      }
      const starOpacity =
        progress < 0.04
          ? progress / 0.04
          : progress < 0.32
            ? 1
            : progress < 0.37
              ? licenseClamp(1 - (progress - 0.32) / 0.05, 0, 1)
              : 0;
      const shineProgress = licenseClamp((progress - 0.42) / 0.28, 0, 1);
      const shineActive = progress >= 0.42 && progress <= 0.7;
      const shineOpacity = shineActive
        ? shineProgress < 0.1
          ? shineProgress / 0.1
          : shineProgress > 0.85
            ? licenseClamp((1 - shineProgress) / 0.15, 0, 1)
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

  return (
    <span ref={plateRef} className="license-nameplate">
      <span ref={textRef} className="np-text">
        {label}
      </span>
      <span className="np-shine-clip" aria-hidden="true">
        <span ref={shineRef} className="np-shine" />
      </span>
      <span ref={starsRef} className="np-stars" aria-hidden="true" />
    </span>
  );
}

function formatTrafficCompact(value = 0): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = Math.max(0, value);
  let index = 0;
  // 到 1000 就进下一级(除数仍是 1024):「1000 GB」太长;进位后不足 1 的(0.98 TB)留 1 位,显示成「1 TB」
  while (size >= 1000 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  const digits =
    index === 0 || size >= 100 ? 0 : size >= 10 || size < 1 ? 1 : 2;
  return `${size.toFixed(digits).replace(/\.0+$/, "")} ${units[index]}`;
}

function formatSignedTraffic(value: number): string {
  if (value === 0) return formatTrafficCompact(0);
  return `${value > 0 ? "+" : "−"}${formatTrafficCompact(Math.abs(value))}`;
}

type PremiumProbePageProps = {
  data?: ProbeData;
  isLoading: boolean;
  isError: boolean;
};

type StatusFilter = "all" | "online" | "offline";
type PremiumProbeView = "card" | "network" | "resource";

type TrendSample = {
  label: string;
  value: number;
  formatted: string;
};

function StandaloneLicenseBadge({
  badge,
  className,
  animated = false,
}: {
  badge?: ProbePayload["license_badge"];
  className?: string;
  animated?: boolean;
}) {
  const label = [badge?.name?.trim(), badge?.display_name?.trim()]
    .filter(Boolean)
    .join(" · ");
  if (!label) return null;
  return (
    <span className={cn("premium-probe-license-badge", className)}>
      {animated ? (
        <LicenseNameplate label={label} />
      ) : (
        <span className="premium-probe-license-name">{label}</span>
      )}
    </span>
  );
}

const regionNames = Object.fromEntries(
  FLAG_OPTIONS.map((item) => [item.code, item.label]),
);

const placeNames: Record<string, string> = {
  tokyo: "东京",
  osaka: "大阪",
  taichung: "台中",
  taipei: "台北",
  "hong kong": "香港",
  singapore: "新加坡",
  seoul: "首尔",
  "los angeles": "洛杉矶",
  "san jose": "圣何塞",
  frankfurt: "法兰克福",
  london: "伦敦",
};

function flagToCountryCode(value?: string): string {
  const points = [...(value?.trim() || "")].map(
    (character) => character.codePointAt(0) || 0,
  );
  if (
    points.length === 2 &&
    points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
  ) {
    return points
      .map((point) => String.fromCharCode(point - 0x1f1e6 + 65))
      .join("");
  }
  const code =
    value
      ?.trim()
      .split(/[·,\s]+/)[0]
      ?.toUpperCase() || "";
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function countryFlag(code?: string): string {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (character) => 0x1f1e6 + character.charCodeAt(0) - 65,
    ),
  );
}

function localizedRegionLabel(server: ProbeServer, code?: string): string {
  const normalizedCode = code || serverRegionKey(server);
  const flag = countryFlag(normalizedCode);
  const country = regionNames[normalizedCode] || "";
  const rawPlace = server.region_city || server.region_name || "";
  const normalizedPlace = rawPlace.trim().replace(/[，,、·\s]+$/u, "");
  const place = placeNames[normalizedPlace.toLowerCase()] || normalizedPlace;
  const detail =
    place && place !== country
      ? [country, place].filter(Boolean).join(" · ")
      : country || place;
  return [flag, detail || server.region || "未知地区"]
    .filter(Boolean)
    .join(" ");
}

function formatBitSpeed(bytesPerSecond: number): string {
  let value = Math.max(0, bytesPerSecond) * 8;
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
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

function averageLatency(server: ProbeServer): number | undefined {
  const values = (server.ping || [])
    .map((series) => series.current_ms)
    .filter((value) => value >= 0);
  if (!values.length) return undefined;
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function percentage(used?: number, total?: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(used || 0) / total) * 100));
}

function resourcePercentage(used?: number, total?: number): number | undefined {
  if (used === undefined || !total) return undefined;
  return percentage(used, total);
}

function serverRegionKey(server: ProbeServer): string {
  return (
    // 手动选的国旗优先,自动识别的国家兜底(见 App.tsx probeRegion)
    flagToCountryCode(server.region) ||
    flagToCountryCode(server.region_country) ||
    "UNKNOWN"
  );
}

function buildRegions(servers: ProbeServer[]): PremiumProbeRegion[] {
  const groups = new Map<string, ProbeServer[]>();
  for (const server of servers) {
    const key = serverRegionKey(server);
    if (key === "UNKNOWN") continue;
    const group = groups.get(key) || [];
    group.push(server);
    groups.set(key, group);
  }
  return [...groups].map(([code, group]) => {
    const sample = group[0];
    return {
      code,
      label: localizedRegionLabel(sample, code),
      total: group.length,
      online: group.filter((server) => server.online).length,
    };
  });
}

type HealthResult = {
  score: number;
  label: "卓越" | "良好" | "注意" | "异常";
  tone: "excellent" | "good" | "warning" | "critical";
  issues: string[];
};

function serverHealth(server: ProbeServer): HealthResult {
  if (!server.online) {
    return {
      score: 0,
      label: "异常",
      tone: "critical",
      issues: ["服务器离线"],
    };
  }
  let score = 100;
  const issues: string[] = [];
  const mem = resourcePercentage(server.mem_used, server.mem_total);
  const disk = resourcePercentage(server.disk_used, server.disk_total);
  const resources = [
    ["CPU", server.cpu_pct],
    ["内存", mem],
    ["硬盘", disk],
  ] as const;
  for (const [name, value] of resources) {
    if (value === undefined) continue;
    if (value >= 90) {
      score -= 18;
      issues.push(`${name}压力过高`);
    } else if (value >= 75) {
      score -= 9;
      issues.push(`${name}压力偏高`);
    }
  }
  const latency = averageLatency(server);
  const losses = (server.ping || [])
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0);
  const loss = losses.length
    ? losses.reduce((total, value) => total + value, 0) / losses.length
    : undefined;
  if (latency !== undefined && latency >= 250) {
    score -= 18;
    issues.push("网络延迟过高");
  } else if (latency !== undefined && latency >= 120) {
    score -= 8;
    issues.push("网络延迟偏高");
  }
  if (loss !== undefined && loss >= 10) {
    score -= 20;
    issues.push("丢包严重");
  } else if (loss !== undefined && loss >= 3) {
    score -= 9;
    issues.push("存在丢包");
  }
  if (server.traffic_limit) {
    const used = billableTraffic(server) ?? 0;
    const quota = percentage(used, server.traffic_limit);
    if (quota >= 95) {
      score -= 16;
      issues.push("流量额度即将耗尽");
    } else if (quota >= 80) {
      score -= 7;
      issues.push("流量额度偏高");
    }
  }
  if (server.expires_at) {
    const days = Math.ceil(
      (new Date(`${server.expires_at}T00:00:00`).getTime() - Date.now()) /
        86400000,
    );
    if (days < 0) {
      score -= 20;
      issues.push("服务器已到期");
    } else if (days <= 14) {
      score -= 8;
      issues.push("服务器即将到期");
    }
  }
  score = Math.max(0, Math.round(score));
  if (score >= 90) return { score, label: "卓越", tone: "excellent", issues };
  if (score >= 75) return { score, label: "良好", tone: "good", issues };
  if (score >= 55) return { score, label: "注意", tone: "warning", issues };
  return { score, label: "异常", tone: "critical", issues };
}

function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, "") === "CMIN"
    ? "CMI"
    : route;
}

function summarizeSevenDayTraffic(servers: ProbeServer[]) {
  const trafficDates = servers
    .flatMap((server) => server.daily_traffic || [])
    .map((item) => item.date)
    .sort();
  const latest = trafficDates[trafficDates.length - 1];
  if (!latest) return [];
  const end = new Date(`${latest}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(end);
    current.setUTCDate(end.getUTCDate() - 6 + index);
    const date = current.toISOString().slice(0, 10);
    let uplink = 0;
    let downlink = 0;
    for (const server of servers) {
      const day = server.daily_traffic?.find((item) => item.date === date);
      uplink += day?.uplink || 0;
      downlink += day?.downlink || 0;
    }
    return { date, uplink, downlink, total: uplink + downlink };
  });
}

function resourcePressureRows(servers: ProbeServer[]) {
  return servers
    .map((server, index) => {
      const cpu = server.cpu_pct;
      const mem = resourcePercentage(server.mem_used, server.mem_total);
      const disk = resourcePercentage(server.disk_used, server.disk_total);
      return {
        index,
        name: server.name || `#${index + 1}`,
        cpu,
        mem,
        disk,
        pressure: Math.max(cpu ?? -1, mem ?? -1, disk ?? -1),
      };
    })
    .sort((left, right) => right.pressure - left.pressure);
}

function trafficQuotaRows(servers: ProbeServer[]) {
  return servers
    .map((server, index) => ({
      index,
      name: server.name || `#${index + 1}`,
      used: billableTraffic(server) ?? 0,
      limit: server.traffic_limit || 0,
    }))
    .filter((item) => item.limit > 0)
    .map((item) => ({ ...item, percent: percentage(item.used, item.limit) }))
    .sort((left, right) => right.percent - left.percent);
}

function renewalTimelineRows(servers: ProbeServer[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return servers
    .map((server, index) => {
      // 永久(一次性买断)没有到期日,不进续费时间轴
      if (!server.expires_at || server.renewal_cycle === "permanent")
        return undefined;
      const expiresAt = new Date(`${server.expires_at}T00:00:00`);
      const days = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
      const price =
        server.renewal_price_cny ??
        (server.renewal_currency === "CNY" ? server.renewal_price : undefined);
      const cycleMonths = {
        month: 1,
        quarter: 3,
        half_year: 6,
        year: 12,
        two_year: 24,
        three_year: 36,
      }[server.renewal_cycle || "month"];
      return {
        index,
        name: server.name || `#${index + 1}`,
        expiresAt: server.expires_at,
        days,
        price,
        monthlyPrice: price === undefined ? undefined : price / cycleMonths,
        providerName: server.provider_name,
        providerUrl: server.provider_url,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));
}

function RenewalTimeline({
  rows,
}: {
  rows: ReturnType<typeof renewalTimelineRows>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // moved:区分「拖动时间轴」和「点某一格」——拖完手指抬起会紧跟一个 click,
  // 不记这个标记的话,横向拖一下就会误开服务商官网。
  const dragRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTotal = rows.reduce(
    (total, item) => total + (item.monthlyPrice || 0),
    0,
  );
  const unpaidThisMonth = rows
    .filter((item) => item.expiresAt.startsWith(currentMonth))
    .reduce((total, item) => total + (item.price || 0), 0);

  return (
    <>
      <div className="premium-probe-renewal-totals">
        <div>
          <span>月度折算总额</span>
          <strong>¥{monthlyTotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>本月未续费金额</span>
          <strong>¥{unpaidThisMonth.toFixed(2)}</strong>
        </div>
        <small>按住时间轴可横向拖动</small>
      </div>
      {rows.length === 0 ? (
        <p className="premium-probe-insights-empty">暂无可用数据</p>
      ) : (
        <div
          ref={trackRef}
          className="premium-probe-renewals"
          onPointerDown={(event) => {
            const track = trackRef.current;
            if (!track) return;
            dragRef.current = {
              active: true,
              startX: event.clientX,
              scrollLeft: track.scrollLeft,
              moved: false,
            };
            // 关键(#575):这里**不**立即 setPointerCapture。一旦捕获,Chrome 会把随后的
            // click 改派到捕获元素(本 div)而非被点的 <a>,导致 <a> 的原生跳转永不触发 ——
            // 「点续费服务器跳不过去」的真凶。改成「确认是拖动后再捕获」(见 onPointerMove)。
          }}
          onPointerMove={(event) => {
            const track = trackRef.current;
            if (!track || !dragRef.current.active) return;
            const dx = event.clientX - dragRef.current.startX;
            // 4px 的容差:点击时手指/鼠标难免抖一两个像素,不该算成拖动。超过阈值才判定为
            // 拖动 —— 此刻才捕获指针,好让拖动能拖出轨道范围继续滚动;纯点击永远走不到这里,
            // 于是 <a> 的原生 click 不被 setPointerCapture 改派吃掉,跳转正常。
            if (Math.abs(dx) > 4 && !dragRef.current.moved) {
              dragRef.current.moved = true;
              track.setPointerCapture(event.pointerId);
            }
            if (dragRef.current.moved) {
              track.scrollLeft = dragRef.current.scrollLeft - dx;
            }
          }}
          onPointerUp={() => {
            dragRef.current.active = false;
          }}
          onPointerCancel={() => {
            dragRef.current.active = false;
          }}
        >
          <div className="premium-probe-renewal-track">
            {rows.map((item) => {
              const tone =
                item.days < 0
                  ? "is-expired"
                  : item.days <= 30
                    ? "is-due"
                    : undefined;
              const inner = (
                <>
                  <time>{item.expiresAt}</time>
                  <i />
                  <Twemoji className="premium-probe-server-name">
                    {item.name}
                  </Twemoji>
                  <strong>
                    {item.days < 0
                      ? `已过期 ${Math.abs(item.days)} 天`
                      : item.days === 0
                        ? "今天到期"
                        : `${item.days} 天后`}
                  </strong>
                  {item.price !== undefined && (
                    <small>¥{item.price.toFixed(2)}</small>
                  )}
                </>
              );
              // 到期了要续费,下一步一定是去服务商官网 —— 填了 URL 就让这一格能点。
              // 时间轴本身可以按住横向拖动,所以拖动过程中不能触发跳转(见 onClick)。
              if (!item.providerUrl) {
                return (
                  <div key={item.index} className={tone}>
                    {inner}
                  </div>
                );
              }
              return (
                <a
                  key={item.index}
                  className={[tone, "is-linked"].filter(Boolean).join(" ")}
                  href={item.providerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`前往 ${item.providerName || "服务商"} 续费`}
                  onClick={(event) => {
                    if (dragRef.current.moved) event.preventDefault();
                  }}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function BillingOverview({ servers }: { servers: ProbeServer[] }) {
  const cycleMonths = {
    month: 1,
    quarter: 3,
    half_year: 6,
    year: 12,
    two_year: 24,
    three_year: 36,
  } as const;
  const cycleLabels = {
    month: "月付",
    quarter: "季付",
    half_year: "半年付",
    year: "年付",
    two_year: "两年付",
    three_year: "三年付",
    permanent: "永久",
  } as const;
  const rows = servers
    .map((server, index) => {
      const price =
        server.renewal_price_cny ??
        (server.renewal_currency === "CNY" ? server.renewal_price : undefined);
      if (price === undefined) return undefined;
      const cycle = server.renewal_cycle || "month";
      return {
        index,
        name: server.name || `#${index + 1}`,
        cycle: cycleLabels[cycle],
        // 永久(一次性买断)没有续费成本:月均按 0 计,不摊进月度/年化预算
        monthly: cycle === "permanent" ? 0 : price / cycleMonths[cycle],
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => right.monthly - left.monthly);
  const monthlyTotal = rows.reduce((total, item) => total + item.monthly, 0);
  const dueIn30Days = renewalTimelineRows(servers)
    .filter((item) => item.days >= 0 && item.days <= 30)
    .reduce((total, item) => total + (item.price || 0), 0);
  const maxMonthly = Math.max(1, ...rows.map((item) => item.monthly));

  return (
    <article className="premium-probe-insight-card premium-probe-billing-card">
      <header>
        <h3>
          <CreditCard />
          账单与成本分析
        </h3>
        <span>按人民币月均折算</span>
      </header>
      {rows.length === 0 ? (
        <p className="premium-probe-insights-empty">暂无人民币续费价格数据</p>
      ) : (
        <div className="premium-probe-billing-layout">
          <div className="premium-probe-billing-kpis">
            <div>
              <span>月均基础成本</span>
              <strong>¥{monthlyTotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>年化预算</span>
              <strong>¥{(monthlyTotal * 12).toFixed(2)}</strong>
            </div>
            <div>
              <span>未来 30 天应续</span>
              <strong>¥{dueIn30Days.toFixed(2)}</strong>
            </div>
            <div>
              <span>价格数据覆盖</span>
              <strong>
                {rows.length}/{servers.length} 台
              </strong>
            </div>
          </div>
          <div className="premium-probe-billing-rank">
            <div className="is-head">
              <span>月均成本排行</span>
              <small>折算金额</small>
            </div>
            {rows.slice(0, 6).map((item) => (
              <div key={item.index}>
                <Twemoji>{item.name}</Twemoji>
                <i>
                  <b
                    style={{ width: `${(item.monthly / maxMonthly) * 100}%` }}
                  />
                </i>
                <strong>¥{item.monthly.toFixed(2)}</strong>
                <small>{item.cycle}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function DataInsightPanels({
  servers,
  showTraffic7D,
  showResourceHeatmap,
  showTrafficQuota,
  showRenewalTimeline,
}: {
  servers: ProbeServer[];
  showTraffic7D: boolean;
  showResourceHeatmap: boolean;
  showTrafficQuota: boolean;
  showRenewalTimeline: boolean;
}) {
  const traffic = summarizeSevenDayTraffic(servers);
  const heatmap = resourcePressureRows(servers);
  const quota = trafficQuotaRows(servers);
  const renewals = renewalTimelineRows(servers);
  const maxTraffic = Math.max(1, ...traffic.map((item) => item.total));
  const primaryInsightCount =
    Number(showTraffic7D) +
    Number(showResourceHeatmap) +
    Number(showTrafficQuota);
  const heatColor = (value?: number) => {
    if (value === undefined) return "rgba(255,255,255,.035)";
    if (value >= 85) return "rgba(239,91,100,.72)";
    if (value >= 60) return "rgba(224,156,58,.62)";
    return `rgba(216,180,106,${0.16 + value / 180})`;
  };
  const empty = <p className="premium-probe-insights-empty">暂无可用数据</p>;

  return (
    <section
      className={cn(
        "premium-probe-insights",
        `has-${primaryInsightCount}-primary`,
      )}
    >
      {showTraffic7D && (
        <article className="premium-probe-insight-card">
          <header>
            <h3>
              <Activity />近 7 日原始上下行流量
            </h3>
            <span>
              <i className="is-down" />
              下行 <i className="is-up" />
              上行
            </span>
          </header>
          {traffic.length === 0 ? (
            empty
          ) : (
            <div className="premium-probe-seven-days">
              {traffic.map((item) => (
                <div
                  key={item.date}
                  title={`${item.date} · ${formatTrafficCompact(item.total)}`}
                >
                  <div>
                    <i
                      className="is-up"
                      style={{ height: `${(item.uplink / maxTraffic) * 100}%` }}
                    />
                    <i
                      className="is-down"
                      style={{
                        height: `${(item.downlink / maxTraffic) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{item.date.slice(5).replace("-", "/")}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showResourceHeatmap && (
        <article className="premium-probe-insight-card">
          <header>
            <h3>
              <Gauge />
              资源压力热力图
            </h3>
            <span>CPU · MEM · DISK</span>
          </header>
          {heatmap.length === 0 ? (
            empty
          ) : (
            <div className="premium-probe-heatmap">
              <div className="is-head">
                <span>服务器</span>
                <b>CPU</b>
                <b>内存</b>
                <b>硬盘</b>
              </div>
              {heatmap.map((item) => (
                <div key={item.index}>
                  <Twemoji className="premium-probe-server-name">
                    {item.name}
                  </Twemoji>
                  {[item.cpu, item.mem, item.disk].map((value, index) => (
                    <b key={index} style={{ background: heatColor(value) }}>
                      {value === undefined ? "—" : `${value.toFixed(0)}%`}
                    </b>
                  ))}
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showTrafficQuota && (
        <article className="premium-probe-insight-card">
          <header>
            <h3>
              <Gauge />
              流量额度使用率排行
            </h3>
            <span>{quota.length} 台有限额</span>
          </header>
          {quota.length === 0 ? (
            empty
          ) : (
            <div className="premium-probe-quota-rank">
              {quota.map((item, rank) => (
                <div key={item.index}>
                  <em>{rank + 1}</em>
                  <Twemoji className="premium-probe-server-name">
                    {item.name}
                  </Twemoji>
                  <i>
                    <b style={{ width: `${item.percent}%` }} />
                  </i>
                  <strong>{item.percent.toFixed(0)}%</strong>
                  <small>
                    {formatTrafficCompact(item.used)} /{" "}
                    {formatTrafficCompact(item.limit)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showRenewalTimeline && <BillingOverview servers={servers} />}

      {showRenewalTimeline && (
        <article className="premium-probe-insight-card premium-probe-renewal-card">
          <header>
            <h3>
              <CalendarClock />
              服务器续费与到期时间轴
            </h3>
            <span>按到期日排序</span>
          </header>
          <RenewalTimeline rows={renewals} />
        </article>
      )}
    </section>
  );
}

function PremiumResourceOverview({
  servers,
  visibility,
}: {
  servers: ProbeServer[];
  visibility: {
    traffic7D: boolean;
    resourceHeatmap: boolean;
    trafficQuota: boolean;
    renewalTimeline: boolean;
  };
}) {
  const enabledCount = Object.values(visibility).filter(Boolean).length;

  return (
    <section className="premium-probe-resource-view">
      <SmartSummary servers={servers} />
      <header className="premium-probe-resource-heading">
        <div>
          <span>
            <Gauge />
          </span>
          <div>
            <h2>资源概况</h2>
            <p>集中查看集群资源、流量额度与服务器续费状态</p>
          </div>
        </div>
        <strong>
          {servers.length} 台服务器 · {enabledCount} 个模块
        </strong>
      </header>

      {enabledCount > 0 ? (
        <DataInsightPanels
          servers={servers}
          showTraffic7D={visibility.traffic7D}
          showResourceHeatmap={visibility.resourceHeatmap}
          showTrafficQuota={visibility.trafficQuota}
          showRenewalTimeline={visibility.renewalTimeline}
        />
      ) : (
        <div className="premium-probe-resource-empty">
          主控暂未启用资源概况模块
        </div>
      )}
    </section>
  );
}

function SmartSummary({ servers }: { servers: ProbeServer[] }) {
  const online = servers.filter((server) => server.online).length;
  const attention = servers.filter(
    (server) => serverHealth(server).score < 75,
  ).length;
  const due = renewalTimelineRows(servers).filter(
    (item) => item.days >= 0 && item.days <= 14,
  ).length;
  const lossy = servers
    .map((server) => ({
      server,
      loss: Math.max(-1, ...(server.ping || []).map((item) => item.loss_pct)),
    }))
    .sort((left, right) => right.loss - left.loss)[0];
  const parts = [`${online}/${servers.length} 台服务器在线`];
  if (attention > 0) parts.push(`${attention} 台需要关注`);
  if (lossy?.loss >= 3)
    parts.push(
      `${localizedRegionLabel(lossy.server)}节点最高丢包 ${lossy.loss.toFixed(1)}%`,
    );
  if (due > 0) parts.push(`${due} 台将在 14 天内到期`);
  if (parts.length === 1 && online === servers.length && servers.length > 0)
    parts.push("当前未发现明显异常");

  return (
    <section className="premium-probe-smart-summary">
      <ShieldCheck />
      <div>
        <span>智能运行摘要</span>
        <strong>{parts.join("，")}。</strong>
      </div>
    </section>
  );
}

function SpeedSnapshot({
  label,
  value,
  samples,
}: {
  label: string;
  value: string;
  samples: TrendSample[];
}) {
  return (
    <div className="premium-probe-speed-snapshot">
      <div className="premium-probe-speed-heading">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <InteractiveTrend samples={samples} />
      <div className="premium-probe-speed-meta">
        <small>逐次推送 · 秒级时间</small>
        <small>{samples.length} 个实时采样点</small>
      </div>
    </div>
  );
}

function chartPath(samples: number[], fixedCeiling?: number) {
  if (!samples.length)
    return { line: "", area: "", points: [], last: undefined };
  const width = 260;
  const height = 54;
  const baseline = height - 3;
  const ceiling = fixedCeiling || Math.max(...samples, 1) * 1.08;
  const points = samples.map((sample, index) => ({
    x: samples.length === 1 ? width : (index / (samples.length - 1)) * width,
    y:
      baseline -
      (Math.min(ceiling, Math.max(0, sample)) / ceiling) * (height - 10),
  }));
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  return {
    line,
    area: `${line} L ${width} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`,
    points,
    last: points[points.length - 1],
  };
}

function InteractiveTrend({
  samples,
  compact = false,
  showArea = true,
}: {
  samples: TrendSample[];
  compact?: boolean;
  showArea?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number>();
  const chart = chartPath(samples.map((sample) => sample.value));
  const activeSample =
    activeIndex === undefined ? undefined : samples[activeIndex];
  const activePoint =
    activeIndex === undefined ? undefined : chart.points[activeIndex];
  const tooltipLeft = activePoint
    ? Math.max(12, Math.min(88, (activePoint.x / 260) * 100))
    : 50;

  return (
    <div
      className={cn(
        "premium-probe-speed-chart premium-probe-interactive-chart",
        compact && "is-compact",
      )}
      onPointerMove={(event) => {
        if (!samples.length) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width),
        );
        setActiveIndex(Math.round(ratio * (samples.length - 1)));
      }}
      onPointerLeave={() => setActiveIndex(undefined)}
    >
      <svg viewBox="0 0 260 54" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="51" x2="260" y2="51" />
        {samples.length > 1 && showArea && (
          <path className="is-area" d={chart.area} />
        )}
        {samples.length > 1 && <path className="is-line" d={chart.line} />}
        {chart.last && !activePoint && (
          <circle cx={chart.last.x} cy={chart.last.y} r="2.5" />
        )}
        {activePoint && (
          <>
            <line
              className="is-cursor"
              x1={activePoint.x}
              y1="3"
              x2={activePoint.x}
              y2="51"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="3" />
          </>
        )}
      </svg>
      {activeSample && (
        <div
          className="premium-probe-chart-tooltip"
          style={{ left: `${tooltipLeft}%` }}
        >
          <span>{activeSample.label}</span>
          <strong>{activeSample.formatted}</strong>
        </div>
      )}
    </div>
  );
}

function DailyTrafficTrend({ servers }: { servers: ProbeServer[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [visibleDays, setVisibleDays] = useState(7);
  const allDays = useMemo(() => {
    const totals = new Map<
      string,
      { date: string; uplink: number; downlink: number; total: number }
    >();
    for (const server of servers) {
      for (const day of server.daily_traffic || []) {
        const current = totals.get(day.date) || {
          date: day.date,
          uplink: 0,
          downlink: 0,
          total: 0,
        };
        current.uplink += day.uplink || 0;
        current.downlink += day.downlink || 0;
        current.total += day.total || day.uplink + day.downlink;
        totals.set(day.date, current);
      }
    }
    return [...totals.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }, [servers]);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const count = Math.max(
        7,
        Math.min(18, Math.floor(entry.contentRect.width / 34)),
      );
      setVisibleDays(count);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const days = allDays.slice(-visibleDays);
  const latest = days[days.length - 1];
  const samples = days.map((day, index) => ({
    label: index === days.length - 1 ? `今日 ${day.date}` : day.date,
    value: day.total,
    formatted: formatTrafficCompact(day.total),
  }));

  return (
    <div
      ref={container}
      className="premium-probe-overview-chart-card premium-probe-daily-trend"
    >
      <div className="premium-probe-overview-chart-heading">
        <span>原始上下行日流量趋势</span>
        <strong>
          今日 {latest ? formatTrafficCompact(latest.total) : "—"}
        </strong>
      </div>
      <InteractiveTrend samples={samples} />
      <div className="premium-probe-speed-meta">
        <small>{days[0]?.date.slice(5) || "暂无历史"}</small>
        <small>
          {latest ? `今日 ${latest.date.slice(5)} · ${days.length} 天` : ""}
        </small>
      </div>
    </div>
  );
}

function TrafficHotspots({ servers }: { servers: ProbeServer[] }) {
  const ranked = servers
    .map((server, index) => ({
      server,
      index,
      speed: (server.download_speed || 0) + (server.upload_speed || 0),
    }))
    .sort((left, right) => right.speed - left.speed);
  const total = ranked.reduce((sum, row) => sum + row.speed, 0);
  const rows = ranked.slice(0, 5);

  return (
    <div className="premium-probe-overview-chart-card premium-probe-hotspots">
      <div className="premium-probe-overview-chart-heading">
        <span>实时流量热点</span>
        <strong>{formatBitSpeed(total)}</strong>
      </div>
      <div className="premium-probe-hotspot-list">
        {rows.map((row) => {
          const share = total > 0 ? (row.speed / total) * 100 : 0;
          return (
            <div key={`${row.server.name || "server"}-${row.index}`}>
              <Twemoji>{row.server.name || `#${row.index + 1}`}</Twemoji>
              <i>
                <b style={{ width: `${share}%` }} />
              </i>
              <strong>{share.toFixed(0)}%</strong>
            </div>
          );
        })}
      </div>
      <div className="premium-probe-speed-meta">
        <small>当前上下行带宽贡献</small>
        <small>TOP {rows.length}</small>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="premium-probe-resource">
      <span>{label}</span>
      <strong>{value}</strong>
      <i>
        <b style={{ width: `${percent ?? 0}%` }} />
      </i>
    </div>
  );
}

function pingTargetID(series: ProbePingSeries): string {
  return series.key?.trim() || `${series.label}|${series.isp || ""}`;
}

function aggregatePingBuckets(series: ProbePingSeries[]) {
  const count = Math.max(0, ...series.map((item) => item.buckets.length));
  return Array.from({ length: count }, (_, index) => {
    const latency: number[] = [];
    const loss: number[] = [];
    for (const item of series) {
      const offset = count - item.buckets.length;
      const bucket = item.buckets[index - offset];
      if (!bucket) continue;
      if (bucket.ms >= 0) latency.push(bucket.ms);
      if (bucket.loss >= 0) loss.push(bucket.loss);
    }
    return {
      ms: latency.length
        ? latency.reduce((total, value) => total + value, 0) / latency.length
        : undefined,
      loss: loss.length
        ? loss.reduce((total, value) => total + value, 0) / loss.length
        : undefined,
    };
  });
}

const probeLineColors = [
  "#f1cb70",
  "#72cf72",
  "#67b7dc",
  "#e47b83",
  "#b58ae4",
  "#e79c55",
  "#63c7b2",
  "#d7d06d",
  "#d982bd",
  "#91a7e8",
];

function MultiTargetLatencyChart({
  series,
  bucketSec,
  generatedAt,
}: {
  series: ProbePingSeries[];
  bucketSec: number;
  generatedAt: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number>();
  const width = 420;
  const height = 84;
  const baseline = height - 8;
  const count = Math.max(0, ...series.map((item) => item.buckets.length));
  const values = series.flatMap((item) =>
    item.buckets.map((bucket) => bucket.ms).filter((value) => value >= 0),
  );
  const ceiling = Math.max(100, ...values) * 1.08;
  const paths = series.map((item) => {
    const offset = count - item.buckets.length;
    let open = false;
    const commands: string[] = [];
    for (let index = 0; index < count; index++) {
      const bucket = item.buckets[index - offset];
      if (!bucket || bucket.ms < 0) {
        open = false;
        continue;
      }
      const x = count <= 1 ? width : (index / (count - 1)) * width;
      const y =
        baseline - (Math.min(ceiling, bucket.ms) / ceiling) * (height - 18);
      commands.push(`${open ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`);
      open = true;
    }
    return commands.join(" ");
  });
  const cursorX =
    activeIndex === undefined || count <= 1
      ? undefined
      : (activeIndex / (count - 1)) * width;
  const end = generatedAt - (generatedAt % bucketSec);
  const activeTimestamp =
    activeIndex === undefined
      ? undefined
      : end - (count - 1 - activeIndex) * bucketSec;
  const activeValues =
    activeIndex === undefined
      ? []
      : series.flatMap((item, seriesIndex) => {
          const offset = count - item.buckets.length;
          const bucket = item.buckets[activeIndex - offset];
          return bucket && bucket.ms >= 0
            ? [
                {
                  item,
                  bucket,
                  color: probeLineColors[seriesIndex % probeLineColors.length],
                },
              ]
            : [];
        });

  return (
    <div
      className="premium-probe-multi-target-chart"
      onPointerMove={(event) => {
        if (!count) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width),
        );
        setActiveIndex(Math.round(ratio * (count - 1)));
      }}
      onPointerLeave={() => setActiveIndex(undefined)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          className="is-baseline"
          x1="0"
          y1={baseline}
          x2={width}
          y2={baseline}
        />
        {paths.map((path, index) => (
          <path
            key={series[index].key || `${series[index].label}-${index}`}
            d={path}
            style={{ stroke: probeLineColors[index % probeLineColors.length] }}
          />
        ))}
        {cursorX !== undefined && (
          <line
            className="is-cursor"
            x1={cursorX}
            y1="3"
            x2={cursorX}
            y2={baseline}
          />
        )}
      </svg>
      {activeTimestamp !== undefined && (
        <div
          className="premium-probe-multi-tooltip"
          style={{
            left: `${Math.max(12, Math.min(88, ((cursorX || 0) / width) * 100))}%`,
          }}
        >
          <time>{formatAxisDateTime(activeTimestamp)}</time>
          {activeValues.length ? (
            activeValues.map(({ item, bucket, color }) => (
              <span key={item.key || item.label}>
                <i style={{ background: color }} />
                <b>{item.label}</b>
                <strong>{bucket.ms} ms</strong>
                <small>丢包 {bucket.loss.toFixed(1)}%</small>
              </span>
            ))
          ) : (
            <small>该时间桶暂无数据</small>
          )}
        </div>
      )}
    </div>
  );
}

// ---- 转发链视图(网络状况 → 转发链) ----
// 转发链数据类型定义在 ./types(随 ProbePayload.forward 走 WS 下发)。

type ForwardPayload = {
  enabled: boolean;
  chains: ForwardChainData[];
  generated_at: number;
};

const forwardRoleLabel: Record<string, string> = {
  entry: "入口",
  mid: "中转",
  exit: "出口",
};

function forwardLatencyClass(ms: number): string {
  if (ms <= 0) return "is-idle";
  if (ms < 80) return "is-good";
  if (ms < 160) return "is-ok";
  return "is-hi";
}

function ForwardModeToggle({
  mode,
  onChange,
}: {
  mode: "server" | "forward";
  onChange: (next: "server" | "forward") => void;
}) {
  return (
    <div className="premium-probe-forward-modes">
      <button
        type="button"
        className={mode === "server" ? "is-active" : undefined}
        onClick={() => onChange("server")}
      >
        <Server />
        按服务器
      </button>
      <button
        type="button"
        className={mode === "forward" ? "is-active" : undefined}
        onClick={() => onChange("forward")}
      >
        <Radio />
        转发链
      </button>
    </div>
  );
}

function ForwardTrendChart({ trend }: { trend: ForwardChainBucket[] }) {
  if (trend.length < 2) {
    return (
      <div className="premium-probe-forward-trend-empty">暂无趋势数据</div>
    );
  }
  const W = 900;
  const H = 130;
  const padT = 10;
  const padB = 14;
  const values = trend.map((point) => point.e2e_ms);
  const max = Math.max(...values) * 1.12 || 1;
  const xScale = (index: number) => (W * index) / Math.max(1, trend.length - 1);
  const yScale = (value: number) =>
    padT + (H - padT - padB) * (1 - value / max);
  const line = trend
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${xScale(index).toFixed(1)} ${yScale(point.e2e_ms).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${xScale(trend.length - 1).toFixed(1)} ${H - padB} L0 ${H - padB} Z`;
  return (
    <svg
      className="premium-probe-forward-trend"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fwdTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--pp-gold)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--pp-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fwdTrendFill)" />
      <path d={line} fill="none" stroke="var(--pp-gold)" strokeWidth="2.4" />
      <circle
        cx={xScale(trend.length - 1)}
        cy={yScale(values[values.length - 1])}
        r="3.5"
        fill="var(--pp-gold)"
      />
    </svg>
  );
}

const forwardTrafficFmt = (gb: number) =>
  gb >= 1024
    ? `${(gb / 1024).toFixed(2)} TB`
    : gb >= 10
      ? `${Math.round(gb)} GB`
      : gb > 0
        ? `${gb.toFixed(1)} GB`
        : "0 GB";

// 转发组流量:堆叠柱状图。周期常为 1 个月,横向表格放不下,改为按转发组切换的堆叠柱状图
// (每天一根柱,组内多台服务器堆叠),并显示所选组的周期总流量。
function ForwardTrafficChart({ traffic }: { traffic: ForwardChainTraffic }) {
  const groups = useMemo(() => {
    const list: {
      group: string;
      role: string;
      servers: ForwardTrafficServer[];
      total: number;
    }[] = [];
    for (const srv of traffic.servers) {
      let bucket = list.find((entry) => entry.group === srv.group);
      if (!bucket) {
        bucket = { group: srv.group, role: srv.role, servers: [], total: 0 };
        list.push(bucket);
      }
      bucket.servers.push(srv);
      bucket.total += srv.total_gb;
    }
    return list;
  }, [traffic]);

  const [tab, setTab] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const activeIdx = Math.min(tab, Math.max(0, groups.length - 1));
  const active = groups[activeIdx];
  const days = traffic.days;

  const palette = [
    "var(--pp-gold)",
    "#d8a84a",
    "#b9822a",
    "#e7c67e",
    "#9c6f22",
    "#f0d79a",
  ];
  const dayTotal = useMemo(
    () =>
      days.map((_, i) =>
        (active?.servers || []).reduce(
          (s, srv) => s + (srv.daily_gb[i] || 0),
          0,
        ),
      ),
    [days, active],
  );
  const max = Math.max(1e-9, ...dayTotal);

  if (!active) return null;

  const W = 900;
  const H = 200;
  const padT = 8;
  const padB = 6;
  const n = days.length;
  const slot = W / Math.max(1, n);
  const barW = Math.min(30, slot * 0.6);
  const plotH = H - padT - padB;
  const labelStep = n <= 12 ? 1 : Math.ceil(n / 8);

  return (
    <div className="premium-probe-forward-chart-wrap">
      <div className="premium-probe-forward-grouptabs">
        {groups.map((g, i) => (
          <button
            key={g.group}
            type="button"
            className={i === activeIdx ? "is-active" : undefined}
            onClick={() => setTab(i)}
          >
            <span className="g">{g.group}</span>
            <span className={`rl is-${g.role}`}>
              {forwardRoleLabel[g.role] || g.role}
            </span>
            <span className="t">{forwardTrafficFmt(g.total)}</span>
          </button>
        ))}
      </div>

      <div className="premium-probe-forward-chart-head">
        {hover != null && days[hover] ? (
          <>
            <span className="d">{days[hover].slice(5)}</span>
            {active.servers.map((srv, si) => (
              <span className="s" key={srv.name}>
                <i style={{ background: palette[si % palette.length] }} />
                <Twemoji>{srv.name}</Twemoji>
                <b>{forwardTrafficFmt(srv.daily_gb[hover] || 0)}</b>
              </span>
            ))}
            <span className="sum">
              合计 {forwardTrafficFmt(dayTotal[hover])}
            </span>
          </>
        ) : (
          <span className="total">
            {active.group} · 周期总流量 <b>{forwardTrafficFmt(active.total)}</b>
          </span>
        )}
      </div>

      <div className="premium-probe-forward-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {days.map((day, i) => {
            let acc = 0;
            return (
              <g
                key={day}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={slot * i}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                />
                {active.servers.map((srv, si) => {
                  const v = srv.daily_gb[i] || 0;
                  if (v <= 0) return null;
                  const h = plotH * (v / max);
                  const y = padT + plotH * (1 - (acc + v) / max);
                  acc += v;
                  return (
                    <rect
                      key={srv.name}
                      x={slot * i + (slot - barW) / 2}
                      y={y}
                      width={barW}
                      height={Math.max(0.6, h)}
                      rx={1.5}
                      fill={palette[si % palette.length]}
                      opacity={hover == null || hover === i ? 1 : 0.32}
                    />
                  );
                })}
              </g>
            );
          })}
          <line
            x1="0"
            y1={H - padB}
            x2={W}
            y2={H - padB}
            stroke="var(--pp-border)"
            strokeWidth="1"
          />
        </svg>
        <div className="premium-probe-forward-chart-xaxis">
          {days.map((day, i) => (
            <span key={day}>{i % labelStep === 0 ? day.slice(5) : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const routePolicyLabel: Record<string, string> = {
  lowest_latency: "最低延迟优先",
  failover: "按顺序故障转移",
  weighted: "按权重分流",
};

/** 选路段:分叉那组到下一组之间并行的几条路,标出在用的那条 */
function ForwardRoutes({ chain }: { chain: ForwardChainData }) {
  const routes = chain.routes ?? [];
  return (
    <div className="rroutes">
      <div className="rr-h">
        选路 ·{" "}
        {routePolicyLabel[chain.route_policy ?? ""] ?? chain.route_policy}
        {chain.failover_ms ? ` · 故障转移 ${chain.failover_ms}ms` : ""}
      </div>
      {routes.map((r) => (
        <div
          key={r.name}
          className={cn("rr", r.selected && "is-on")}
          title={
            r.selected_by?.length
              ? `正在走:${r.selected_by.join("、")}`
              : undefined
          }
        >
          <span className="rn">{r.name}</span>
          <span className="rv">
            {r.via.length ? `经 ${r.via.join(" → ")}` : "直连"}
          </span>
          <span className={cn("rl", forwardLatencyClass(r.latency_ms))}>
            {r.latency_ms > 0 ? `${r.latency_ms} ms` : "—"}
          </span>
          {r.loss_pct > 0 && <span className="rlo">丢 {r.loss_pct}%</span>}
          {r.selected && <span className="ron">在用</span>}
        </div>
      ))}
    </div>
  );
}

const forwardCellLabel: Record<string, string> = {
  o: "正常",
  d: "降级",
  b: "中断",
  n: "无数据",
};
const FORWARD_CELL_MIN = 20;

// 第 ago 格之前(0 = 当前这一格)。只按格子位置算,不读时钟:渲染要保持纯函数
const forwardCellAgo = (ago: number) => {
  if (ago <= 0) return "当前";
  const min = ago * FORWARD_CELL_MIN;
  const h = Math.floor(min / 60);
  return `约 ${h ? `${h} 小时` : ""}${h && min % 60 ? " " : ""}${min % 60 ? `${min % 60} 分钟` : ""}前`;
};

/** 可用率 + 近 24 小时状态条(20 分钟一格,最后一格 = 当前) */
function ForwardAvailability({ chain }: { chain: ForwardChainData }) {
  const cells = chain.cells ?? "";
  const avail = chain.availability_24h;
  // 没采过样的链(全是无数据、也没有可用率)不占位置
  if ((avail === undefined || avail === null) && !/[odb]/.test(cells))
    return null;
  return (
    <div className="premium-probe-forward-avail">
      <div className="head">
        <span className="k">可用率 · 近 24 小时</span>
        <span className="v">
          {avail === undefined || avail === null
            ? "—"
            : avail >= 1
              ? "100"
              : (avail * 100).toFixed(2)}
          <span className="u">%</span>
        </span>
      </div>
      {cells && (
        <div className="bar" role="img" aria-label="近 24 小时状态">
          {[...cells].map((ch, i) => (
            <i
              key={i}
              className={`is-${forwardCellLabel[ch] ? ch : "n"}`}
              title={`${forwardCellAgo(cells.length - 1 - i)} · ${forwardCellLabel[ch] ?? forwardCellLabel.n}`}
            />
          ))}
        </div>
      )}
      <div className="axis">
        <span>24 小时前</span>
        <span className="lg">
          {Object.entries(forwardCellLabel).map(([ch, label]) => (
            <span key={ch}>
              <i className={`is-${ch}`} />
              {label}
            </span>
          ))}
        </span>
        <span>现在</span>
      </div>
    </div>
  );
}

function ForwardChainView({ wsChains }: { wsChains?: ForwardChainData[] }) {
  // 优先用 WS payload 下发的转发链数据(实时);未走 WS 才拉 /api/forward 兜底。
  const hasWS = wsChains !== undefined;
  const [data, setData] = useState<ForwardPayload | undefined>();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [chainIdx, setChainIdx] = useState(0);
  useEffect(() => {
    if (hasWS) return; // WS 有数据就不走 HTTP 轮询
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/forward", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData(await response.json());
        setStatus("ok");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatus("error");
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [hasWS]);

  const chains = hasWS ? wsChains : data?.chains || [];
  const activeIdx = Math.min(chainIdx, Math.max(0, chains.length - 1));
  const chain = chains[activeIdx];

  if (!hasWS && status === "loading" && !data) {
    return <div className="premium-probe-forward-empty">加载转发链数据…</div>;
  }
  if (!chain) {
    return (
      <div className="premium-probe-forward-empty">
        暂无转发链数据（需已配置转发链并运行探测采集）
      </div>
    );
  }

  const nodeCount = chain.groups.reduce((n, g) => n + g.servers.length, 0);
  const roleTally = chain.groups.reduce(
    (acc, g) => {
      acc[g.role] = (acc[g.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalGB = chain.traffic?.total_gb || 0;
  const trafficStat =
    totalGB >= 1024
      ? { value: (totalGB / 1024).toFixed(1), unit: "TB" }
      : { value: Math.round(totalGB).toString(), unit: "GB" };

  return (
    <div className="premium-probe-forward">
      {chains.length > 1 && (
        <div className="premium-probe-forward-chainbar">
          <Radio />
          <span className="k">转发链</span>
          <div className="premium-probe-forward-chaintabs">
            {chains.map((item, index) => (
              <button
                key={item.name}
                type="button"
                className={index === activeIdx ? "is-active" : undefined}
                onClick={() => setChainIdx(index)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="premium-probe-forward-stats">
        <div className="stat is-gold">
          <div className="k">端到端延迟</div>
          <div className="v">
            {chain.end_to_end_ms}
            <span className="u">ms</span>
          </div>
          <div className="foot">
            {chain.routes?.length
              ? "入口 → 出口 · 按在用的路"
              : "入口 → 出口 · 各组均值之和"}
          </div>
        </div>
        <div className="stat is-ok">
          <div className="k">平均丢包</div>
          <div className="v">
            {chain.loss_pct.toFixed(1)}
            <span className="u">%</span>
          </div>
          <div className="foot">
            {chain.jitter_ms !== undefined && chain.jitter_ms !== null
              ? `抖动 ${chain.jitter_ms < 10 ? chain.jitter_ms.toFixed(1) : Math.round(chain.jitter_ms)} ms · `
              : ""}
            全链探测点均值
          </div>
        </div>
        <div className="stat is-n">
          <div className="k">链路结构</div>
          <div className="v">
            {chain.groups.length}
            <span className="u">组</span> · {nodeCount}
            <span className="u">节点</span>
          </div>
          <div className="foot">
            入口 {roleTally.entry || 0} · 中转 {roleTally.mid || 0} · 出口{" "}
            {roleTally.exit || 0}
            {chain.routes?.length ? ` · 选路 ${chain.routes.length} 条` : ""}
          </div>
        </div>
        <div className="stat is-gold">
          <div className="k">周期总流量</div>
          <div className="v">
            {trafficStat.value}
            <span className="u">{trafficStat.unit}</span>
          </div>
          <div className="foot">近 7 天全链累计</div>
        </div>
      </div>

      <ForwardAvailability chain={chain} />

      <section className="premium-probe-forward-card">
        <header>
          <h3>
            <Activity />
            转发链探测详情
          </h3>
          <span>入口 → 出口 端到端延迟检测 · 5 分钟一个数据桶</span>
        </header>
        <div className="body">
          <div className="ribbon">
            {chain.groups.map((group, index) => (
              <Fragment key={group.name}>
                <div className={`rnode is-${group.role}`}>
                  <span className="role">{forwardRoleLabel[group.role]}组</span>
                  <span className="gname">{group.name}</span>
                  <span className="gmeta">{group.servers.length} 节点</span>
                </div>
                {index < chain.groups.length - 1 &&
                  (chain.routes?.length && chain.route_hop === index ? (
                    <ForwardRoutes chain={chain} />
                  ) : (
                    <div className="rlink">
                      <span className="lat">{group.to_next_ms} ms</span>
                      <span className="arw" />
                      <span className="lbl">→ 下一组</span>
                    </div>
                  ))}
              </Fragment>
            ))}
          </div>
          <ForwardTrendChart trend={chain.trend} />
        </div>
      </section>

      <section className="premium-probe-forward-card">
        <header>
          <h3>
            <Target />
            转发组延迟详情
          </h3>
          <span>组间延迟 · 组内每台服务器到下一组的延迟</span>
        </header>
        <div className="body">
          <div className="topo">
            {chain.groups.map((group, index) => (
              <Fragment key={group.name}>
                <div className="grp">
                  <div className="grp-h">
                    <span className="nm">{group.name}</span>
                    <span className={`rl is-${group.role}`}>
                      {forwardRoleLabel[group.role]}
                    </span>
                  </div>
                  <div className="grp-agg">
                    本组 → {group.role === "exit" ? "落地目标" : "下一组"}&nbsp;
                    <b>{group.to_next_ms} ms</b>
                  </div>
                  {group.servers.map((srv) => (
                    <div className="srv" key={srv.name}>
                      <span
                        className={`dot ${srv.healthy ? "is-up" : "is-down"}`}
                      />
                      <span className="sn">
                        <Twemoji>{srv.name}</Twemoji>
                        {srv.route && <span className="srt">{srv.route}</span>}
                      </span>
                      {(srv.loss_pct ?? 0) > 0 && (
                        <span className="sloss">丢 {srv.loss_pct}%</span>
                      )}
                      <span
                        className={`slat ${forwardLatencyClass(srv.to_next_ms)}`}
                      >
                        {srv.to_next_ms > 0 ? `${srv.to_next_ms} ms` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                {index < chain.groups.length - 1 &&
                  (chain.routes?.length && chain.route_hop === index ? (
                    <ForwardRoutes chain={chain} />
                  ) : (
                    <div className="tconn">
                      <span className="cl">组间</span>
                      <span className="cv">{group.to_next_ms} ms</span>
                      <span className="cline" />
                    </div>
                  ))}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {chain.traffic && chain.traffic.servers.length > 0 && (
        <section className="premium-probe-forward-card">
          <header>
            <h3>
              <Gauge />
              转发组流量详情
            </h3>
            <span>周期内每日 · 按转发组切换 · 组内每台服务器堆叠</span>
          </header>
          <div className="body">
            <ForwardTrafficChart traffic={chain.traffic} />
          </div>
        </section>
      )}
    </div>
  );
}

function PremiumNetworkView({
  servers,
  forwardChains,
  triISP,
  historyDays,
}: {
  servers: ProbeServer[];
  forwardChains?: ForwardChainData[];
  triISP?: TriISPPublic;
  historyDays?: number;
}) {
  const [netMode, setNetMode] = useState<"server" | "forward">("server");
  const [serverIndex, setServerIndex] = useState(0);
  const [target, setTarget] = useState("__all__");
  const [visibleTargets, setVisibleTargets] = useState<string[]>([]);
  const rangeOptions = probeRangeOptions(historyDays);
  const [pickedRange, setRange] = useState("1h");
  const range = effectiveProbeRange(pickedRange, rangeOptions);
  const selectedServerIndex = Math.min(
    serverIndex,
    Math.max(0, servers.length - 1),
  );
  const selectedServer = servers[selectedServerIndex];
  const targets = useMemo(() => {
    const result = new Map<
      string,
      { id: string; label: string; isp?: string }
    >();
    if (selectedServer) {
      for (const series of selectedServer.ping || []) {
        const id = pingTargetID(series);
        if (!result.has(id)) {
          result.set(id, { id, label: series.label, isp: series.isp });
        }
      }
    }
    return [...result.values()].sort((left, right) =>
      left.label.localeCompare(right.label, "zh-CN"),
    );
  }, [selectedServer]);
  const selectedTarget =
    target === "__all__" ||
    target === "__custom__" ||
    targets.some((item) => item.id === target)
      ? target
      : "__all__";
  const [detail, setDetail] = useState<{
    success: boolean;
    series: ProbePingSeries;
    all_series?: ProbePingSeries[];
    bucket_sec: number;
    generated_at: number;
  }>();
  useEffect(() => {
    if (!selectedServer) {
      setDetail(undefined);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({
          server: String(selectedServerIndex),
          target: "__avg__",
          all: "1",
          range,
        });
        const response = await fetch(`/api/series?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setDetail(await response.json());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDetail(undefined);
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [range, selectedServer, selectedServerIndex]);
  const rows = selectedServer
    ? [selectedServer].map((server) => {
        const series = server.ping || [];
        const effectiveSeries = detail?.success ? [detail.series] : series;
        const currentLatency = effectiveSeries
          .map((item) => item.current_ms)
          .filter((value) => value >= 0);
        const currentLoss = effectiveSeries
          .map((item) => item.loss_pct)
          .filter((value) => value >= 0);
        return {
          server,
          index: selectedServerIndex,
          series: effectiveSeries,
          buckets: detail?.success
            ? aggregatePingBuckets([detail.series])
            : aggregatePingBuckets(series),
          latency: currentLatency.length
            ? Math.round(
                currentLatency.reduce((total, value) => total + value, 0) /
                  currentLatency.length,
              )
            : undefined,
          loss: currentLoss.length
            ? currentLoss.reduce((total, value) => total + value, 0) /
              currentLoss.length
            : undefined,
        };
      })
    : [];
  const chartSeries = detail?.success
    ? [
        { ...detail.series, key: "__avg__", label: "全部目标平均" },
        ...(detail.all_series || []),
      ]
    : [];
  const allChartTargetKeys = chartSeries.map(
    (item) => item.key || pingTargetID(item),
  );
  const effectiveVisibleTargets =
    selectedTarget === "__all__" ? allChartTargetKeys : visibleTargets;
  const visibleChartSeries = chartSeries.filter((item) =>
    effectiveVisibleTargets.includes(item.key || pingTargetID(item)),
  );
  const measuredRows = rows.filter((row) => row.series.length > 0);
  const reachableRows = measuredRows.filter(
    (row) => row.latency !== undefined && row.loss !== undefined,
  );
  const averageMs = reachableRows.length
    ? Math.round(
        reachableRows.reduce((total, row) => total + (row.latency || 0), 0) /
          reachableRows.length,
      )
    : undefined;
  const averageLoss = reachableRows.length
    ? reachableRows.reduce((total, row) => total + (row.loss || 0), 0) /
      reachableRows.length
    : undefined;
  const detailBuckets = detail?.success
    ? detail.series.buckets.map((bucket, index, buckets) => {
        const end =
          detail.generated_at - (detail.generated_at % detail.bucket_sec);
        const timestamp =
          end - (buckets.length - 1 - index) * detail.bucket_sec;
        return { ...bucket, timestamp };
      })
    : [];

  if (netMode === "forward") {
    return (
      <section className="premium-probe-network-view">
        <div className="premium-probe-network-view-heading">
          <div>
            <h2>
              <Activity /> 网络状况
            </h2>
            <span>按转发链查看入口到出口的端到端探测、逐组延迟与流量</span>
          </div>
          <ForwardModeToggle mode={netMode} onChange={setNetMode} />
        </div>
        <ForwardChainView wsChains={forwardChains} />
      </section>
    );
  }

  return (
    <section className="premium-probe-network-view">
      <div className="premium-probe-network-view-heading">
        <div>
          <h2>
            <Activity /> 网络状况
          </h2>
          <span>按服务器与其独立探测目标查看真实时间序列</span>
        </div>
        <ForwardModeToggle mode={netMode} onChange={setNetMode} />
        <div className="premium-probe-network-selectors">
          <label>
            <Server />
            <span>服务器</span>
            <select
              value={selectedServerIndex}
              onChange={(event) => {
                setServerIndex(Number(event.target.value));
                setTarget("__all__");
                setVisibleTargets([]);
              }}
            >
              {servers.map((server, index) => (
                <option value={index} key={index}>
                  {server.name || `#${index + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Target />
            <span>探测目标</span>
            <select
              value={selectedTarget}
              onChange={(event) => {
                const value = event.target.value;
                setTarget(value);
                setVisibleTargets(value === "__all__" ? [] : [value]);
              }}
            >
              <option value="__avg__">仅显示全部目标平均</option>
              <option value="__all__">显示所有探测目标</option>
              {selectedTarget === "__custom__" && (
                <option value="__custom__">自定义目标组合</option>
              )}
              {targets.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                  {item.isp ? ` · ${item.isp}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="premium-probe-network-kpis">
        {[
          {
            label: "平均延迟",
            value: averageMs === undefined ? "—" : `${averageMs} ms`,
            hint: "所选服务器与目标",
          },
          {
            label: "平均丢包",
            value:
              averageLoss === undefined ? "—" : `${averageLoss.toFixed(2)}%`,
            hint: "所选服务器与目标",
          },
          {
            label: "时间范围",
            value: rangeOptions.find((item) => item.key === range)?.label ?? "",
            hint: detail?.bucket_sec
              ? detail.bucket_sec >= 3600
                ? `${detail.bucket_sec / 3600} 小时一个数据桶`
                : `${detail.bucket_sec / 60} 分钟一个数据桶`
              : "等待详细数据",
          },
          {
            label: "探测目标",
            value: String(targets.length),
            hint: "当前服务器配置",
          },
        ].map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </div>

      <article className="premium-probe-network-matrix">
        <header>
          <div>
            <Radio />
            <h3>服务器探测详情</h3>
          </div>
          <div className="premium-probe-network-ranges">
            {rangeOptions.map((item) => (
              <button
                type="button"
                key={item.key}
                className={range === item.key ? "is-active" : undefined}
                onClick={() => setRange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <div className="premium-probe-target-toolbar">
          <div>
            {chartSeries.map((item, index) => {
              const key = item.key || pingTargetID(item);
              const active = effectiveVisibleTargets.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={active ? "is-active" : undefined}
                  onClick={() => {
                    setTarget("__custom__");
                    setVisibleTargets((current) => {
                      const base =
                        selectedTarget === "__all__"
                          ? allChartTargetKeys
                          : current;
                      return base.includes(key)
                        ? base.filter((item) => item !== key)
                        : [...base, key];
                    });
                  }}
                  title={active ? "点击隐藏该目标" : "点击显示该目标"}
                >
                  <i
                    style={{
                      background:
                        probeLineColors[index % probeLineColors.length],
                    }}
                  />
                  {item.label}
                  {item.isp ? ` · ${item.isp}` : ""}
                </button>
              );
            })}
          </div>
          <span>
            <button
              type="button"
              onClick={() => {
                setTarget("__all__");
                setVisibleTargets([]);
              }}
            >
              全部显示
            </button>
            <button
              type="button"
              onClick={() => {
                setTarget("__avg__");
                setVisibleTargets(["__avg__"]);
              }}
            >
              仅平均
            </button>
          </span>
        </div>
        <div className="premium-probe-network-table-head">
          <span>服务器</span>
          <span>当前延迟</span>
          <span>丢包率</span>
          <span>真实延迟趋势 / 丢包时间轴</span>
        </div>
        <div className="premium-probe-network-rows">
          {rows.length === 0 && (
            <div className="premium-probe-network-empty">
              暂无可展示的服务器
            </div>
          )}
          {rows.map((row) => {
            const quality =
              row.latency === undefined || row.loss === undefined
                ? "missing"
                : row.loss >= 10 || row.latency >= 250
                  ? "poor"
                  : row.loss >= 3 || row.latency >= 120
                    ? "medium"
                    : "good";
            const flag =
              countryFlag(serverRegionKey(row.server)) ||
              row.server.region ||
              "";
            // 三网行按 key 从本机实测序列里取,匹配不到的槽位照样成行画「—」。
            const triRows = triISPRows(triISP, row.server.ping || []);
            return (
              <div className="premium-probe-network-row" key={`${row.index}`}>
                <div className="premium-probe-network-server">
                  <i data-level={quality} />
                  <span>
                    <strong>
                      <Twemoji>
                        {displayServerName(
                          row.server.name,
                          `#${row.index + 1}`,
                          flag,
                        )}
                      </Twemoji>
                    </strong>
                    <small>
                      <Twemoji>{localizedRegionLabel(row.server)}</Twemoji>
                    </small>
                  </span>
                </div>
                {triRows.length > 0 ? (
                  <>
                    {/* 三网模式:两个数值格各堆三行。刻意不改 grid-template-columns ——
                        那四列宽度是按「服务器 | 延迟 | 丢包 | 图表」调过的,合并格子会让
                        表头对不上;两侧都是三行等高,列自然仍然对齐。 */}
                    <div className="premium-probe-network-tri">
                      {triRows.map((tri) => (
                        <span key={tri.isp}>
                          <small>{tri.label}</small>
                          <strong data-level={quality}>
                            {!tri.series
                              ? "—"
                              : tri.series.current_ms < 0
                                ? "不可达"
                                : `${tri.series.current_ms} ms`}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <div className="premium-probe-network-tri">
                      {triRows.map((tri) => (
                        <span key={tri.isp}>
                          <strong data-level={quality}>
                            {!tri.series
                              ? "—"
                              : `${tri.series.loss_pct.toFixed(1)}%`}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <strong data-level={quality}>
                      {row.latency === undefined ? "—" : `${row.latency} ms`}
                    </strong>
                    <strong data-level={quality}>
                      {row.loss === undefined ? "—" : `${row.loss.toFixed(1)}%`}
                    </strong>
                  </>
                )}
                <div className="premium-probe-network-chart">
                  {visibleChartSeries.length && detail?.success ? (
                    <MultiTargetLatencyChart
                      series={visibleChartSeries}
                      bucketSec={detail.bucket_sec}
                      generatedAt={detail.generated_at}
                    />
                  ) : (
                    <span>点击上方目标以显示延迟折线</span>
                  )}
                  <div className="premium-probe-network-loss">
                    {row.buckets.map((bucket, index) => (
                      <i
                        key={index}
                        title={
                          bucket.loss === undefined
                            ? "无数据"
                            : `丢包 ${bucket.loss.toFixed(1)}%${bucket.ms === undefined ? "" : ` · ${bucket.ms.toFixed(0)} ms`}`
                        }
                        style={{
                          height: `${Math.min(100, bucket.loss || 0)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="premium-probe-network-history">
          {detailBuckets.length === 0 ? (
            <p>暂无详细时间序列</p>
          ) : (
            detailBuckets.map((bucket) => (
              <div key={bucket.timestamp}>
                <time>{formatAxisDateTime(bucket.timestamp)}</time>
                <strong>{bucket.ms < 0 ? "不可达" : `${bucket.ms} ms`}</strong>
                <span>
                  {bucket.loss < 0
                    ? "无数据"
                    : `丢包 ${bucket.loss.toFixed(1)}%`}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

function PremiumServerCard({
  server,
  index,
  onOpen,
  showHealthScore,
}: {
  server: ProbeServer;
  index: number;
  onOpen: () => void;
  showHealthScore: boolean;
}) {
  const mem = resourcePercentage(server.mem_used, server.mem_total);
  const disk = resourcePercentage(server.disk_used, server.disk_total);
  const trafficUsed = billableTraffic(server) ?? server.traffic_used_up ?? 0;
  const trafficValue = server.traffic_limit
    ? `${formatTrafficCompact(trafficUsed)} / ${formatTrafficCompact(server.traffic_limit)}`
    : formatTrafficCompact(trafficUsed);
  const latency = averageLatency(server);
  const losses = (server.ping || [])
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0);
  const loss = losses.length
    ? losses.reduce((total, value) => total + value, 0) / losses.length
    : undefined;
  const code = serverRegionKey(server);
  const flag = countryFlag(code) || server.region || "";
  const health = serverHealth(server);
  const dailyTraffic = dailyTrafficRows(
    server,
    hasTrafficPeriod(server) ? "period" : "recent7",
  );
  const maxDailyTraffic = Math.max(
    1,
    ...dailyTraffic.map((day) => day.total || day.uplink + day.downlink),
  );
  const latencyBuckets = aggregatePingBuckets(server.ping || []);
  const latencySamples = latencyBuckets
    .map((bucket, bucketIndex): TrendSample | undefined => {
      if (bucket.ms === undefined) return undefined;
      const minutesAgo = (latencyBuckets.length - 1 - bucketIndex) * 5;
      return {
        label: minutesAgo === 0 ? "当前时间桶" : `${minutesAgo} 分钟前`,
        value: bucket.ms,
        formatted: `${bucket.ms.toFixed(0)} ms`,
      };
    })
    .filter((sample): sample is TrendSample => sample !== undefined);

  return (
    <article
      className="premium-probe-server-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <header>
        <h3>
          <Twemoji>
            {displayServerName(server.name, `#${index + 1}`, flag)}
          </Twemoji>
        </h3>
        {showHealthScore && (
          <span
            className="premium-probe-health-score"
            data-tone={health.tone}
            title={health.issues.join("、") || "运行状态正常"}
          >
            {health.score} · {health.label}
          </span>
        )}
        <ProviderLogo
          path={server.provider_logo}
          name={server.provider_name}
          url={server.provider_url}
          style={{ marginLeft: "auto" }}
        />
        {/* 状态本身靠 margin-left:auto 顶到右边;有 logo 时由 logo 顶,两个都 auto 会把 logo 挤到中间 */}
        <span
          className="premium-probe-server-status"
          style={providerLogoSrc(server.provider_logo) ? { marginLeft: 0 } : undefined}
        >
          <i
            className={cn(
              "premium-probe-live-dot",
              !server.online && "is-offline",
            )}
          />
          {server.online ? "在线" : "离线"}
          <ChevronRight />
        </span>
      </header>
      <div className="premium-probe-resource-grid">
        <MetricBar
          label="CPU"
          value={
            server.cpu_pct === undefined ? "—" : `${server.cpu_pct.toFixed(0)}%`
          }
          percent={server.cpu_pct}
        />
        <MetricBar
          label="内存"
          value={mem === undefined ? "—" : `${mem.toFixed(0)}%`}
          percent={mem}
        />
        <MetricBar
          label="硬盘"
          value={disk === undefined ? "—" : `${disk.toFixed(0)}%`}
          percent={disk}
        />
      </div>
      {/* 实时上下行(#1212):数据本来就随探针下发,卡片上一直没显示 */}
      <div className="premium-probe-card-speed" aria-label="实时上下行速度">
        <div title="实时上行">
          <ArrowUp />
          <span>上行</span>
          <strong>
            {server.online ? formatBitSpeed(server.upload_speed || 0) : "—"}
          </strong>
        </div>
        <div title="实时下行">
          <ArrowDown />
          <span>下行</span>
          <strong>
            {server.online ? formatBitSpeed(server.download_speed || 0) : "—"}
          </strong>
        </div>
      </div>
      <div className="premium-probe-server-footer">
        <div className="premium-probe-card-traffic">
          <span>{trafficUsageLabel(server)}</span>
          <strong>{trafficValue}</strong>
          <i aria-label="原始上下行每日流量柱状图">
            {dailyTraffic.map((day) => {
              const total = day.total || day.uplink + day.downlink;
              return (
                <b
                  key={day.date}
                  title={`${day.date} · ${formatTrafficCompact(total)}`}
                  style={{
                    height: `${Math.max(8, (total / maxDailyTraffic) * 100)}%`,
                  }}
                />
              );
            })}
          </i>
          <small
            title={`计费规则：${trafficRuleLabel(server)}；柱状图为原始上下行，不应用计费方向或对账调整`}
          >
            {hasTrafficPeriod(server) ? "周期" : "近 7 日"}原始趋势 ·{" "}
            {trafficRuleLabel(server)}
          </small>
        </div>
        <div className="premium-probe-card-latency">
          <span>当前延迟</span>
          <strong>{latency === undefined ? "—" : `${latency} ms`}</strong>
          <InteractiveTrend samples={latencySamples} compact showArea={false} />
          <small>
            {loss === undefined ? "暂无丢包数据" : `丢包 ${loss.toFixed(2)}%`}
          </small>
        </div>
      </div>
    </article>
  );
}

function ServerDetailDrawer({
  server,
  index,
  onClose,
  historyDays,
}: {
  server: ProbeServer;
  index: number;
  onClose: () => void;
  historyDays?: number;
}) {
  const health = serverHealth(server);
  const mem = resourcePercentage(server.mem_used, server.mem_total);
  const disk = resourcePercentage(server.disk_used, server.disk_total);
  const latency = averageLatency(server);
  const hasPeriod = hasTrafficPeriod(server);
  const [trafficRange, setTrafficRange] = useState<TrafficRange>(() =>
    hasPeriod ? "period" : "recent7",
  );
  const traffic = dailyTrafficRows(server, trafficRange).map((item) => ({
    ...item,
    total: item.total || item.uplink + item.downlink,
  }));
  const maxTraffic = Math.max(1, ...traffic.map((item) => item.total));
  const trafficUsed = billableTraffic(server);
  const currentBoot = bootTraffic(server);
  const formula = trafficFormulaLabel(server);
  const flag = countryFlag(serverRegionKey(server)) || server.region || "";
  // 连接数：1 小时用列表带的 conn_history，更长的范围按需向 /api/series?metric=system 取。
  const connRangeOptions = probeRangeOptions(historyDays);
  const [pickedConnRange, setConnRange] = useState("1h");
  const connRange = effectiveProbeRange(pickedConnRange, connRangeOptions);
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));
  const [connPayload, setConnPayload] = useState<{
    range: string;
    series?: {
      tcp_connections?: ProbeMetricPoint[];
      udp_connections?: ProbeMetricPoint[];
    };
    bucket_sec?: number;
    buckets?: number;
    generated_at?: number;
  } | null>(null);
  useEffect(() => {
    if (!server.conn_history || connRange === "1h") return;
    const controller = new AbortController();
    void fetch(`/api/series?server=${index}&metric=system&range=${connRange}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          success: boolean;
          series?: {
            tcp_connections?: ProbeMetricPoint[];
            udp_connections?: ProbeMetricPoint[];
          };
          bucket_sec?: number;
          buckets?: number;
          generated_at?: number;
        }>;
      })
      .then((body) =>
        setConnPayload(body.success ? { ...body, range: connRange } : null),
      )
      .catch(() => {
        if (!controller.signal.aborted) setConnPayload(null);
      });
    return () => controller.abort();
  }, [connRange, index, server.conn_history]);
  const connCurrent = connPayload?.range === connRange ? connPayload : null;
  const connSeries =
    connRange === "1h"
      ? undefined
      : connHistoryFromSeries(
          connCurrent?.series?.tcp_connections,
          connCurrent?.series?.udp_connections,
          connCurrent?.generated_at ?? openedAt,
          connCurrent?.bucket_sec ?? probeRangeBucketSec(connRange),
          connCurrent?.buckets ?? probeRangeBucketCount(connRange),
        );
  // 资源使用率（用户反馈没有 CPU / 内存 / 硬盘历史）：同一个 metric=system 序列，
  // 各自一套时间范围；1 小时也向接口取（列表不带资源历史）。
  const hasResources =
    typeof server.cpu_pct === "number" ||
    typeof mem === "number" ||
    typeof disk === "number";
  const [pickedResourceRange, setResourceRange] = useState("1h");
  const resourceRange = effectiveProbeRange(
    pickedResourceRange,
    connRangeOptions,
  );
  const [resourcePayload, setResourcePayload] = useState<{
    range: string;
    series?: ResourceSeriesInput;
    bucket_sec?: number;
    buckets?: number;
    generated_at?: number;
  } | null>(null);
  useEffect(() => {
    if (!hasResources) return;
    const controller = new AbortController();
    void fetch(
      `/api/series?server=${index}&metric=system&range=${resourceRange}`,
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
      .then((body) =>
        setResourcePayload(
          body.success ? { ...body, range: resourceRange } : null,
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted) setResourcePayload(null);
      });
    return () => controller.abort();
  }, [resourceRange, index, hasResources]);
  const resourceCurrent =
    resourcePayload?.range === resourceRange ? resourcePayload : null;
  const resourceSeries = resourceHistoryFromSeries(
    resourceCurrent?.series,
    resourceCurrent?.generated_at ?? openedAt,
    resourceCurrent?.bucket_sec ?? probeRangeBucketSec(resourceRange),
    resourceCurrent?.buckets ?? probeRangeBucketCount(resourceRange),
  );
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="premium-probe-drawer-layer" onMouseDown={onClose}>
      <aside
        className="premium-probe-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Twemoji>{localizedRegionLabel(server)}</Twemoji>
            <h2>
              <Twemoji>
                {displayServerName(server.name, `#${index + 1}`, flag)}
              </Twemoji>
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭详情">
            <X />
          </button>
        </header>
        <section className="premium-probe-drawer-health">
          <strong data-tone={health.tone}>{health.score}</strong>
          <div>
            <span>综合健康度 · {health.label}</span>
            <p>{health.issues.join("，") || "各项公开指标运行正常"}</p>
          </div>
        </section>
        <div className="premium-probe-drawer-metrics">
          {[
            ["CPU", server.cpu_pct],
            ["内存", mem],
            ["硬盘", disk],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                {typeof value === "number" ? `${value.toFixed(0)}%` : "—"}
              </strong>
            </div>
          ))}
          <div>
            <span>平均延迟</span>
            <strong>{latency === undefined ? "—" : `${latency} ms`}</strong>
          </div>
        </div>
        {hasResources && (
          <section className="premium-probe-drawer-section premium-probe-drawer-conns">
            <div className="premium-probe-traffic-heading">
              <h3>资源使用率</h3>
              <div role="group" aria-label="资源使用率时间范围">
                {connRangeOptions.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={resourceRange === item.key ? "is-active" : ""}
                    onClick={() => setResourceRange(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="premium-probe-drawer-conn-legend">
              <span>
                <ConnLegendDot kind="cpu" />
                CPU
              </span>
              <span>
                <ConnLegendDot kind="mem" />
                内存
              </span>
              <span>
                <ConnLegendDot kind="disk" />
                硬盘
              </span>
              <small>每个时间桶取均值</small>
            </p>
            <ResourceSparkline
              history={resourceSeries}
              labels={resourceSeries.times.map(formatAxisDateTime)}
              className="premium-probe-drawer-conn-chart"
            />
          </section>
        )}
        {server.conn_history && (
          <section className="premium-probe-drawer-section premium-probe-drawer-conns">
            <div className="premium-probe-traffic-heading">
              <h3 title={CONN_COUNT_HINT}>系统连接数</h3>
              <div role="group" aria-label="连接数时间范围">
                {connRangeOptions.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={connRange === item.key ? "is-active" : ""}
                    onClick={() => setConnRange(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="premium-probe-drawer-conn-legend">
              <span>
                <ConnLegendDot kind="tcp" />
                TCP {connCount(server.tcp_connections)}
              </span>
              <span>
                <ConnLegendDot kind="udp" />
                UDP {connCount(server.udp_connections)}
              </span>
              <small>整机连接 · 每个时间桶取均值</small>
            </p>
            <ConnSparkline
              history={connSeries ?? server.conn_history}
              labels={connSeries?.times.map(formatAxisDateTime)}
              className="premium-probe-drawer-conn-chart"
            />
          </section>
        )}
        <section className="premium-probe-drawer-section">
          <h3>流量统计口径</h3>
          <div className="premium-probe-traffic-accounting">
            <div>
              <span>{trafficUsageLabel(server)}</span>
              <strong>
                {trafficUsed === undefined
                  ? "—"
                  : server.traffic_limit
                    ? `${formatTrafficCompact(trafficUsed)} / ${formatTrafficCompact(server.traffic_limit)}`
                    : formatTrafficCompact(trafficUsed)}
              </strong>
            </div>
            <p>计费规则：{trafficRuleLabel(server)}</p>
            {formula && <p>计费用量 = {formula}</p>}
            {(server.traffic_used_up !== undefined ||
              server.traffic_used_down !== undefined) && (
              <p>
                原始周期 ↑ {formatTrafficCompact(server.traffic_used_up)} · ↓{" "}
                {formatTrafficCompact(server.traffic_used_down)}
              </p>
            )}
            {server.traffic_adjustment !== undefined &&
              server.traffic_adjustment !== 0 && (
                <p>
                  对账调整：{formatSignedTraffic(server.traffic_adjustment)}
                </p>
              )}
            {(currentBoot.uplink !== undefined ||
              currentBoot.downlink !== undefined) && (
              <p>
                本次开机网卡 ↑ {formatTrafficCompact(currentBoot.uplink)} · ↓{" "}
                {formatTrafficCompact(currentBoot.downlink)}
              </p>
            )}
            {server.period_start && server.period_end && (
              <p>
                计费周期：{server.period_start} — {server.period_end}
              </p>
            )}
          </div>
        </section>
        <section className="premium-probe-drawer-section">
          <div className="premium-probe-traffic-heading">
            <h3>原始上下行日流量</h3>
            <div role="group" aria-label="趋势范围">
              {hasPeriod && (
                <button
                  type="button"
                  className={trafficRange === "period" ? "is-active" : ""}
                  onClick={() => setTrafficRange("period")}
                >
                  当前周期
                </button>
              )}
              <button
                type="button"
                className={trafficRange === "recent7" ? "is-active" : ""}
                onClick={() => setTrafficRange("recent7")}
              >
                最近 7 日
              </button>
            </div>
          </div>
          <p className="premium-probe-traffic-note">
            以下为原始上、下行，不应用计费方向或对账调整。
          </p>
          <div className="premium-probe-drawer-traffic">
            {traffic.length === 0 ? (
              <p>暂无每日流量数据</p>
            ) : (
              traffic.map((item) => (
                <div key={item.date}>
                  <span>{item.date.slice(5)}</span>
                  <i>
                    <b
                      style={{
                        width: `${(item.downlink / maxTraffic) * 100}%`,
                      }}
                    />
                    <b
                      style={{ width: `${(item.uplink / maxTraffic) * 100}%` }}
                    />
                  </i>
                  <strong>{formatTrafficCompact(item.total)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="premium-probe-drawer-section">
          <h3>探测地址</h3>
          <div className="premium-probe-drawer-pings">
            {(server.ping || []).length === 0 ? (
              <p>暂无 Ping 探测数据</p>
            ) : (
              (server.ping || []).map((item) => (
                <div key={pingTargetID(item)}>
                  <span>
                    {item.label}
                    {item.isp ? ` · ${item.isp}` : ""}
                  </span>
                  <strong>
                    {item.current_ms < 0 ? "不可达" : `${item.current_ms} ms`}
                  </strong>
                  <small>丢包 {item.loss_pct.toFixed(1)}%</small>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="premium-probe-drawer-section">
          <h3>三网回程</h3>
          <div className="premium-probe-drawer-routes">
            {(server.return_routes || []).length === 0 ? (
              <p>暂无回程数据</p>
            ) : (
              (server.return_routes || []).map((item, routeIndex) => (
                <span key={`${item.carrier}-${routeIndex}`}>
                  <b>{displayReturnRoute(item.route_type)}</b>
                  <small>
                    {
                      { telecom: "电信", unicom: "联通", mobile: "移动" }[
                        item.carrier
                      ]
                    }
                  </small>
                </span>
              ))
            )}
          </div>
        </section>
        <section className="premium-probe-drawer-section">
          <h3>解锁检测</h3>
          {(server.unlocks || []).length === 0 ? (
            <div className="premium-probe-drawer-unlocks">
              <p>暂无解锁数据</p>
            </div>
          ) : (
            <UnlockTabbedList
              unlocks={server.unlocks!}
              className="premium-probe-drawer-unlocks"
            />
          )}
        </section>
        <section className="premium-probe-drawer-section premium-probe-drawer-info">
          <h3>系统与续费</h3>
          <div>
            <span>系统</span>
            <strong>
              {[server.os, server.arch, server.kernel]
                .filter(Boolean)
                .join(" · ") || "—"}
            </strong>
          </div>
          <div>
            <span>处理器</span>
            <strong>
              {server.cpu_model || "—"}
              {server.cpu_cores ? ` · ${server.cpu_cores} 核` : ""}
            </strong>
          </div>
          <div>
            <span title={CONN_COUNT_HINT}>系统连接数</span>
            <strong>
              TCP {connCount(server.tcp_connections)} · UDP{" "}
              {connCount(server.udp_connections)}
            </strong>
          </div>
          <div>
            <span>到期时间</span>
            <strong>
              {server.renewal_cycle === "permanent"
                ? "永久"
                : server.expires_at || "—"}
            </strong>
          </div>
          <div>
            <span>续费价格</span>
            <strong>
              {server.renewal_price_cny === undefined
                ? "—"
                : `¥${server.renewal_price_cny.toFixed(2)}`}
            </strong>
          </div>
        </section>
      </aside>
    </div>
  );
}

export function PremiumProbePage({
  data,
  isLoading,
  isError,
}: PremiumProbePageProps) {
  const servers = useMemo(() => data?.servers || [], [data?.servers]);
  const regions = useMemo(() => buildRegions(servers), [servers]);
  const totalDownload = servers.reduce(
    (total, server) => total + (server.download_speed || 0),
    0,
  );
  const totalUpload = servers.reduce(
    (total, server) => total + (server.upload_speed || 0),
    0,
  );
  const [status, setStatus] = useState<StatusFilter>("all");
  const [region, setRegion] = useState("all");
  const [serverRoute, setServerRoute] = useState(readServerDetailRoute);
  const [view, setView] = useState<PremiumProbeView>(() => {
    if (typeof window === "undefined") return "card";
    const saved = localStorage.getItem("premium-probe-view");
    return saved === "network" || saved === "resource" ? saved : "card";
  });
  const sampledPayload = useRef<ProbeData | undefined>(undefined);
  const [liveSpeedHistory, setLiveSpeedHistory] = useState<{
    download: TrendSample[];
    upload: TrendSample[];
  }>({ download: [], upload: [] });

  useEffect(() => {
    const syncRoute = () => setServerRoute(readServerDetailRoute());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (!data || sampledPayload.current === data) return;
    let cancelled = false;
    const label = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());

    queueMicrotask(() => {
      if (cancelled || sampledPayload.current === data) return;
      sampledPayload.current = data;
      setLiveSpeedHistory((history) => ({
        download: [
          ...history.download.slice(-59),
          {
            label,
            value: totalDownload,
            formatted: formatBitSpeed(totalDownload),
          },
        ],
        upload: [
          ...history.upload.slice(-59),
          {
            label,
            value: totalUpload,
            formatted: formatBitSpeed(totalUpload),
          },
        ],
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [data, totalDownload, totalUpload]);

  if (!data && (isLoading || isError)) {
    return (
      <div className="premium-probe-loading">
        {isError ? "探针暂时无法访问" : "正在加载服务器状态…"}
      </div>
    );
  }

  const online = servers.filter((server) => server.online).length;
  const offline = servers.length - online;
  const showGlobe = data?.show_globe === true && regions.length > 0;
  const showDailyTrend = data?.show_daily_trend !== false;
  const showTrafficHotspots = data?.show_traffic_hotspots !== false;
  const overviewModuleCount =
    2 + Number(showDailyTrend) + Number(showTrafficHotspots);
  const insightVisibility = {
    traffic7D: data?.show_traffic_7d !== false,
    resourceHeatmap: data?.show_resource_heatmap !== false,
    trafficQuota: data?.show_traffic_quota !== false,
    renewalTimeline: data?.show_renewal_timeline !== false,
  };
  const visibleServers = servers
    .map((server, index) => ({ server, index }))
    .filter(({ server }) => {
      const statusMatches =
        status === "all" ||
        (status === "online" && server.online) ||
        (status === "offline" && !server.online);
      return (
        statusMatches &&
        (region === "all" || serverRegionKey(server) === region)
      );
    });

  const selectStatus = (next: StatusFilter) => {
    setStatus(next);
    setRegion("all");
  };
  const selectRegion = (next: string) => {
    setRegion(next);
    setStatus("all");
  };
  const clearFilters = () => {
    setStatus("all");
    setRegion("all");
  };
  const changeView = (next: PremiumProbeView) => {
    setView(next);
    clearServerDetail();
    setServerRoute({ kind: "none" });
    localStorage.setItem("premium-probe-view", next);
  };
  const showServerDetail = (index: number) => {
    openServerDetail(index);
    setServerRoute({ kind: "server", index });
  };
  const closeServerDetail = () => {
    clearServerDetail();
    setServerRoute({ kind: "none" });
  };
  const selectedServerIndex =
    serverRoute.kind === "server" && serverRoute.index < servers.length
      ? serverRoute.index
      : undefined;
  const serverRouteError =
    serverRoute.kind === "invalid"
      ? "节点详情参数错误"
      : serverRoute.kind === "server" && serverRoute.index >= servers.length
        ? "节点不存在"
        : "";
  const pageTitle = data?.title?.trim() || "服务器状态";
  const logo = data?.logo?.trim() || "";

  return (
    <div className="premium-probe-page">
      <div className="premium-probe-watermarks" aria-hidden="true" />
      <header className="premium-probe-topbar">
        <div>
          {logo && (
            <img
              src={logo}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <h1>{pageTitle}</h1>
          <span className="premium-probe-pro">PRO</span>
          <StandaloneLicenseBadge
            badge={data?.license_badge}
            className="premium-probe-license"
            animated
          />
        </div>
        <nav>
          <span className="premium-probe-live">实时更新</span>
          <div className="premium-probe-theme-switch">
            <ThemeSwitch appearance={data?.appearance} />
            <PasskeyLogin />
          </div>
          <div className="premium-probe-view-toggle">
            <button
              type="button"
              className={view === "card" ? "is-active" : undefined}
              onClick={() => changeView("card")}
            >
              <Globe2 /> 地图视图
            </button>
            <button
              type="button"
              className={view === "network" ? "is-active" : undefined}
              onClick={() => changeView("network")}
            >
              <Activity /> 网络状况
            </button>
            <button
              type="button"
              className={view === "resource" ? "is-active" : undefined}
              onClick={() => changeView("resource")}
            >
              <Gauge /> 资源概况
            </button>
          </div>
        </nav>
      </header>

      <main>
        {view === "network" ? (
          <PremiumNetworkView
            key="network"
            servers={servers}
            forwardChains={data?.forward}
            triISP={data?.tri_isp}
            historyDays={data?.history_days}
          />
        ) : view === "resource" ? (
          <PremiumResourceOverview
            key="resource"
            servers={servers}
            visibility={insightVisibility}
          />
        ) : (
          <>
            <section
              key="card"
              className={cn(
                "premium-probe-hero",
                !showGlobe && "without-globe",
                overviewModuleCount === 2 && "is-compact-overview",
              )}
            >
              <article className="premium-probe-panel premium-probe-overview">
                <h2>
                  <Server /> 全球节点概览
                </h2>
                <div className="premium-probe-kpis">
                  {[
                    {
                      key: "all" as const,
                      value: servers.length,
                      label: "台服务器",
                      icon: Server,
                    },
                    {
                      key: "online" as const,
                      value: online,
                      label: "在线",
                      icon: CheckCircle2,
                    },
                    {
                      key: "offline" as const,
                      value: offline,
                      label: "离线",
                      icon: XCircle,
                    },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => selectStatus(item.key)}
                    >
                      <strong>{item.value}</strong>
                      <span>
                        <item.icon /> {item.label}
                      </span>
                    </button>
                  ))}
                  <button type="button" onClick={clearFilters}>
                    <strong>{regions.length}</strong>
                    <span>
                      <Globe2 /> 个地区
                    </span>
                  </button>
                </div>

                <div
                  className={cn(
                    "premium-probe-network-grid",
                    `has-${overviewModuleCount}-modules`,
                  )}
                >
                  <SpeedSnapshot
                    label="总下行网速"
                    value={formatBitSpeed(totalDownload)}
                    samples={liveSpeedHistory.download}
                  />
                  <SpeedSnapshot
                    label="总上行网速"
                    value={formatBitSpeed(totalUpload)}
                    samples={liveSpeedHistory.upload}
                  />
                  {showDailyTrend && <DailyTrafficTrend servers={servers} />}
                  {showTrafficHotspots && <TrafficHotspots servers={servers} />}
                </div>
              </article>

              {showGlobe && (
                <article className="premium-probe-panel premium-probe-map">
                  <div className="premium-probe-panel-heading">
                    <h2>
                      <Globe2 /> 地区分布
                    </h2>
                    <span>{regions.length} 个地区</span>
                  </div>
                  <div className="premium-probe-map-content">
                    <BlackGoldGlobe regions={regions} />
                    <aside>
                      <h3>地区状态</h3>
                      {regions.map((item) => (
                        <button
                          type="button"
                          key={item.code}
                          onClick={() => selectRegion(item.code)}
                        >
                          <Twemoji>{item.label}</Twemoji>
                          <i
                            className={item.online === 0 ? "is-offline" : ""}
                          />
                          <strong>{item.total}</strong>
                        </button>
                      ))}
                    </aside>
                  </div>
                </article>
              )}
            </section>

            <section className="premium-probe-servers">
              <div className="premium-probe-section-heading">
                <h2>
                  <Server /> 服务器摘要
                </h2>
                <span>实时资源与网络状态</span>
              </div>
              <div className="premium-probe-filters">
                {[
                  ["all", `全部 ${servers.length}`],
                  ["online", `在线 ${online}`],
                  ["offline", `离线 ${offline}`],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    className={status === key ? "is-active" : undefined}
                    onClick={() => selectStatus(key as StatusFilter)}
                  >
                    {label}
                  </button>
                ))}
                <label>
                  <Globe2 />
                  <select
                    value={region}
                    onChange={(event) => selectRegion(event.target.value)}
                  >
                    <option value="all">全部地区</option>
                    {regions.map((item) => (
                      <option value={item.code} key={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {visibleServers.length === 0 ? (
                <div className="premium-probe-empty">
                  <span>暂无符合筛选条件的服务器</span>
                  <button type="button" onClick={clearFilters}>
                    查看全部
                  </button>
                </div>
              ) : (
                <div className="premium-probe-card-grid">
                  {visibleServers.map(({ server, index }) => (
                    <PremiumServerCard
                      server={server}
                      index={index}
                      key={`${server.name || "server"}-${index}`}
                      onOpen={() => showServerDetail(index)}
                      showHealthScore={data?.show_health_score === true}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedServerIndex !== undefined && servers[selectedServerIndex] && (
        <ServerDetailDrawer
          key={selectedServerIndex}
          server={servers[selectedServerIndex]}
          index={selectedServerIndex}
          onClose={closeServerDetail}
          historyDays={data?.history_days}
        />
      )}

      {serverRouteError && (
        <div className="premium-probe-drawer-layer">
          <aside className="premium-probe-drawer" role="alert">
            <header>
              <div>
                <span>节点详情</span>
                <h2>{serverRouteError}</h2>
              </div>
              <button
                type="button"
                onClick={closeServerDetail}
                aria-label="关闭"
              >
                <X />
              </button>
            </header>
            <div className="premium-probe-empty">
              <span>
                {serverRoute.kind === "invalid"
                  ? "链接中的节点编号必须是非负整数。"
                  : `没有编号为 ${serverRoute.kind === "server" ? serverRoute.index : ""} 的公开节点。`}
              </span>
              <button type="button" onClick={closeServerDetail}>
                返回节点列表
              </button>
            </div>
          </aside>
        </div>
      )}

      <footer className="premium-probe-footer">
        <StandaloneLicenseBadge badge={data?.license_badge} />
      </footer>
    </div>
  );
}
