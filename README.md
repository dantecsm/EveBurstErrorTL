# EVE Burst Error Translation Tool

A tool for translating Eve Burst Error game scripts from Japanese to English.

## Quick Start

### 1. Install Requirements

Download and install [Bun](https://bun.sh/docs/installation#windows).

### 2. Install Dependencies

Open this folder in terminal and run:
```sh
bun install
```

### 3. Run the Tool

Double-click `Workflow.bat`.

## File Structure

```
data/
├── JP CC/                    # Original Japanese scripts (compressed)
├── EN CC/                    # Translated English scripts (compressed)
├── decompress JP CC/         # Decompressed Japanese scripts
├── decompress EN CC/         # Decompressed English scripts
├── JP TXT/                   # Extracted Japanese text (translate these!)
└── EN TXT/                   # English translations
Eve Burst Error(EN).hdi       # Game HDI file
```
If you want to change directories or file paths above, remember to update the corresponding settings in `config.json`.

## Workflow

Double-click `Workflow.bat` to launch the interactive menu.

**Step 1: Prepare for Translation**

1. Run **[d] Decompress** to unpack the original game scripts (`data/JP CC` → `data/decompress JP CC`)
2. Run **[e] Extract** to extract all Japanese text into txt files (`data/decompress JP CC` → `data/JP TXT`)

**Step 2: Translate and Build**

3. Translate the txt files in `data/JP TXT` and save to `data/EN TXT`

4. Run **[a] All** to complete the entire process, which equals to:
   - **[i] Inject** - Insert English translations into the scripts (`data/EN TXT` → `data/decompress EN CC`)
   - **[c] Compress** - Pack the translated scripts back into game format (`data/decompress EN CC` → `data/EN CC`)
   - **[h] Hdi** - Import the packed scripts into the game HDI file (`data/EN CC` → `Eve Burst Error(EN).hdi`)


## Tips for Translators

- Text files use **UTF-8** encoding
- Backslashes (`\`) in text files represent line breaks in the game
- When a line exceeds 52 characters, the tool inserts a line break after the **last space** within those 52 characters.
- If a decompressed CC script exceeds 65,559 bytes (0xFFFF + 24), some lines will remain in Japanese; reduce the total text length in the TXT file (either inserted or non-inserted lines) to stay within the limit.
- Each line of text must not exceed 255 characters
- If a line begins with 'GOTO '(uppercase), the following text is treated as a script name, causing the game to jump to that script. For example, `GOTO a001_6` will jump to `A001_6.CC` instead of displaying the dialogue.
