// 服务商 logo(与主控内置探针同一位置、同一样式)。
//
// 主控下发的是它自己的缓存地址 /api/public/provider-logo/{文件名};外置探针与主控不同源,
// 由 Worker 的 /api/provider-logo/{文件名} 转发(见 worker/index.ts)。
// 许可证服务给的是透明 PNG:浅色、深色主题都直接透明显示,不垫底色、不加边框(与主控内置探针一致)。
// 深色主题下,本身是黑 / 深色的 logo(黑字之类)在深色背景上看不见,这类加 class provider-logo-invert,
// 由 styles.css 的 :root.dark 规则反色显示(invert + hue-rotate 180°:黑白对调、彩色基本保持原色相)。
// 判断方法与门槛和主控前端 src/hooks/use-dark-logo.ts 一致,改一边要同步另一边。
// 外置探针没有 Tailwind,样式写成内联。
import { useEffect, useState, type CSSProperties } from "react";

// 判断结果按图片地址缓存:同一个 logo 在列表里会出现很多次。
const darkLogoCache = new Map<string, boolean>();

// sRGB 分量转线性值(算相对亮度用)
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// 不透明像素里「暗像素」(相对亮度 < 0.08,和深色背景对比度不到约 2:1)占 30% 以上就算深色 logo。
function measureDarkLogo(img: HTMLImageElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, 32, 32);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, 32, 32).data;
  } catch {
    return false; // 读不了像素就按原样显示
  }
  let opaque = 0;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 77) continue;
    opaque++;
    const lum =
      0.2126 * channel(data[i]) +
      0.7152 * channel(data[i + 1]) +
      0.0722 * channel(data[i + 2]);
    if (lum < 0.08) dark++;
  }
  return opaque > 0 && dark / opaque >= 0.3;
}

function useDarkLogo(src: string): boolean {
  const [measured, setMeasured] = useState<{ src: string; dark: boolean }>();
  useEffect(() => {
    if (!src || darkLogoCache.has(src)) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const dark = measureDarkLogo(img);
      darkLogoCache.set(src, dark);
      if (alive) setMeasured({ src, dark });
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return false;
  return (
    darkLogoCache.get(src) ?? (measured?.src === src ? measured.dark : false)
  );
}

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
  const darkLogo = useDarkLogo(src);
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
      className={darkLogo ? "provider-logo-invert" : undefined}
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
