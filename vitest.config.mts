import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 单元测试：纯逻辑与服务端数据访问（src 下的 *.test.ts），端到端测试见 tests/e2e
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
