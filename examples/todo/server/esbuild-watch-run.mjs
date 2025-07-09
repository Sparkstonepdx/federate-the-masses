// esbuild-watch-run.mjs
import { context } from "esbuild";
import { spawn } from "child_process";

let runner;

const restart = () => {
  if (runner) runner.kill();
  runner = spawn("node", ["dist/server.js"], {
    stdio: "inherit",
  });
};

const restartPlugin = {
  name: "restart-on-build",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        console.error(`❌ Build failed with ${result.errors.length} error(s).`);
      } else {
        console.log("✅ Build succeeded. Restarting app...");
        restart();
      }
    });
  },
};

const ctx = await context({
  entryPoints: ["main.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  sourcemap: true,
  plugins: [restartPlugin],
});

await ctx.watch();
console.log("🚀 Watching for changes...");
restart();
