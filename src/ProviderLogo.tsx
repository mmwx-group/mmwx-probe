// 服务商 logo(与主控内置探针同一位置、同一样式)。
//
// 主控下发的是它自己的缓存地址 /api/public/provider-logo/{文件名};外置探针与主控不同源,
// 由 Worker 的 /api/provider-logo/{文件名} 转发(见 worker/index.ts)。
// 许可证服务给的是透明 PNG:浅色主题直接透明显示;深色主题垫白底(styles.css 的 :root.dark .provider-logo-img),
// 深色 logo(黑字之类)才看得清。不加边框。
// 外置探针没有 Tailwind,样式写成内联。
import type { CSSProperties } from "react";

const NAME_RE = /^[0-9]{1,10}\.[0-9a-f]{6,64}\.png$/;

export function providerLogoSrc(path?: string): string {
  const name = (path || "").split("/").pop() || "";
  return NAME_RE.test(name) ? `/api/provider-logo/${name}` : "";
}

export function ProviderLogo({
  path,
  name,
  url,
  size = 18,
  style,
}: {
  path?: string;
  name?: string;
  url?: string;
  size?: number;
  style?: CSSProperties;
}) {
  const src = providerLogoSrc(path);
  if (!src) return null;
  const wrap: CSSProperties = {
    display: "inline-flex",
    flexShrink: 0,
    ...style,
  };
  const img = (
    <img
      src={src}
      alt={name || ""}
      title={name || undefined}
      loading="lazy"
      width={size}
      height={size}
      className="provider-logo-img"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 4,
        objectFit: "contain",
        boxSizing: "border-box",
      }}
    />
  );
  if (!url) return <span style={wrap}>{img}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={wrap}
      onClick={(e) => e.stopPropagation()}
    >
      {img}
    </a>
  );
}
