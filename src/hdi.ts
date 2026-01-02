/**
 * HDI 镜像文件处理模块
 * 将翻译后的 CC 文件导入到 HDI 镜像中
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "path";
import { getDirectories, getHdiFile } from "./config.js";

// 导入 replaceHdiFile.js 模块
// 注意：这是一个 CommonJS 模块，需要动态导入
let FatImage: any;

/**
 * 初始化 FatImage 模块
 */
async function initFatImage() {
    if (!FatImage) {
        const module = await import("./utils/replaceHdiFile.js");
        FatImage = module.default || module;
    }
    return FatImage;
}

/**
 * 将单个 CC 文件导入到 HDI 镜像
 * @param hdiPath HDI 镜像文件路径
 * @param ccFilePath CC 文件路径
 * @param targetPath 目标路径（在 HDI 镜像中）
 */
async function importFileToHdi(
    hdiPath: string,
    ccFilePath: string,
    targetPath: string
): Promise<void> {
    const FatImageClass = await initFatImage();
    
    console.log(`Importing: ${path.basename(ccFilePath)} -> ${targetPath}`);
    
    // 读取 CC 文件数据
    const ccData = readFileSync(ccFilePath);
    
    // 打开 HDI 镜像
    const img = new FatImageClass(hdiPath);
    
    try {
        // 替换文件
        img.replaceFile(targetPath, ccData);
    } finally {
        // 关闭 HDI 镜像
        img.close();
    }
}

/**
 * 批量导入目录中的所有 CC 文件到 HDI 镜像
 * @param ccDir CC 文件目录
 * @param hdiPath HDI 镜像文件路径
 * @param targetDir 目标目录（在 HDI 镜像中，默认为 /EVE/）
 */
export async function importDirectoryToHdi(
    ccDir?: string,
    hdiPath?: string,
    targetDir: string = "/EVE/"
): Promise<void> {
    // 从配置文件获取路径
    const dirs = getDirectories();
    const sourceDir = ccDir || dirs.enCC;
    const hdiFile = hdiPath || getHdiFile();
    
    console.log(`导入 CC 文件到 HDI 镜像:`);
    console.log(`  源目录: ${sourceDir}`);
    console.log(`  HDI 文件: ${hdiFile}`);
    console.log(`  目标目录: ${targetDir}`);
    
    // 检查源目录是否存在
    if (!existsSync(sourceDir)) {
        throw new Error(`源目录不存在: ${sourceDir}`);
    }
    
    // 检查 HDI 文件是否存在
    if (!existsSync(hdiFile)) {
        throw new Error(`HDI 文件不存在: ${hdiFile}`);
    }
    
    // 读取目录中的所有 .CC 文件
    const ccFiles = readdirSync(sourceDir).filter((f) => f.endsWith(".CC"));
    
    if (ccFiles.length === 0) {
        console.log("  没有找到 .CC 文件");
        return;
    }
    
    console.log(`  找到 ${ccFiles.length} 个文件`);
    
    let successCount = 0;
    let failCount = 0;
    
    // 逐个导入文件
    for (const fileName of ccFiles) {
        const ccFilePath = path.join(sourceDir, fileName);
        const targetPath = path.posix.join(targetDir, fileName);
        
        try {
            await importFileToHdi(hdiFile, ccFilePath, targetPath);
            successCount++;
        } catch (error: any) {
            console.error(`  ✗ ${fileName}: 导入失败 - ${error.message}`);
            failCount++;
        }
    }
    
    console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
    
    if (failCount > 0) {
        throw new Error(`${failCount} 个文件导入失败`);
    }
}

/**
 * 导入单个 CC 文件到 HDI 镜像
 * @param fileName CC 文件名
 * @param ccDir CC 文件目录（可选，默认从配置读取）
 * @param hdiPath HDI 镜像文件路径（可选，默认从配置读取）
 * @param targetDir 目标目录（在 HDI 镜像中，默认为 /EVE/）
 */
export async function importSingleFileToHdi(
    fileName: string,
    ccDir?: string,
    hdiPath?: string,
    targetDir: string = "/EVE/"
): Promise<void> {
    const dirs = getDirectories();
    const sourceDir = ccDir || dirs.enCC;
    const hdiFile = hdiPath || getHdiFile();
    
    const ccFilePath = path.join(sourceDir, fileName);
    const targetPath = path.posix.join(targetDir, fileName);
    
    // 检查文件是否存在
    if (!existsSync(ccFilePath)) {
        throw new Error(`CC 文件不存在: ${ccFilePath}`);
    }
    
    // 检查 HDI 文件是否存在
    if (!existsSync(hdiFile)) {
        throw new Error(`HDI 文件不存在: ${hdiFile}`);
    }
    
    console.log(`导入单个 CC 文件到 HDI 镜像:`);
    console.log(`  源文件: ${ccFilePath}`);
    console.log(`  HDI 文件: ${hdiFile}`);
    console.log(`  目标路径: ${targetPath}`);
    
    await importFileToHdi(hdiFile, ccFilePath, targetPath);
    
    console.log(`✓ 导入完成`);
}
