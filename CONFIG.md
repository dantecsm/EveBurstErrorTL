# Configuration File Guide

The project uses the `config.json` file to manage directory path configurations.

## Configuration Items
Defines various directory paths used in the project:

- `jpCC`: Japanese game script directory (compressed)
- `enCC`: English game script directory (compressed)
- `decompressJPCC`: Decompressed Japanese game script directory
- `decompressENCC`: Decompressed English game script directory
- `jpTXT`: Text directory extracted from Japanese scripts
- `enTXT`: English translation text directory
- `hdiFile`: HDI file path

## Modifying Configuration

To modify directory paths, simply edit the `config.json` file.

### Example: Modifying Directory Structure

```json
{
  "directories": {
    "jpCC": "source/jp",
    "enCC": "source/en",
    "decompressJPCC": "decompressed/jp",
    "decompressENCC": "decompressed/en",
    "jpTXT": "texts/jp",
    "enTXT": "texts/en"
  },
  "hdiFile": "H:/Games/PC98/TL/Eve Burst Error(EN).hdi"
}
```
