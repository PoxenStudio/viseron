# 正则表达式解释

`r"/(?P<camera>[A-Za-z0-9_]+)/mjpeg-stream$"`

这个表达式定义了 MJPEG 流的 URL 路由规则，用于将 URL 中的一部分提取为变量。

## 详细分解

| 部分 | 含义 |
| :--- | :--- |
| `r"..."` | **Raw String (原始字符串)**<br>告诉 Python 解释器不要转义字符串中的特殊字符。 |
| `/` | **字面量**<br>URL 必须以 `/` 开头。 |
| `(?P<name>...)` | **命名捕获组 (Named Group)**<br>Python 特有的正则语法。它不仅匹配括号内的模式，还会把匹配到的内容提取出来，赋值给名为 `name` 的变量。 |
| `camera` | **变量名**<br>提取出的内容将作为参数名 `camera` 传递给后端的处理函数 (`DynamicStreamHandler`)。 |
| `[A-Za-z0-9_]` | **字符集**<br>定义了摄像头 ID 允许的字符：<br>- 大写字母 `A-Z`<br>- 小写字母 `a-z`<br>- 数字 `0-9`<br>- 下划线 `_` |
| `+` | **量词 (一或多)**<br>前面的字符必须出现至少一次。这意味着摄像头 ID 不能为空。 |
| `/mjpeg-stream` | **字面量**<br>紧随 ID 之后的固定路径。 |
| `$` | **结尾锚点**<br>确保 URL在此处结束。防止匹配像 `/cam1/mjpeg-stream/extra` 这样的路径。 |

## 匹配示例

- ✅ **匹配成功**: `/front_door/mjpeg-stream`
  - 提取出 `camera` = `"front_door"`

- ❌ **匹配失败**: `/front-door/mjpeg-stream`
  - 失败原因：包含连字符 `-`，而正则只允许下划线 `_`。**这是一个常见的配置陷阱。**

- ❌ **匹配失败**: `/front_door/mjpeg-stream/hq`
  - 失败原因：`$` 限制了结尾，后面不能再有内容。
