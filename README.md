# EVE Burst Error Translation Tool

A tool for translating Eve Burst Error game scripts from Japanese to English.

## Quick Start

### 1. Install Requirements

Download and install [Bun](https://bun.sh/docs/installation#windows) (required to run this tool).

### 2. Install Dependencies

Open this folder in terminal and run:
```sh
bun install
```

### 3. Run the Tool

**Double-click `Workflow.bat`** to launch the interactive menu.

## File Structure

```
data/
├── JP CC/                    # Original Japanese scripts (compressed)
├── EN CC/                    # Translated English scripts (compressed)
├── decompress JP CC/         # Decompressed Japanese scripts
├── decompress EN CC/         # Decompressed English scripts
├── JP TXT/                   # Extracted Japanese text (translate these!)
└── EN TXT/                   # English translations
```

## Using Workflow.bat

The Workflow.bat provides an easy-to-use menu with the following options:

- **[d] Decompress** - Unpack Japanese game scripts
- **[c] Compress** - Pack English scripts back into game format
- **[e] Extract** - Pull Japanese text from unpacked scripts for translation
- **[i] Inject** - Insert translated English text back into scripts
- **[h] Hdi** - Put translated scripts into the game HDI file
- **[a] All** - Do the complete workflow (= Inject → Compress → Import to Hdi)

### Typical Translation Workflow

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
- When a line exceeds 53 characters, the tool inserts a line break after the **last space** within those 53 characters.
