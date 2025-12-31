/**
 * 验证 0xFD 块是否是有效的文本结构
 * 参考 retract_s.cpp 的实现
 * 
 * @param buffer 文件缓冲区
 * @param startPos 0xFD 字节的位置
 * @returns 是否是有效文本
 */
export function validateTextStructure(buffer: Buffer, startPos: number): boolean {
    // 读取长度字节（0xFD 后的第一个字节）
    const lineLen = buffer[startPos + 1] || 0;

    // 检查 1: 长度字节不为 0
    if (lineLen === 0) {
        return false;
    }

    // 检查 2: 验证 lineLen 字节后是 0x00
    const terminatorPos = startPos + 2 + lineLen;
    if (terminatorPos >= buffer.length) {
        return false;
    }
    if (buffer[terminatorPos] !== 0x00) {
        return false;
    }

    // 检查 3: 验证 lineLen 字节中不包含 0x00
    const textStart = startPos + 2;
    const textEnd = textStart + lineLen;
    for (let i = textStart; i < textEnd; i++) {
        if (buffer[i] === 0x00) {
            return false;
        }
    }

    // 检查 4: 验证添加 0x0A 不会被解释为双字节字符的一部分
    // 根据 CP932，0x81-0x9F 和 0xE0-0xFC 是前导字节
    let i = 0;
    while (i < lineLen) {
        const byte = buffer[textStart + i] as any;
        const unsignedByte = byte & 0xFF;

        if ((unsignedByte >= 0x81 && unsignedByte <= 0x9F) ||
            (unsignedByte >= 0xE0 && unsignedByte <= 0xFC)) {
            // 双字节字符，跳过两个字节
            i += 2;
        } else {
            // 单字节字符
            i += 1;
        }
    }
    // 如果 i == lineLen，说明完全消耗了所有字节
    // 如果 i == lineLen + 1，说明最后一个字节是前导字节，会吸收 0x0A
    const is0AAbsorbed = i === lineLen + 1;
    if (is0AAbsorbed) {
        return false;
    }

    // 检查 5: 排除特定文本序列 (12 FB 01)
    if (lineLen === 3 &&
        buffer[textStart] === 0x12 &&
        buffer[textStart + 1] === 0xFB &&
        buffer[textStart + 2] === 0x01) {
        return false;
    }

    return true;
}
