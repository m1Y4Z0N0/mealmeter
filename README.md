# 大胃袋计算器 · MealMeter

> 记录每一笔伙食费，看清钱花在食堂、快餐、炸鸡还是零食饮料上。
> 纯本地存储 —— 无账号、无后端、无追踪，卸载即清空。

中文名 **大胃袋计算器**（桌面图标显示「大胃袋」），英文名 **MealMeter**。

---

## 功能

**记账**
- 分类九宫格 + 快捷金额累加（5/10/15/20/30/50，点几下凑出 18.5），两秒一笔
- 每笔可拍张照片（自动压缩到 800px / JPEG 65%，一张约 50–90KB）
- 餐次（早餐/午餐/晚餐/夜宵）必填，分类和餐次都可以在应用内**增删改查**
- 日期条覆盖近 90 天，忘了记随时补
- 点明细任意一条即可修改或删除（删除在编辑面板里，防误触）

**分析**
- 首页是**结构仪表盘**：环形图看占比 → 分类金额排行 → 最近三天/三周/三月趋势
- 时间维度：日 / 周（周一起算）/ 月 / 年 / 全部，支持前后翻页；**点日期块打开滚轮选择器**直接跳转（固定窗口近 30 天 / 5 周 / 12 月，窗口随真实日期自动前移）
- 日均、金额、区间全部随筛选联动，跨年自动标注年份

**明细**
- 顶部合计条：当前筛选的总金额、笔数、分类数、日期范围
- 分类 × 餐次**多选**组合筛选 + 按备注/分类搜索，一键清除
- 列表分页（30 条），「全部明细」页按日期分组查看所有记录
- 有照片的记录直接显示缩略图，点开看大图

**预算与数据**
- 月度预算 → 「今天还能花多少」动态额度，超支变红
- JSON 全量导出/导入（含分类与图片，换手机搬家用）
- CSV 导出（带 BOM，Excel/WPS 不乱码）
- 设置页可查看本机存储占用

**其他**
- 深色模式（跟随系统 / 手动切换）
- PWA：浏览器「添加到主屏幕」即可安装，离线可用
- Android APK：Capacitor 壳 + GitHub Actions 云端构建

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JavaScript | 全部逻辑在一个文件 `www/index.html`（约 85KB），**零框架、零运行时依赖、无构建步骤** |
| 存储 | IndexedDB | 库 `mealcost`（v4）：`records` 记录 / `cats` 分类 / `meals` 餐次 / `meta` 设置 / `photos` 图片二进制；金额按「分」存整数，无浮点误差 |
| 离线 | Service Worker + Web App Manifest | 页面网络优先、静态资源缓存优先；PWA 安装与「记一笔」快捷方式 |
| 图表 | 手写 SVG 环形图 + CSS 进度条 | 数据量小，不引入图表库 |
| Android | Capacitor 8.5 | 纯 WebView 壳，**没有一行原生 Java/Kotlin 代码**；compileSdk 36 / minSdk 24（Android 7.0+） |
| APK 构建 | GitHub Actions | ubuntu + JDK 21 + Gradle wrapper（8.14.3），push 即自动打包 |
| 配色 | 图标同源 | 主色 `#3C6CE4` + 点缀 `#FCCC6C`，取自应用图标的像素聚类结果 |
| 工具 | `tools/check.js`、`tools/make-icons.py` | 前者做静态自检（id 引用/未定义函数/data-* 配对/转义/语法），后者从任意图片重生成全套图标（Pillow） |

---

## 项目结构

```
mealmeter/
├── www/                        Web 资源（PWA 与 APK 共用这一份）
│   ├── index.html              应用本体：界面 + 逻辑 + 样式，单文件
│   ├── manifest.json           PWA 清单
│   ├── sw.js                   Service Worker
│   └── *.png                   图标（192/512/maskable/apple-touch）
├── android/                    Capacitor 生成的 Android 工程（可整体提交）
│   └── app/src/main/
│       ├── java/com/mealmeter/app/MainActivity.java
│       ├── res/                图标、启动图、应用名（大胃袋）
│       └── AndroidManifest.xml 仅声明 INTERNET（Capacitor 默认项，应用不联网）
├── .github/workflows/android.yml   云端构建 APK 的工作流
├── tools/
│   ├── check.js                静态自检脚本
│   └── make-icons.py           图标生成脚本（输入任意图片）
├── capacitor.config.json       appId: com.mealmeter.app, webDir: www
├── package.json                仅 3 个 Capacitor 依赖
└── LICENSE                     MIT
```

---

## 本地开发

```bash
npm install          # 安装 Capacitor（仅 3 个依赖）
npm run serve        # 起本地服务器 → http://localhost:8080
npm run check        # 静态自检（改完 www/index.html 必跑）
npm run sync         # 把 www 同步进 Android 工程
```

> 只想看界面：`npm run serve` 即可；Service Worker 在 `file://` 下不工作，别直接双击 index.html。

## 构建 APK

**方式一：GitHub Actions（推荐，本地零依赖）**

push 到 `main` 后自动触发；手动触发：Actions 页 → 构建 Android APK → Run workflow。
构建约 3–5 分钟，在该次运行页面的 **Artifacts** 区下载 `mealmeter-debug-apk`。

**方式二：本地构建**

需要 JDK 17+ 与 Android SDK：

```bash
npm run apk        # = cap sync android && gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

## 安装到手机

1. 从 Actions 的 Artifacts 下载 `mealmeter-debug-apk.zip`，解压得到 `app-debug.apk`
2. 传到手机（微信文件传输助手 / 数据线 / 网盘均可）
3. 手机上点开 APK → 系统提示「禁止安装未知应用」→ 去设置允许对应来源（浏览器/文件管理器）→ 返回继续安装
4. 装完桌面出现「大胃袋」图标

> Debug 签名自用完全没问题，但不能上架应用商店；以后想出正式签名包，配一个 keystore 走 `assembleRelease` 即可。

---

## 数据与隐私

- **所有数据只存在手机本地的 IndexedDB**，应用不发送任何数据、无统计、无广告
- Android 侧数据全部位于应用沙箱（`/data/data/com.mealmeter.app/`），**卸载即被系统整体清除**，不残留；只有你主动导出的 JSON/CSV 文件（存到你选的位置，如下载目录）不受卸载影响
- ⚠️ **卸载 = 清空所有记账数据**，重要数据请定期「设置 → 导出 JSON」
- PWA（浏览器安装）和 APK 是**两个隔离的存储域**，互相看不见；从一种换到另一种，先导出 JSON 再导入
- 删除分类时记录自动迁移到你保留的分类；删除餐次同理

## 数据结构（备份文件）

```jsonc
{
  "v": 3,
  "app": "mealmeter",
  "budget": 120000,              // 月度预算（分）
  "cats":  [ { "id": "fast", "name": "快餐", "icon": "🍔", "color": "#EF9F27", "heavy": false } ],
  "meals": [ { "id": "breakfast", "name": "早餐" } ],
  "records": [ { "id": "…", "amt": 1850, "cat": "fast", "meal": "lunch", "ts": 1725961800000, "note": "", "photo": null } ],
  "photos": { "…": "<base64>" }  // 记录里 photo 指向的图片，base64 内联
}
```

---

## License

[MIT](LICENSE)
