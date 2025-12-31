const fs = require("fs");

class FatImage {
    constructor(path, partitionOffset = null) {
        this.path = path;
        this.fd = fs.openSync(path, "r+");

        // Auto-detect partition offset if not provided
        if (partitionOffset === null) {
            this.partitionOffset = this._detectPartitionOffset();
            console.log(`Auto-detected partition offset: 0x${this.partitionOffset.toString(16)}`);
        } else {
            this.partitionOffset = partitionOffset;
        }

        this._readBootSector();
        this._calcLayout();
    }

    _detectPartitionOffset() {
        const fileSize = fs.fstatSync(this.fd).size;
        const buffer = Buffer.alloc(Math.min(fileSize, 1024 * 1024)); // Read first 1MB for search

        fs.readSync(this.fd, buffer, 0, buffer.length, 0);

        // Search for "FAT" string
        const fatSignature = Buffer.from("FAT", "ascii");
        const fatIndex = buffer.indexOf(fatSignature);

        if (fatIndex === -1) {
            throw new Error("FAT filesystem signature not found");
        }

        // Subtract 0x36 bytes from the position
        const partitionOffset = fatIndex - 0x36;

        if (partitionOffset < 0) {
            throw new Error("Calculated partition offset is negative, file may be corrupted");
        }

        return partitionOffset;
    }

    _readBootSector() {
        const boot = Buffer.alloc(512);
        fs.readSync(this.fd, boot, 0, 512, this.partitionOffset);

        this.BytesPerSector = boot.readUInt16LE(11);
        this.SectorsPerCluster = boot.readUInt8(13);
        this.ReservedSectors = boot.readUInt16LE(14);
        this.NumFATs = boot.readUInt8(16);
        this.MaxRootEntries = boot.readUInt16LE(17);
        this.TotalSectors16 = boot.readUInt16LE(19);
        this.MediaDescriptor = boot.readUInt8(21);
        this.SectorsPerFAT = boot.readUInt16LE(22);
        this.TotalSectors32 = boot.readUInt32LE(32);

        this.TotalSectors = this.TotalSectors16 !== 0 ? this.TotalSectors16 : this.TotalSectors32;

        const RootDirSectors = Math.floor((this.MaxRootEntries * 32 + this.BytesPerSector - 1) / this.BytesPerSector);
        const DataSectors = this.TotalSectors - (this.ReservedSectors + this.NumFATs * this.SectorsPerFAT + RootDirSectors);
        this.TotalClusters = Math.floor(DataSectors / this.SectorsPerCluster);

        if (this.TotalClusters < 4085) {
            this.FATType = 12;
        } else if (this.TotalClusters < 65525) {
            this.FATType = 16;
        } else {
            throw new Error("FAT32 not supported");
        }

        this.RootDirSectors = RootDirSectors;
    }

    _calcLayout() {
        this.FATStart = this.partitionOffset + this.ReservedSectors * this.BytesPerSector;
        this.RootDirStart = this.FATStart + this.NumFATs * this.SectorsPerFAT * this.BytesPerSector;
        this.DataStart = this.RootDirStart + this.RootDirSectors * this.BytesPerSector;
        this.BytesPerCluster = this.BytesPerSector * this.SectorsPerCluster;
    }

    _read(offset, length) {
        const buf = Buffer.alloc(length);
        fs.readSync(this.fd, buf, 0, length, offset);
        return buf;
    }

    _write(offset, buffer) {
        fs.writeSync(this.fd, buffer, 0, buffer.length, offset);
    }

    _readFatEntry(cluster) {
        if (this.FATType === 12) {
            const offset = this.FATStart + Math.floor(cluster * 3 / 2);
            const val = this._read(offset, 2).readUInt16LE(0);
            return (cluster & 1) ? (val >> 4) & 0xFFF : val & 0xFFF;
        } else {
            const offset = this.FATStart + cluster * 2;
            return this._read(offset, 2).readUInt16LE(0);
        }
    }

    _writeFatEntry(cluster, value) {
        if (this.FATType === 12) {
            const offset = this.FATStart + Math.floor(cluster * 3 / 2);
            let orig = this._read(offset, 2).readUInt16LE(0);
            let val;
            if (cluster & 1) {
                val = (orig & 0x000F) | (value << 4);
            } else {
                val = (orig & 0xF000) | (value & 0x0FFF);
            }
            const buf = Buffer.alloc(2);
            buf.writeUInt16LE(val);
            this._write(offset, buf);
        } else {
            const offset = this.FATStart + cluster * 2;
            const buf = Buffer.alloc(2);
            buf.writeUInt16LE(value);
            this._write(offset, buf);
        }
    }

    _clusterToOffset(cluster) {
        return this.DataStart + (cluster - 2) * this.BytesPerCluster;
    }

    /**
     * 读取 offset 开始连续的 maxEntries 个 32-byte 目录项（用于 rootDir 区）
     * 返回数组：每项为 { name, attr, start_cluster, file_size, raw, absoluteOffset }
     */
    _readDirEntries(offset, maxEntries) {
        const data = this._read(offset, maxEntries * 32);
        let entries = [];
        for (let i = 0; i < maxEntries; i++) {
            const entryBuf = data.slice(i * 32, (i + 1) * 32);
            if (entryBuf[0] === 0x00) break; // no more entries
            if (entryBuf[0] === 0xE5) continue; // deleted entry, skip
            const parsed = this._parseDirEntry(entryBuf);
            parsed.absoluteOffset = offset + i * 32;
            entries.push(parsed);
        }
        return entries;
    }

    _parseFilename(entry) {
        let name = entry.slice(0, 8).toString("ascii").trim();
        let ext = entry.slice(8, 11).toString("ascii").trim();
        return ext ? `${name}.${ext}` : name;
    }

    _parseDirEntry(entry) {
        return {
            name: this._parseFilename(entry),
            attr: entry[11],
            start_cluster: entry.readUInt16LE(26),
            file_size: entry.readUInt32LE(28),
            raw: Buffer.from(entry)
        };
    }

    _isDir(attr) {
        return (attr & 0x10) !== 0;
    }

    /**
     * 列出根目录（或任何给定 offset 的连续目录区）的项（保留旧接口名字）
     * 依旧接收 offset 和 maxEntries，但返回每项带 absoluteOffset
     */
    _listDir(offset, maxEntries) {
        return this._readDirEntries(offset, maxEntries);
    }

    /**
     * 读取以 startCluster 为起点的子目录（沿簇链读取所有簇并解析目录项）
     * 返回 entries 数组，每项包含 absoluteOffset（指向目录项的实际磁盘偏移）
     */
    _listDirFromCluster(startCluster) {
        // 读取簇链
        const clusters = this._readClusterChain(startCluster);
        if (!clusters || clusters.length === 0) return [];

        // 读取每个簇并解析（每簇 BytesPerCluster）
        let allEntries = [];
        const entriesPerCluster = this.BytesPerCluster / 32;

        for (let ci = 0; ci < clusters.length; ci++) {
            const c = clusters[ci];
            const clusterOffset = this._clusterToOffset(c);
            const buf = this._read(clusterOffset, this.BytesPerCluster);

            for (let i = 0; i < entriesPerCluster; i++) {
                const entryBuf = buf.slice(i * 32, (i + 1) * 32);
                if (entryBuf[0] === 0x00) {
                    // 目录项结束（以后簇也应为空），直接返回已解析项
                    return allEntries;
                }
                if (entryBuf[0] === 0xE5) continue; // deleted entry
                const parsed = this._parseDirEntry(entryBuf);
                parsed.absoluteOffset = clusterOffset + i * 32;
                allEntries.push(parsed);
            }
        }

        return allEntries;
    }

    /**
     * 查找路径（修改版）
     * 返回 [entryAbsoluteOffset, entryIndexWithinReturnedList, entryObject]
     * entryAbsoluteOffset = 绝对字节偏移（用于直接写回）
     */
    _findPath(filepath) {
        filepath = filepath.replace(/\\/g, "/");
        if (filepath.includes(":")) {
            filepath = filepath.split(":")[1];
        }
        filepath = filepath.replace(/^\/+/, "");
        const parts = filepath.split("/").filter(Boolean).map(p => p.toUpperCase());

        // 开始从根目录读取
        let currentEntries = this._listDir(this.RootDirStart, this.MaxRootEntries);

        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex];
            let found = false;

            for (let entryIndex = 0; entryIndex < currentEntries.length; entryIndex++) {
                const entry = currentEntries[entryIndex];
                if (entry.name === part) {
                    // 找到匹配项
                    if (partIndex === parts.length - 1) {
                        // 最终目标：返回 absoluteOffset
                        return [entry.absoluteOffset, entryIndex, entry];
                    }

                    // 如果是目录，则进入下一级
                    if (this._isDir(entry.attr)) {
                        // Root dir special-case: start_cluster == 0 表示引用根目录
                        if (entry.start_cluster === 0) {
                            currentEntries = this._listDir(this.RootDirStart, this.MaxRootEntries);
                        } else {
                            currentEntries = this._listDirFromCluster(entry.start_cluster);
                        }
                        found = true;
                        break;
                    } else {
                        throw new Error(`Path component is not a directory: ${part}`);
                    }
                }
            }

            if (!found) {
                throw new Error(`Path component not found: ${part}`);
            }
        }

        throw new Error("Target file not found");
    }

    _readClusterChain(start) {
        let chain = [];
        let cluster = start;
        while (cluster >= 2 && cluster < 0xFF0) {
            chain.push(cluster);
            let next = this._readFatEntry(cluster);
            if (next >= 0xFF8 || next === 0x000) break;
            cluster = next;
        }
        return chain;
    }

    _freeClusterChain(chain) {
        for (let c of chain) {
            this._writeFatEntry(c, 0x000);
        }
    }

    _allocClusters(count) {
        let allocated = [];
        for (let c = 2; allocated.length < count && c <= 0xFF0; c++) {
            if (this._readFatEntry(c) === 0x000) allocated.push(c);
        }
        if (allocated.length < count) throw new Error("Insufficient space");
        for (let i = 0; i < allocated.length; i++) {
            this._writeFatEntry(allocated[i], i === allocated.length - 1 ? (this.FATType === 12 ? 0xFFF : 0xFFFF) : allocated[i + 1]);
        }
        return allocated;
    }

    _writeClusters(clusters, data) {
        let remain = data.length;
        let pos = 0;
        for (let c of clusters) {
            let toWrite = Math.min(remain, this.BytesPerCluster);
            const buf = Buffer.alloc(this.BytesPerCluster, 0);
            data.copy(buf, 0, pos, pos + toWrite);
            this._write(this._clusterToOffset(c), buf);
            pos += toWrite;
            remain -= toWrite;
            if (remain <= 0) break;
        }
    }

    replaceFile(filepath, newFileData) {
        const [entryAbsoluteOffset, entryIndex, entry] = this._findPath(filepath);
        console.log(`Found file: ${filepath} start cluster ${entry.start_cluster}, size ${entry.file_size}`);
        const oldChain = this._readClusterChain(entry.start_cluster);
        this._freeClusterChain(oldChain);
        const neededClusters = Math.ceil(newFileData.length / this.BytesPerCluster);
        const newChain = this._allocClusters(neededClusters);
        this._writeClusters(newChain, newFileData);

        const newEntry = Buffer.from(entry.raw);
        newEntry.writeUInt16LE(newChain[0], 26);
        newEntry.writeUInt32LE(newFileData.length, 28);
        this._write(entryAbsoluteOffset, newEntry);

        console.log(`Replacement completed, new size ${newFileData.length}, start cluster ${newChain[0]}`);
    }

    close() {
        fs.closeSync(this.fd);
    }
}

if (require.main === module) {
    if (process.argv.length < 4 || process.argv.length > 6) {
        console.log(`Usage: node ${process.argv[1]} <hdi_file> <target_path_in_image> <new_file> [partition_offset_hex]`);
        console.log(`  partition_offset_hex: Optional, auto-detected if not provided`);
        process.exit(1);
    }

    const hdiFile = process.argv[2];
    const targetPath = process.argv[3];
    const newFilePath = process.argv[4];
    const partitionOffset = process.argv[5] ? parseInt(process.argv[5], 16) : null;
    const newData = fs.readFileSync(newFilePath);

    const img = new FatImage(hdiFile, partitionOffset);
    img.replaceFile(targetPath, newData);
    img.close();
}

module.exports = FatImage;

// Usage examples:
// 1. Auto-detect partition offset (recommended)
// node replaceHdiFile.js "True Love_EN.hdi" "//TLOVE00.TXB" "./newFiles/TLOVE00.TXB"
// 2. Manually specify partition offset
// node replaceHdiFile.js "True Love_EN.hdi" "//TLOVE00.TXB" "./newFiles/TLOVE00.TXB" 0x9400
// 3. Module usage (auto-detect)
// const FatImage = require('./replaceHdiFile');
// const img = new FatImage(hdiFile); // Auto-detect partition offset
// img.replaceFile(targetPath, fs.readFileSync(newFilePath))
// img.close()
// 4. Module usage (manual specification)
// const FatImage = require('./replaceHdiFile');
// const img = new FatImage(hdiFile, 0x9400); // Manually specify partition offset
// img.replaceFile(targetPath, fs.readFileSync(newFilePath))
// img.close()
