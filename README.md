# 工时记录 v0.4.6

轻量级工时记录工具，支持多种排班模式，PWA 离线使用。

**在线体验：https://mrifox.github.io/-work-hours-tracker/**

## 功能特性

- **4 种排班模式**：标准工时 / 综合工时 / 大小周 / 自定义
- **打卡记录**：上班/下班一键打卡，支持手动补录
- **多维统计**：周/月/季度视图，进度追踪
- **离线使用**：PWA + Service Worker，无网也能用
- **数据安全**：多用户隔离，导入/导出 JSON/CSV
- **暗色模式**：支持暖色/极简两种风格
- **触觉反馈**：Android 振动反馈

## 安装使用

### Android APK
从 [Releases](https://github.com/MriFox/-work-hours-tracker/releases) 下载 APK 安装。

### PWA 浏览器
1. 访问 https://mrifox.github.io/-work-hours-tracker/
2. Chrome → 菜单 → 添加到桌面

## 本地开发

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 技术栈

- 原生 HTML/CSS/JS（无框架依赖）
- Capacitor（Android 打包）
- Soft UI 设计系统

## 许可

MIT
