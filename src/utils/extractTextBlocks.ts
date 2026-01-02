import iconv from "iconv-lite";

const HEADER_SIZE = 0x14;

/**
 * Text block interface
 */
export interface TextBlock {
    position: number;      // Position of 0xFD marker
    length: number;        // Text length (excluding 0xFD, length byte, and terminator)
    jpText: string;        // Decoded text
    enText: string;        // English text to replace with (if any)
    jpBuffer: Buffer;      // Original bytes (0xFD + len + Shift JIS encoding + 00)
    enBuffer: Buffer;      // Replacement bytes (0xFD + newLen + Shift JIS encoding + 00)
}

/**
 * Extract all text blocks from CC file
 */
export function extractTextBlocks(buffer: Buffer): TextBlock[] {
    const blocks: TextBlock[] = [];
    const ccLen = buffer.length;
    let ccPos = HEADER_SIZE;

    while (ccPos < ccLen) {
        const cmd = buffer[ccPos];
        const curCmdPos = ccPos;
        ccPos++;

        if (cmd === 0xFD) {
            if (ccPos >= ccLen) break;

            // Validate text structure
            const isValid = validateTextStructure(buffer, curCmdPos);

            if (!isValid) {
                ccPos = curCmdPos + 1;
                continue;
            }

            // Extract text block information
            const lineLen = buffer[ccPos] as any;
            ccPos++;
            const textStart = ccPos;
            const textEnd = textStart + lineLen;

            if (textEnd > buffer.length) {
                ccPos = curCmdPos + 1;
                continue;
            }

            const textBuffer = buffer.subarray(textStart, textEnd);
            const decodedText = iconv.decode(textBuffer, 'sjis');
            const jpBuffer = buffer.subarray(curCmdPos, textEnd + 1);

            blocks.push({
                position: curCmdPos,
                length: lineLen,
                jpText: decodedText,
                enText: decodedText,
                jpBuffer,
                enBuffer: Buffer.from(jpBuffer)
            });

            ccPos = textEnd + 1; // Skip text and terminator
        }
    }

    return blocks;
}

/**
 * Validate if 0xFD block is a valid text structure
 *
 * @param buffer File buffer
 * @param startPos Position of 0xFD byte
 * @returns Whether it's valid text
 */
export function validateTextStructure(buffer: Buffer, startPos: number): boolean {
    // Read length byte (first byte after 0xFD)
    const lineLen = buffer[startPos + 1] || 0;

    // Check 1: Length byte is not 0
    if (lineLen === 0) {
        return false;
    }

    // Check 2: Verify that lineLen bytes are followed by 0x00
    const terminatorPos = startPos + 2 + lineLen;
    if (terminatorPos >= buffer.length) {
        return false;
    }
    if (buffer[terminatorPos] !== 0x00) {
        return false;
    }

    // Check 3: Verify that lineLen bytes do not contain 0x00
    const textStart = startPos + 2;
    const textEnd = textStart + lineLen;
    for (let i = textStart; i < textEnd; i++) {
        if (buffer[i] === 0x00) {
            return false;
        }
    }

    // Check 4: Verify that adding 0x0A won't be interpreted as part of a double-byte character
    // According to CP932, 0x81-0x9F and 0xE0-0xFC are lead bytes
    let i = 0;
    while (i < lineLen) {
        const byte = buffer[textStart + i] as any;
        const unsignedByte = byte & 0xFF;

        if ((unsignedByte >= 0x81 && unsignedByte <= 0x9F) ||
            (unsignedByte >= 0xE0 && unsignedByte <= 0xFC)) {
            // Double-byte character, skip two bytes
            i += 2;
        } else {
            // Single-byte character
            i += 1;
        }
    }
    // If i == lineLen, all bytes are fully consumed
    // If i == lineLen + 1, the last byte is a lead byte and will absorb 0x0A
    const is0AAbsorbed = i === lineLen + 1;
    if (is0AAbsorbed) {
        return false;
    }

    // Check 5: Exclude specific text sequence (12 FB 01)
    if (lineLen === 3 &&
        buffer[textStart] === 0x12 &&
        buffer[textStart + 1] === 0xFB &&
        buffer[textStart + 2] === 0x01) {
        return false;
    }

    return true;
}
