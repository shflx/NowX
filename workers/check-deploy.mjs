const id = process.env.NOWX_HYPERDRIVE_ID;
if (!id || !/^[a-f0-9]{32}$/i.test(id) || /^0+$/.test(id)) {
  console.error("请将 NOWX_HYPERDRIVE_ID 设为已创建的 Hyperdrive 配置 ID。");
  process.exitCode = 1;
}
