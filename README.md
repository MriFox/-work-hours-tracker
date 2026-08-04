# 工时记录 v0.5.8

轻量级工时记录工具，支持多种排班模式，PWA 离线使用，打包为 Android APK。

**在线体验：https://mrifox.github.io/-work-hours-tracker/**

## 功能

- **4 种排班模式**：标准工时 / 综合工时 / 大小周 / 自定义
- **一键打卡**：上下班打卡 + 手动补录 + 常用时段快捷填充
- **多维统计**：周 / 月 / 季度视图，进度条 + 差额 + 日均 + 加班费
- **月份快速选择器**：点击月度标题可快速跳转任意年月
- **节假日管理**：长按日历日期标记节假日，支持节假日加班费计算
- **数据管理**：多用户隔离，JSON / CSV 导入导出
- **双风格 + 深色模式**：极简 / 暖色 + 跟随系统深色模式
- **离线使用**：PWA + Service Worker，无网络也能正常使用

## 安装

### Android APK
下载 `工时记录-v0.5.8.apk` 直接安装。

### PWA（浏览器）
1. 打开 https://mrifox.github.io/-work-hours-tracker/
2. Chrome → 菜单 → 添加到主屏幕

### iOS / 离线 HTML
下载 `工时记录-v0.5.8.html`，用 Safari 打开即可使用，支持添加到主屏幕。

## 更新日志

### v0.5.8 (2026-08-04)
- **新功能**：月度页面点击标题可快速选择任意年月
- **修复**：月页面切换月份后记录不显示的 bug
- **修复**：导出数据「复制全部」只复制截断内容
- **修复**：调休记录「修改」按钮无响应
- **修复**：登录页「重置数据」按钮失效
- **修复**：进行中记录详情显示 "null"
- **修复**：修改打卡时间后调休余额不更新
- **修复**：大小周模式边界日期判断错误
- **修复**：Toast 通知潜在 XSS 风险
- **修复**：CSV 导出备注含逗号时结构错乱
- **修复**：PWA 图标缺失导致安装失败

### v0.5.7
- 初始版本

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML / CSS / JS，无框架依赖 |
| 设计 | CSS 变量驱动，Soft UI 设计系统 |
| 打包 | Capacitor 8 + Gradle → Android APK |
| 离线 | PWA Manifest + Service Worker |
| 存储 | localStorage（多用户隔离） |

## 开发

```bash
# 安装依赖
npm install

# 构建 APK
mkdir -p www && cp index.html manifest.json sw.js www/ && cp -r js css icons www/
npx cap sync android
cd android && ./gradlew assembleDebug

# 生成单文件 HTML（iOS 备选）
python build_standalone.py
```

## 许可证

MIT
