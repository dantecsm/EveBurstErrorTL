/**
 * HDI image file processing module
 * Import translated CC files into HDI image
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "path";
import { getDirectories, getHdiFile } from "./config.js";

// Import replaceHdiFile.js module
// Note: This is a CommonJS module, requires dynamic import
let FatImage: any;

/**
 * Initialize FatImage module
 */
async function initFatImage() {
    if (!FatImage) {
        const module = await import("./utils/replaceHdiFile.js");
        FatImage = module.default || module;
    }
    return FatImage;
}

/**
 * Import a single CC file to HDI image
 * @param hdiPath HDI image file path
 * @param ccFilePath CC file path
 * @param targetPath Target path (in HDI image)
 */
async function importFileToHdi(
    hdiPath: string,
    ccFilePath: string,
    targetPath: string
): Promise<void> {
    const FatImageClass = await initFatImage();
    
    console.log(`  Importing: ${path.basename(ccFilePath)} -> ${targetPath}`);
    
    // Read CC file data
    const ccData = readFileSync(ccFilePath);
    
    // Open HDI image
    const img = new FatImageClass(hdiPath);
    
    try {
        // Replace file
        img.replaceFile(targetPath, ccData);
    } finally {
        // Close HDI image
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
    // Get paths from configuration file
    const dirs = getDirectories();
    const sourceDir = ccDir || dirs.enCC;
    const hdiFile = hdiPath || getHdiFile();
    
    console.log(`Importing CC files to HDI image:`);
    console.log(`  Source directory: ${sourceDir}`);
    console.log(`  HDI file: ${hdiFile}`);
    console.log(`  Target directory: ${targetDir}`);
    
    // Check if source directory exists
    if (!existsSync(sourceDir)) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
    }
    
    // Check if HDI file exists
    if (!existsSync(hdiFile)) {
        throw new Error(`HDI file does not exist: ${hdiFile}`);
    }
    
    // Read all .CC files in directory
    const ccFiles = readdirSync(sourceDir).filter((f) => f.endsWith(".CC"));
    
    if (ccFiles.length === 0) {
        console.log("  No .CC files found");
        return;
    }
    
    console.log(`  Found ${ccFiles.length} files`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Import files one by one
    for (const fileName of ccFiles) {
        const ccFilePath = path.join(sourceDir, fileName);
        const targetPath = path.posix.join(targetDir, fileName);
        
        try {
            await importFileToHdi(hdiFile, ccFilePath, targetPath);
            successCount++;
        } catch (error: any) {
            console.error(`  ✗ ${fileName}: Import failed - ${error.message}`);
            failCount++;
        }
    }
    
    console.log(`\nCompleted: ${successCount} successful, ${failCount} failed`);
    
    if (failCount > 0) {
        throw new Error(`${failCount} files failed to import`);
    }
}

/**
 * Import a single CC file to HDI image
 * @param fileName CC file name
 * @param ccDir CC file directory (optional, defaults to config)
 * @param hdiPath HDI image file path (optional, defaults to config)
 * @param targetDir Target directory (in HDI image, defaults to /EVE/)
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
    
    // Check if file exists
    if (!existsSync(ccFilePath)) {
        throw new Error(`CC file does not exist: ${ccFilePath}`);
    }
    
    // Check if HDI file exists
    if (!existsSync(hdiFile)) {
        throw new Error(`HDI file does not exist: ${hdiFile}`);
    }
    
    console.log(`Importing single CC file to HDI image:`);
    console.log(`  Source file: ${ccFilePath}`);
    console.log(`  HDI file: ${hdiFile}`);
    console.log(`  Target path: ${targetPath}`);
    
    await importFileToHdi(hdiFile, ccFilePath, targetPath);
    
    console.log(`✓ Import completed`);
}
