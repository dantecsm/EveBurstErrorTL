# 配置文件说明

项目使用 `config.json` 文件来管理目录路径配置。

## 配置文件结构

```json
{
  "directories": {
    "jpCC": "data/JP CC",
    "enCC": "data/EN CC",
    "decompressJPCC": "data/decompress JP CC",
    "decompressENCC": "data/decompress EN CC",
    "jpTXT": "data/JP TXT",
    "enTXT": "data/EN TXT"
  }
}
```

## 配置项说明

### directories - 目录配置

定义项目中使用的各个目录路径：

- `jpCC`: 日语游戏脚本目录（压缩）
- `enCC`: 英语游戏脚本目录（压缩）
- `decompressJPCC`: 解压的日语游戏脚本目录
- `decompressENCC`: 解压的英语游戏脚本目录
- `jpTXT`: 从日语脚本提取的文本目录
- `enTXT`: 英语翻译文本目录

## 修改配置

如果需要修改目录路径，只需编辑 `config.json` 文件即可。

### 示例：修改目录结构

如果想要使用不同的目录结构：

```json
{
  "directories": {
    "jpCC": "source/jp",
    "enCC": "source/en",
    "decompressJPCC": "decompressed/jp",
    "decompressENCC": "decompressed/en",
    "jpTXT": "texts/jp",
    "enTXT": "texts/en"
  }
}
```

## 配置加载

配置文件在程序启动时自动加载，由 `src/config.ts` 模块管理。

所有模块通过以下方式访问配置：

```typescript
import { getDirectories } from "./config.ts";

// 获取目录配置
const dirs = getDirectories();
console.log(dirs.jpCC);
console.log(dirs.decompressJPCC);
```

## 注意事项

1. 修改配置后需要重启程序才能生效
2. 路径可以使用相对路径或绝对路径
3. Windows 路径中的反斜杠需要转义：`"data\\JP CC"` 或使用正斜杠：`"data/JP CC"`
4. 确保配置文件是有效的 JSON 格式

