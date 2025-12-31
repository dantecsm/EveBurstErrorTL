#!/usr/bin/env bun
/**
 * 测试命令的向后兼容性和自动检测功能
 */

import { spawn } from "node:child_process";

async function runCommand(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("bun", cmd, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

async function main() {
  console.log("测试命令自动检测功能\n");
  console.log("=".repeat(60));

  // 测试 1: 单文件解压
  console.log("\n测试 1: 单文件解压");
  const result1 = await runCommand(["src/index.ts", "decompress", "data/JP CC/A001.CC", "test_single.CC"]);
  console.log(`退出码: ${result1.exitCode}`);
  console.log(result1.stdout.includes("✓ 解压成功") ? "✓ 通过" : "✗ 失败");

  // 测试 2: 目录解压
  console.log("\n测试 2: 目录解压（创建测试目录）");
  const result2 = await runCommand(["src/index.ts", "decompress", "data/JP CC", "test_decompress"]);
  console.log(`退出码: ${result2.exitCode}`);
  console.log(result2.stdout.includes("✓ 批量解压完成") ? "✓ 通过" : "✗ 失败");

  // 测试 3: 单文件压缩
  console.log("\n测试 3: 单文件压缩");
  const result3 = await runCommand(["src/index.ts", "compress", "test_decompress/A001.CC", "test_single_compressed.CC"]);
  console.log(`退出码: ${result3.exitCode}`);
  console.log(result3.stdout.includes("✓ 压缩成功") ? "✓ 通过" : "✗ 失败");

  // 测试 4: 目录压缩
  console.log("\n测试 4: 目录压缩");
  const result4 = await runCommand(["src/index.ts", "compress", "test_decompress", "test_compress"]);
  console.log(`退出码: ${result4.exitCode}`);
  console.log(result4.stdout.includes("✓ 批量压缩完成") ? "✓ 通过" : "✗ 失败");

  // 测试 5: 不存在的路径
  console.log("\n测试 5: 不存在的路径");
  const result5 = await runCommand(["src/index.ts", "decompress", "nonexistent.CC", "output.CC"]);
  console.log(`退出码: ${result5.exitCode}`);
  console.log(result5.exitCode !== 0 ? "✓ 通过（正确报错）" : "✗ 失败（应该报错）");

  console.log("\n" + "=".repeat(60));
  console.log("\n清理测试文件...");

  // 清理
  const rmProcess = spawn("rm", ["-rf", "test_single.CC", "test_single_compressed.CC", "test_decompress", "test_compress"], {
    cwd: process.cwd(),
  });
  await new Promise((resolve) => rmProcess.on("close", resolve));

  console.log("✓ 测试完成");
}

main().catch(console.error);
