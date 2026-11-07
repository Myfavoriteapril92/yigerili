# 📅 易个日历 · YiGeRiLi

一个简洁的万年历：公历、农历、节气、节日、法定节假日，装上就能用，断网也能看。

- 网页版：<https://www.yigerili.de5.net/>
- 安卓版：GitHub Actions 自动构建 APK（见下方「构建 APK」）

---

## 现在的形态

同一套网页代码，三种用法：

| 用法 | 怎么用 | 说明 |
| --- | --- | --- |
| 网页 | 浏览器打开 | GitHub Pages 托管 |
| 装到桌面（PWA） | 手机上「添加到主屏幕」 | 全屏显示、离线可用、和 App 体感接近 |
| 安卓 App（APK） | 下载安装 | 原生 WebView 外壳，全程离线，**不申请任何权限** |

三种形态共用根目录下的 `index.html` + `assets/`，改一次三处都生效。

## 功能

- 月历浏览：左右切换月份，点「今天」回到当月
- 农历：农历日期、干支、生肖、节气、传统节日
- 法定节假日：放假与调休上班标记（内置 2004–2027 数据）
- 纪念弹窗：点击 2026 年 10 月 3 日会打开照片与音乐
- 离线：农历库、节假日数据、图片、音乐全部本地打包，断网照常使用

## 目录结构

```
index.html                页面骨架
manifest.webmanifest      PWA 清单（图标、名称、全屏模式）
sw.js                     Service Worker，负责离线缓存
assets/
  css/app.css             全部样式
  js/app.js               全部逻辑（ES5，兼容低版本安卓 WebView）
  js/lunar.js             农历库 lunar-javascript（本地内置）
  js/chinese-days.js      法定节假日数据（本地内置）
  data/chinese-days.json  同一份数据的 JSON 版，给单独部署的场景兜底
  icons/                  PWA 与桌面图标
  images/                 作者头像、纪念照片
  music/music.mp3         纪念弹窗背景音乐
app/                      安卓工程（WebView 外壳）
  src/main/java/.../MainActivity.java
  src/main/res/           主题、图标
tools/                    构建与自检脚本
.github/workflows/main.yml  自动构建 APK
```

## 本地预览

Service Worker 需要 http(s)，不能直接双击 HTML，起个本地服务器：

```bash
python3 -m http.server 8080
# 然后打开 http://localhost:8080/
```

## 跑自检

不需要浏览器，用 Node 跑一遍核心逻辑（农历是否正确、节假日是否读到、日历是否渲染出 42 格）：

```bash
node tools/smoke-test.js
```

## 构建 APK

### 方式一：让 GitHub 自动构建（推荐）

推送到 `main` 分支，或在 Actions 页面手动触发「构建安卓 APK」：

1. 打开仓库的 **Actions** → **构建安卓 APK** → **Run workflow**
2. 构建完成后，在该次运行的 **Artifacts** 里下载 `yigerili-apk`

打上 `v*` 形式的分支 tag（例如 `v1.0.0`）时，还会自动发布到 Release，可以直接下载。

### 方式二：本地构建

用 Android Studio 打开仓库根目录，等 Gradle 同步完成后运行 `app` 配置即可。
命令行等价写法：

```bash
gradle assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

构建时 Gradle 会先把根目录的网页文件复制进 `assets/web/`，所以 APK 里跑的就是网页版同一份代码。

## 部署网页

GitHub Pages：仓库 **Settings → Pages**，Source 选 `main` 分支根目录即可。
自定义域名写在 `CNAME`。

## 发布新版本时注意

`sw.js` 顶部的 `VERSION` 是离线缓存的名字，**改了页面内容就要改版本号**
（例如 `ygl-v1` → `ygl-v2`），否则老用户会继续看到缓存里的旧页面。

## 重新生成图标

图标是脚本画的，改配色或形状后重跑：

```bash
python3 tools/make_icons.py          # PWA / 网页图标
python3 tools/make_android_icons.py  # 安卓各密度图标
```

需要 `pillow`：`pip install pillow`

## 开源许可

见仓库中的 `LICENSE`。
