// 运行 src/*.test.ts。
//
// 这些测试是「失败直接抛错」的写法,导入不带扩展名、有的还要经过 Vite 的转换,node 不能直接跑。
// 这里借 Vite 自带的 ssrLoadModule 加载,不用另装测试框架。
// 每个文件单独起一个进程:有的测试会往 globalThis 上挂 document / localStorage,互相不能串。
//
//   node scripts/run-tests.mjs            跑全部
//   node scripts/run-tests.mjs src/x.test.ts   只跑一个(也是子进程用的入口)
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const [single] = process.argv.slice(2);

if (single) {
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  let failed = false;
  try {
    await server.ssrLoadModule("/" + single.replace(/^\.?\//, ""));
  } catch (error) {
    failed = true;
    console.error(error);
  }
  await server.close();
  process.exit(failed ? 1 : 0);
}

const files = readdirSync(new URL("../src", import.meta.url))
  .filter((name) => name.endsWith(".test.ts"))
  .sort();
let failures = 0;
for (const name of files) {
  const result = spawnSync(process.execPath, [self, `src/${name}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status === 0) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log((result.stdout + result.stderr).trim());
  }
}
console.log(
  `\n${files.length - failures} / ${files.length} 个测试文件通过` +
    (failures ? `,${failures} 个失败` : ""),
);
process.exit(failures ? 1 : 0);
