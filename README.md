# 大胃袋计算器 · MealMeter

> 一款专注「伙食费结构」的本地伙食账本：看清楚钱都花在食堂、快餐、炸鸡还是零食饮料上。
> 无账号、无后端、无追踪，所有数据只留在你自己的设备里。

中文名 **大胃袋计算器**（桌面图标显示「大胃袋」），英文名 **MealMeter**。当前版本 **v1.0.0**。

---

## 它不是通用记账软件

核心目标只有一个：**看清吃的结构**。每一笔伙食费都归到你自己定义的分类（食堂、快餐、炸鸡、咖啡奶茶……），首页仪表盘直接告诉你这个月的钱主要花在哪类吃上、和上个月比是多了还是少了。流水账是手段，结构才是答案。

---

## 功能

**记一笔**
- 分类九宫格必选 + 快捷金额累加（5/10/15/20/30/50，点几下凑出 18.5），两秒一笔
- 餐次（早餐/午餐/晚餐/夜宵）、日期（覆盖近 90 天，忘了随时补）、品牌、备注、照片
- 分类、餐次、品牌全部可以在应用内**增删改查**，入口分级管理
- 点明细任意一条即可修改或删除（删除藏在编辑面板里，防误触）

**结构分析**
- 首页就是**结构仪表盘**：环形图看占比 → 分类金额排行 → 最近三天/三周/三月趋势
- 时间维度：日 / 周（周一起算）/ 月 / 年 / 全部，支持前后翻页；点日期块打开滚轮选择器直接跳转（窗口随真实日期自动前移）
- 日均、金额、区间随筛选联动，环比自动按上一个自然月计算

**明细**
- 「全部明细」独立成档，按日期分组浏览
- 分类 × 餐次**多选**组合筛选 + 按备注/分类搜索，一键清除
- 小字按「餐次 · 品牌 · 备注」展示，一眼看清每笔的来龙去脉

**照片**
- 每笔可附照片，查看详情时照片排在第一位，点开大图可左右翻页
- **照片总览**集中浏览所有照片，支持批量多选删除——只把照片从记录里摘掉，记录本身永不误删

**预算与数据**
- 月度预算 → 「今天还能花多少」动态额度，超支变红
- JSON 全量导出/导入（含分类与照片，换手机搬家用）
- CSV 导出（带 BOM，Excel/WPS 不乱码）
- 设置页可查看本机存储占用

**其他**
- 深色模式（跟随系统 / 手动切换）
- PWA：浏览器「添加到主屏幕」即可安装，离线可用
- Android APK：Capacitor 壳 + GitHub Actions 云端构建，Releases 免登录下载

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JavaScript | 全部逻辑在一个文件 `www/index.html`，**零框架、零运行时依赖、无构建步骤** |
| 存储 | IndexedDB | 库 `mealcost`：`records` 记录 / `cats` 分类 / `meals` 餐次 / `brands` 品牌 / `meta` 设置 / `photos` 图片二进制；金额按「分」存整数，无浮点误差 |
| 离线 | Service Worker + Web App Manifest | 页面网络优先、静态资源缓存优先；PWA 安装与「记一笔」快捷方式 |
| 图表 | 手写 SVG 环形图 + CSS 进度条 | 数据量小，不引入图表库 |
| Android | Capacitor 8.5 | WebView 壳 + 少量原生代码：把导出文件正确存入系统「下载」文件夹（WebView 不处理 `a[download]`） |
| APK 构建 | GitHub Actions | ubuntu + JDK 21 + Gradle wrapper（8.14.3），push 即自动打包；私有签名密钥走仓库 Secrets，不进代码 |
| 配色 | 图标同源 | 主色 `#3C6CE4` + 点缀 `#FCCC6C`，取自应用图标的像素聚类结果 |
| 工具 | `tools/check.js`、`tools/make-icons.py` | 前者做静态自检（id 引用/未定义函数/data-* 配对/转义/语法），后者从任意图片重生成全套图标（Pillow） |

## 项目结构

```
mealmeter/
├── www/                        Web 资源（PWA 与 APK 共用这一份）
│   ├── index.html              应用本体：界面 + 逻辑 + 样式，单文件
│   ├── manifest.json           PWA 清单
│   ├── sw.js                   Service Worker
│   ├── version.json            更新检查用的版本信息
│   └── *.png                   图标（192/512/maskable/apple-touch）
├── android/                    Capacitor 生成的 Android 工程（整体提交）
│   └── app/src/main/
│       ├── java/com/mealmeter/app/MainActivity.java
│       │                       Capacitor 入口 + 导出桥（文件存入下载文件夹）
│       ├── res/                图标、启动图、应用名（大胃袋）
│       └── AndroidManifest.xml 仅声明 INTERNET（Capacitor 默认项，应用不联网）
├── assets-src/                 图标源图（不入库）
├── .github/workflows/android.yml   云端构建 APK 的工作流
├── tools/
│   ├── check.js                静态自检脚本
│   └── make-icons.py           图标生成脚本（输入任意图片，输出全套）
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

push 到 `main` 后自动触发；也可在 Actions 页手动 Run workflow。构建约 3–5 分钟，在该次运行页面的 **Artifacts** 区下载 `mealmeter-debug-apk`（需登录 GitHub）。

**发布**：正式包发布在 **Releases** 页并附上 APK —— Release 资产**无需登录**即可下载，手机浏览器直接点开链接就能下。

**方式二：本地构建**

需要 JDK 17+ 与 Android SDK：

```bash
npm run apk        # = cap sync android && gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

## 安装到手机

1. **下载 APK**（任选其一）：
   - 最简单：手机浏览器直接打开 [Releases 最新版](https://github.com/m1Y4Z0N0/mealmeter/releases/latest)，点下方的 `MealMeter-…-debug.apk` 下载，**无需登录 GitHub**
   - 或者：从某次 Actions 运行页底部的 **Artifacts** 下载 `mealmeter-debug-apk.zip`，解压得到 APK（需登录）
   - 或者：电脑下载后通过微信文件传输助手 / 数据线传到手机
2. 手机上点开 APK → 系统提示「禁止安装未知应用」→ 去设置允许对应来源（浏览器/文件管理器）→ 返回继续安装
3. 装完桌面出现「大胃袋」图标

> 版本号规则：`versionCode = 主版本×10000 + 次版本×100 + 修订号`（如 1.0.0 → 10000），升级版本需同步修改 `www/version.json`、`www/index.html` 的 `APP_VER` 和 `android/app/build.gradle` 三处。

---

## 数据与隐私

- **所有数据只存在设备本地的 IndexedDB**，应用不发送任何数据、无统计埋点、无广告、无网络请求
- Android 侧数据全部位于应用沙箱，**卸载即被系统整体清除**，不残留；只有你主动导出的 JSON/CSV 文件不受卸载影响（APK 内导出自动存入系统「下载」文件夹）
- ⚠️ **卸载 = 清空所有记账数据**，重要数据请定期「设置 → 导出 JSON」
- ⚠️ **PWA（浏览器安装）和 APK 是两个隔离的存储域**，互相看不见；从一种换到另一种，先导出 JSON 再导入
- 删除分类时记录自动迁移到你保留的分类；删除餐次同理

备份文件为自包含 JSON，包含全部记录、分类、餐次、品牌与照片（base64 内联），任何设备导入后即可完整还原。

---

## License

[MIT](LICENSE)
