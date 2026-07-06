# 工时记录 → 微信小程序 迁移方案

> 基于当前 v0.5.3 PWA + Capacitor 版本，完整迁移到微信小程序平台

---

## 一、当前应用分析

### 1.1 核心功能矩阵

| 功能模块 | 当前实现 | 复杂度 | 迁移难度 |
|---------|---------|--------|---------|
| 多用户系统 | localStorage 昵称 + 头像 | 中 | ★★☆ |
| 四种工时模式 | 标准/综合/大小周/自定义 | 高 | ★★★ |
| 上班/下班打卡 | DOM 事件 + 实时计时器 | 中 | ★★★ |
| 手动补录 | 表单 + 日期/时间选择器 | 中 | ★★☆ |
| 周视图 | SVG 环形图 + 日列表 | 中 | ★★★ |
| 月视图 | 日历网格 + 统计 | 中 | ★★☆ |
| 季度视图 | 可配置季度 + 汇总 | 中 | ★★☆ |
| 设置页 | iOS 风格表单 | 中 | ★★☆ |
| 调休管理 | 大小周模式专属 | 低 | ★★☆ |
| 深色模式 | CSS 变量 + data-theme | 低 | ★☆☆ |
| 数据导出 | JSON/CSV 文件下载 | 低 | ★★☆ |
| 数据导入 | JSON 文件上传合并 | 低 | ★★☆ |
| 触觉反馈 | Capacitor Haptics → Vibration | 低 | ★☆☆ |

### 1.2 技术栈对比

| 维度 | 当前 PWA | 微信小程序 |
|-----|---------|-----------|
| UI 层 | HTML + CSS | WXML + WXSS |
| 逻辑层 | Vanilla JS (IIFE) | Page/Component + setData |
| 数据存储 | localStorage | wx.setStorageSync |
| 路由 | Hash-based SPA | 页面栈 (app.json pages) |
| 原生能力 | Capacitor Plugins | wx.* API |
| 文件操作 | Blob + <a download> | wx.downloadFile / wx.openDocument |
| 模态窗口 | DOM overlay | wx.showModal / 自定义组件 |
| 触觉 | Capacitor Haptics | wx.vibrateShort |
| 离线 | Service Worker | 框架内置缓存 |
| 字体 | Google Fonts | 系统字体 (不可外链) |

### 1.3 数据模型

```
Users[]
  ├── id, nickname, avatar
  └── (每个用户独立存储)
      ├── Settings { standardHours, holidayRate, darkMode, style, flextimeConfig, quarterConfig, holidays, commonSlots }
      ├── Records[] { id, date, startTime, endTime, hours, isHoliday, note, modeId, status }
      ├── CompTime[] { id, date, type, hours, note }
      └── Modes[] { id, name, type, icon }
```

---

## 二、迁移架构设计

### 2.1 小程序项目结构

```
miniprogram/
├── app.js                     # App() 生命周期 + 全局状态初始化
├── app.json                   # 页面路由 + 窗口配置 + 权限声明
├── app.wxss                   # 全局样式 (design-system 迁移)
├── project.config.json        # 微信开发者工具配置
├── sitemap.json               # 微信搜索索引
│
├── pages/
│   ├── login/                 # 登录页 (多用户选择 + 创建)
│   │   ├── login.js
│   │   ├── login.json
│   │   ├── login.wxml
│   │   └── login.wxss
│   │
│   ├── wizard/                # 模式配置向导 (按需渲染)
│   │   ├── wizard.js
│   │   ├── wizard.json
│   │   ├── wizard.wxml
│   │   └── wizard.wxss
│   │
│   ├── record/                # 打卡 + 手动补录 (首页/记录Tab)
│   │   ├── record.js
│   │   ├── record.json
│   │   ├── record.wxml
│   │   └── record.wxss
│   │
│   ├── week/                  # 周视图
│   │   ├── week.js
│   │   ├── week.json
│   │   ├── week.wxml
│   │   └── week.wxss
│   │
│   ├── month/                 # 月视图
│   │   ├── month.js
│   │   ├── month.json
│   │   ├── month.wxml
│   │   └── month.wxss
│   │
│   ├── quarter/               # 季度视图
│   │   ├── quarter.js
│   │   ├── quarter.json
│   │   ├── quarter.wxml
│   │   └── quarter.wxss
│   │
│   └── settings/              # 设置页
│       ├── settings.js
│       ├── settings.json
│       ├── settings.wxml
│       └── settings.wxss
│
├── components/                # 可复用自定义组件
│   ├── punch-card/            # 打卡组件 (上班/下班)
│   ├── date-picker/           # 日期选择器
│   ├── time-picker/           # 时间选择器 (滚动轮)
│   ├── week-chart/            # 周环形进度图
│   ├── calendar-grid/         # 月日历网格
│   ├── record-item/           # 单条记录项
│   ├── toast/                 # Toast 提示
│   ├── confirm-dialog/        # 确认弹窗
│   └── mode-bar/              # 顶部模式切换栏
│
├── utils/
│   ├── storage.js             # wx.storage 封装 (替代 localStorage)
│   ├── datetime.js            # 日期/时间计算工具
│   ├── hours-calc.js          # 工时计算核心逻辑
│   └── holidays.js            # 节假日数据 (静态)
│
├── services/
│   ├── user-service.js        # 用户管理 CRUD
│   ├── record-service.js      # 打卡记录 CRUD
│   ├── comp-time-service.js   # 调休管理
│   └── mode-service.js        # 模式管理
│
└── styles/
    ├── variables.wxss         # CSS 变量 (主题色、间距)
    ├── components.wxss        # 通用组件样式
    └── animations.wxss        # 过渡动画
```

### 2.2 页面路由设计

```json
{
  "pages": [
    "pages/login/login",       // 首页: 用户选择/创建
    "pages/wizard/wizard",     // 模式配置向导
    "pages/record/record",     // Tab 1: 打卡记录
    "pages/week/week",         // Tab 2: 周视图
    "pages/month/month",       // Tab 3: 月视图
    "pages/quarter/quarter",   // Tab 4: 季度视图
    "pages/settings/settings"  // Tab 5: 设置
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/record/record", "text": "记录", "iconPath": "..." },
      { "pagePath": "pages/week/week", "text": "周", "iconPath": "..." },
      { "pagePath": "pages/month/month", "text": "月", "iconPath": "..." },
      { "pagePath": "pages/quarter/quarter", "text": "季度", "iconPath": "..." },
      { "pagePath": "pages/settings/settings", "text": "设置", "iconPath": "..." }
    ]
  }
}
```

### 2.3 全局状态管理 (替代当前 window.WHT.state)

```javascript
// app.js
App({
  globalData: {
    users: [],
    currentUser: null,
    currentModeId: null,
    // ... 其他全局状态
  },

  onLaunch() {
    this.loadData();
  },

  loadData() {
    const users = wx.getStorageSync('workHours_users') || [];
    this.globalData.users = users;
  }
});
```

---

## 三、迁移前准备工作清单

### 3.1 账号与资质 (必须)

| 准备项 | 说明 | 状态 |
|-------|------|------|
| 微信小程序账号 | 在 mp.weixin.qq.com 注册，需企业/个体户资质 或 个人主体 | ☐ |
| 小程序 AppID | 注册后获取，开发调试用 | ☐ |
| 微信开发者工具 | 下载最新稳定版 | ☐ |
| 小程序类目 | 选择「工具 > 效率」类目 | ☐ |
| 服务器域名 (如需) | 当前纯本地存储，暂不需要后端，但未来云同步需要 HTTPS 域名 | ☐ |

> **重要**: 个人主体可以注册小程序，但功能受限（不能使用微信支付、不能使用部分开放能力）。你的工时记录 App 属于工具类，**个人主体完全可以**，不需要企业资质。

### 3.2 技术准备

| 准备项 | 说明 |
|-------|------|
| 熟悉 WXML 语法 | 数据绑定 `{{}}`、条件渲染 `wx:if`、列表渲染 `wx:for` |
| 熟悉 setData | 这是性能关键点 — 每次调用都跨线程通信 |
| 熟悉 Page 生命周期 | onLoad → onShow → onReady → onHide → onUnload |
| 了解 rpx 单位 | 1rpx = 屏幕宽度/750，替代 px 做响应式 |
| 了解 Skyline 渲染引擎 | 新一代渲染引擎，性能更好，但兼容性需评估 |

### 3.3 设计资源准备

| 准备项 | 说明 |
|-------|------|
| Tab Bar 图标 | 5 个 tab 各需 1 个选中/未选中图标 (24x24, 48x48) |
| 小程序 Logo | 144x144 像素 |
| 模式图标 | 🏛️ ⏰ 📅 ⚙️ 这些 Emoji 在真机上表现不一，建议准备 SVG/PNG |

---

## 四、分阶段实施计划

### Phase 1: 项目脚手架 + 核心基础 (预计 2-3 天)

**目标**: 跑起来一个可交互的小程序骨架

```
1. 创建项目目录结构
2. 配置 app.json (页面路由 + tabBar + 窗口样式)
3. 迁移 CSS 变量体系 → app.wxss (design-system.css)
4. 实现 utils/storage.js (封装 wx.storage API)
5. 实现全局状态管理 (app.js globalData)
6. 迁移节假日数据 (utils/holidays.js)
```

**关键决策**:
- Tab 页面使用 `wx.switchTab` → 不需要自己实现 Hash 路由
- 全局状态通过 `getApp().globalData` 访问 → 替代 window.WHT.state
- 不使用第三方状态管理库（你的数据规模不需要）

### Phase 2: 登录 + 用户系统 (预计 1 天)

**目标**: 多用户选择/创建页面完全可用

```
1. 实现 login 页面 (WXML 替代 HTML)
2. 用户 CRUD 逻辑 (services/user-service.js)
3. 头像选择 (Emoji 选择器 → 自定义组件)
4. 模式选择 + 引导式创建
```

**迁移要点**:
- `<input>` 改为 `<input bindinput="onInput">` 双向绑定模式
- Emoji 头像选择器做成独立 `<emoji-picker>` 组件
- 不再需要 `document.getElementById` → 全部走 data 驱动

### Phase 3: 记录页 (打卡核心) (预计 2-3 天)

**目标**: 打卡功能完整可用，这是 MVP 核心

```
1. punch-card 打卡组件 (上班/下班按钮)
2. 实时计时器 (setInterval → WXS 或 Page 内定时器)
3. 手动补录表单
4. 日期选择器组件 (date-picker)
5. 时间选择器组件 (time-picker 滚动轮)
6. Toast + Confirm 组件
7. 最近记录列表 (record-item)
8. 调休管理面板 (仅大小周模式)
```

**最难的部分**:
- 实时计时器：小程序不能用 `setInterval` 直接更新 DOM，必须通过 `setData` 更新。建议用 Canvas 渲染计时器或 10 秒间隔的 setData（避免高频通信）
- 时间滚动选择器：需要实现 `<picker-view>` 组件
- 打卡动画：小程序支持 CSS transition/animation，但 `setData` 引起的重绘可能丢帧

### Phase 4: 统计视图 (周/月/季度) (预计 2 天)

**目标**: 三个统计页面完整可用

```
1. 周视图: 环形进度图 (Canvas 绘制替代 SVG)
2. 周视图: 日列表 + 详情
3. 月视图: 日历网格
4. 季度视图: 多季度切换 + 汇总
```

**关键变化**:
- SVG 环形图 → `<canvas>` 组件绘制（小程序不直接支持内联 SVG）
- DOM 动画 → `wx.createAnimation` API 或 CSS transition

### Phase 5: 设置页 (预计 1.5 天)

**目标**: 完整设置功能

```
1. 用户资料编辑
2. 模式管理 (新增/删除/重命名)
3. 外观设置 (深色模式 + 视觉风格)
4. 打卡参数 (标准工时、加班费率)
5. 常用时段管理
6. 季度配置
7. 数据导出/导入 (JSON + CSV)
```

**数据导出/导入的变化** (最大 API 差异点):
- **导出**: 生成文件内容 → `wx.getFileSystemManager().writeFile()` 写入临时文件 → 展示分享或复制
- **导入**: `wx.chooseMessageFile()` 选择微信聊天中的文件 → 或让用户粘贴 JSON 文本

### Phase 6: 打磨 + 审核 (预计 2-3 天)

```
1. iOS/Android 真机测试
2. 性能优化 (setData 合并、分包加载)
3. 深色模式适配 (wx.getSystemInfo 检测)
4. 审核材料准备 (截图、功能说明)
5. 提交审核
```

---

## 五、关键技术迁移对照

### 5.1 数据存储

```javascript
// 旧: localStorage
localStorage.setItem('workHours_users', JSON.stringify(users));

// 新: wx.storage (同步版本，适合小数据量)
wx.setStorageSync('workHours_users', users);
```

> 小程序 Storage 上限 10MB，你的纯文本 JSON 数据远达不到这个量，完全不需要后端。

### 5.2 页面渲染

```javascript
// 旧: 直接操作 DOM
document.getElementById('pageContent').innerHTML = htmlString;

// 新: 数据驱动
Page({
  data: { records: [], loading: true },
  onLoad() {
    const records = recordService.getAll();
    this.setData({ records, loading: false });  // 一次 setData
  }
});
```

### 5.3 触觉反馈

```javascript
// 旧: Capacitor Haptics 或 Vibration API
window.Capacitor?.Plugins?.Haptics?.impact({ style: 'LIGHT' });

// 新: wx API
wx.vibrateShort({ type: 'light' });   // 轻触
wx.vibrateShort({ type: 'medium' });  // 中等
wx.vibrateShort({ type: 'heavy' });   // 重触
```

### 5.4 模态窗口

```javascript
// 旧: DOM overlay + CSS class toggle
document.getElementById('confirmDialog').classList.add('active');

// 新: 微信原生或自定义组件
wx.showModal({
  title: '确认删除',
  content: '确定要删除吗？',
  success: (res) => { if (res.confirm) { /* ... */ } }
});
```

### 5.5 文件导出

```javascript
// 旧: Blob + <a download>
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'data.json'; a.click();

// 新: 写入临时文件 + 分享/预览
const fs = wx.getFileSystemManager();
const filePath = `${wx.env.USER_DATA_PATH}/export.json`;
fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
wx.shareFileMessage({ filePath, fileName: 'work-hours-export.json' });
```

### 5.6 SVG → Canvas

```javascript
// 旧: 内联 SVG 环形图
<svg viewBox="0 0 200 110"><path .../></svg>

// 新: Canvas 2D
const query = wx.createSelectorQuery();
query.select('#ringCanvas').fields({ node: true, size: true }).exec((res) => {
  const canvas = res[0].node;
  const ctx = canvas.getContext('2d');
  // 绘制弧形...
});
```

### 5.7 Google Fonts → 系统字体

```css
/* 旧: Google Fonts 外链 */
font-family: 'Inter', sans-serif;

/* 新: 系统字体栈 (小程序不能外链字体) */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
  "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
  "Helvetica Neue", Helvetica, Arial, sans-serif;
```

---

## 六、风险点 & 注意事项

### 6.1 微信审核常见拒审原因

| 风险 | 你的应用 | 状态 |
|-----|---------|------|
| 类目不匹配 | 选「工具 > 效率」✓ | 安全 |
| 功能过于简单 | 打卡+统计+多模式+多用户 — 功能完整 ✓ | 安全 |
| 缺少隐私政策 | 纯本地存储，不需要隐私协议（但建议准备一份） | 低风险 |
| UI 过于简陋 | 需要重新设计为小程序风格 | ⚠️ 需注意 |
| 引导页不规范 | 登录页作为首页 → 需要自然过渡 | ⚠️ 需注意 |

### 6.2 技术风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| rpx 适配 | 不同设备显示差异 | 关键布局用 flex + rpx |
| 定时器精度 | setInterval 在后台会被冻结 | 页面 onShow 时重新校验时间 |
| setData 性能 | 大量数据导致卡顿 | 每次 setData 只传变化字段 |
| 真机兼容性 | iOS 微信/Android 微信差异 | 必须真机测试，不能用模拟器 |

### 6.3 功能取舍建议

| 功能 | 建议 |
|-----|------|
| Capacitor Haptics 的复杂振动模式 | 降级为 wx.vibrateShort (只支持 light/medium/heavy) |
| 视觉风格切换 (flat/...) | 保留深色模式，多风格可延后 |
| 复制昨天的打卡 | 保留，体验好 |
| PWA Service Worker | 不需要迁移 — 小程序自带离线能力 |
| 实时计时器动画 | 降级为 10 秒刷新，避免电量消耗 |

---

## 七、快速启动命令

当你准备好开始时，我可以帮你：

```bash
# 1. 初始化项目结构
# 我会生成完整的 app.js / app.json / app.wxss 和所有页面脚手架

# 2. 逐个模块迁移
# 从工具函数 → 数据服务 → UI 页面，逐层实现

# 3. 你只需要提供
# - 微信小程序 AppID
# - 确认是否使用个人主体
# - 确认是否需要云同步功能（当前纯本地）
```

---

## 八、总结

**你的应用非常适合做微信小程序**，原因：

1. 纯工具类，不需要微信支付等高级权限，**个人主体完全够用**
2. 纯本地存储，**不需要后端服务器**，零运维成本
3. 核心逻辑（工时计算、日历、统计）可以直接复用，主要是 UI 层需要重写
4. 小程序的原生体验比 PWA 在微信内好得多（启动更快、API 更丰富）

**预计总工期**：10-14 天（单人全职），核心 MVP（打卡+周视图）5-7 天即可上线测试。

**最大挑战**：不是逻辑迁移，而是把「DOM 字符串拼接」的渲染模式改为「数据驱动 setData」的模板模式 — 这需要彻底改变渲染思路。
