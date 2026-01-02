# 配置文件说明

项目使用 `config.json` 文件来管理目录路径配置。

## 配置项说明
定义项目中使用的各个目录路径：

- `jpCC`: 日语游戏脚本目录（压缩）
- `enCC`: 英语游戏脚本目录（压缩）
- `decompressJPCC`: 解压的日语游戏脚本目录
- `decompressENCC`: 解压的英语游戏脚本目录
- `jpTXT`: 从日语脚本提取的文本目录
- `enTXT`: 英语翻译文本目录
- `hdiFile`: HDI 文件路径

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
  },
  "hdiFile": "H:/Games/PC98/TL/Eve Burst Errors.hdi"
}
```
