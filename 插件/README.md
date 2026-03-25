# 🚀 表单自动填写助手 Chrome插件

一个功能强大的Chrome浏览器插件，用于自动填写网页表单，特别适用于问卷调查、报名表单等重复性填写任务。

## ✨ 特性功能

### 🎯 核心功能
- **智能表单识别**：自动检测页面中的表单元素
- **一键填写**：预配置模板快速填写表单
- **XPath支持**：精确控制填写目标元素
- **自定义配置**：灵活配置填写内容和规则
- **历史记录**：完整记录所有填写操作

### 🛠️ 实用工具
- **元素选择器**：可视化选择页面元素获取XPath
- **表单检测**：扫描页面所有可填写元素
- **调试面板**：实时查看和测试填写效果
- **配置导入导出**：方便备份和迁移配置

### 🔧 技术特性
- **反爬虫处理**：隐藏自动化特征，提高成功率
- **智能等待**：自动等待元素加载和交互
- **异常处理**：完善的错误处理和重试机制
- **多浏览器支持**：基于Chrome扩展标准

## 📁 项目结构
form-auto-fill/

├── manifest.json           # 插件配置文件

├── popup.html             # 插件弹出窗口

├── popup.js               # 弹出窗口逻辑

├── content_script.js      # 页面内容脚本

├── background.js          # 后台服务脚本

├── inject.js              # 增强功能注入脚本

├── history.html           # 历史记录页面

├── history.js             # 历史记录逻辑

├── icons/                 # 插件图标

│   ├── icon16.png

│   ├── icon48.png

│   └── icon128.png

├── README.md             # 说明文档

└── LICENSE               # 开源协议
## 🚀 快速开始

### 安装步骤

1. **下载插件文件**
bash

git clone https://github.com/aryunm/autofill.git

或直接下载ZIP包解压
2. **加载插件到Chrome**
- 打开Chrome浏览器
- 访问 `chrome://extensions/`
- 开启右上角的"开发者模式"
- 点击"加载已解压的扩展程序"
- 选择项目文件夹

3. **配置插件**
- 点击浏览器工具栏中的插件图标
- 设置填写模板和规则
- 开始使用

### 基本使用

#### 1. 常规填写
// 配置示例

XPath:

//input[@type='text' and @name='username']

//input[@type='email']

//input[@type='tel']

对应值：

张三

zhangsan@example.com

13800138000
#### 2. 快速操作
- 右键点击页面 → "表单自动填写" → 选择功能
- 点击插件图标 → 设置参数 → 一键填写
- 使用快捷键快速调用功能

## ⚙️ 详细配置

### XPath配置说明
XPath用于精确定位页面元素，支持以下语法：

| 语法 | 说明 | 示例 |
|------|------|------|
| `//tag[@attr='value']` | 属性匹配 | `//input[@type='text']` |
| `//tag[contains(@attr,'value')]` | 属性包含 | `//label[contains(text(),'姓名')]` |
| `//tag[text()='value']` | 文本匹配 | `//button[text()='提交']` |
| `/path/to/element` | 层级路径 | `//form/div/input` |

### 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 队名 | 文本 | 嘤嘤嘤 | 主要填写内容 |
| XPath配置 | 多行文本 | 见示例 | 目标元素定位 |
| 对应值 | 多行文本 | 见示例 | 每个元素的填充值 |
| 操作延迟 | 数字 | 1000 | 填写间隔(毫秒) |

### 特殊值
- `click` - 执行点击操作
- `true` / `false` - 设置复选框状态
- `checked` / `unchecked` - 同上

## 🎨 界面说明

### 主界面 (popup.html)
- **队名设置**：主要填写内容
- **XPath配置**：元素定位规则
- **填充值**：对应元素的填写内容
- **控制按钮**：开始、保存、历史

### 历史界面 (history.html)
- **统计卡片**：成功/失败次数、成功率
- **记录表格**：详细填写历史
- **筛选功能**：按状态、日期搜索
- **详情面板**：查看每次填写的详细信息

### 调试工具
- **元素选择器**：可视化选择页面元素
- **表单检测**：扫描页面所有可填写项
- **XPath生成**：自动生成元素的XPath
- **实时测试**：测试填写效果

## 🔧 开发者指南

### 扩展API使用
// 获取配置

chrome.storage.local.get(['config'], (result) => {

console.log(result.config);

});

// 发送消息到内容脚本

chrome.tabs.sendMessage(tabId, {

action: 'startAutoFill',

config: {...}

});

// 接收消息

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

switch (request.action) {

case 'fillComplete':

// 处理完成事件

break;

}

});
### 内容脚本功能
// 在页面中可用的功能

window.autoFillHelper.startFill(config);

window.autoFillInject.getXPath(element);

window.autoFillInject.highlight(xpath);
### 调试方法
1. 打开开发者工具 (F12)
2. 在Console中输入：
// 获取插件实例

window.autoFillHelper

window.autoFillInject

// 测试功能

window.autoFillHelper.getConfig()

window.autoFillInject.findForms()
## 📊 性能优化

### 填写速度优化
1. **合理设置延迟**：根据目标网站响应速度调整
2. **使用精确XPath**：减少搜索时间
3. **批量操作**：尽量减少页面刷新

### 内存管理
1. **清理历史记录**：定期清理过期数据
2. **限制并发**：避免同时处理过多页面
3. **错误处理**：及时释放资源

## 🔐 安全说明

### 数据安全
- 所有配置数据存储在本地
- 不收集用户个人信息
- 不传输敏感数据到服务器

### 使用规范
- 仅用于合法目的
- 遵守目标网站使用条款
- 避免高频请求导致封禁

## 🐛 故障排除

### 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法找到元素 | XPath错误/页面未加载 | 检查XPath语法/增加等待时间 |
| 点击无效 | 元素被遮挡/禁用 | 使用JavaScript点击 |
| 填写被拒绝 | 反爬虫机制 | 启用反爬虫选项 |
| 插件不工作 | 权限问题/版本冲突 | 检查权限/重启浏览器 |

### 调试步骤
1. 检查控制台错误 (F12 → Console)
2. 验证XPath是否正确
3. 检查元素是否可见可交互
4. 尝试手动填写确认表单可用

## 📈 使用建议

### 最佳实践
1. **先测试后使用**：在测试页面验证配置
2. **保存配置模板**：常用表单保存为模板
3. **定期更新**：关注网站结构变化
4. **备份配置**：定期导出配置文件

### 适用场景
- 问卷调查批量填写
- 报名表单自动填写
- 测试数据快速录入
- 重复性表单处理

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 开源协议

本项目采用 MIT 协议，详情见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢以下开源项目的启发：
- [Selenium WebDriver](https://www.selenium.dev/)
- [Chrome Extensions Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- 所有贡献者和使用者

---

## 📞 支持与反馈

如有问题或建议，请：
1. 查看 [Issues](https://github.com/aryunm/autofill/issues)
2. 提交新的Issue
3. 或通过邮件联系

---

**让重复性工作自动化，专注于更有价值的事情！**

🎯 高效 · 🔧 灵活 · 🛡️ 可靠