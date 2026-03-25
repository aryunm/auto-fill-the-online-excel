// 表单自动填写助手 - 注入脚本
// 这个脚本会直接注入到页面中，用于增强XPath选择和调试功能

(function() {
    'use strict';
    
    // 配置
    const config = {
        highlightColor: '#4CAF50',
        highlightDuration: 2000,
        maxXPathDepth: 5
    };
    
    // 状态
    let isActive = false;
    let selectedElement = null;
    let selectionOverlay = null;
    
    // 初始化
    function init() {
        console.log('表单自动填写助手 - 增强功能已加载');
        
        // 创建样式
        injectStyles();
        
        // 监听来自background的消息
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // 在页面上添加调试按钮
        addDebugTools();
        
        // 导出到window对象，便于调试
        window.autoFillInject = {
            getXPath: getElementXPath,
            highlight: highlightElement,
            findForms: findPageForms,
            getConfig: getElementConfig
        };
    }
    
    // 注入样式
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .auto-fill-highlight {
                animation: auto-fill-highlight ${config.highlightDuration}ms ease-in-out;
                box-shadow: 0 0 0 3px ${config.highlightColor} !important;
                position: relative;
                z-index: 10000;
            }
            
            .auto-fill-selection {
                outline: 2px solid #2196F3 !important;
                background-color: rgba(33, 150, 243, 0.1) !important;
                position: relative;
            }
            
            .auto-fill-tooltip {
                position: absolute;
                background: #333;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                z-index: 100000;
                pointer-events: none;
                white-space: nowrap;
                max-width: 500px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .auto-fill-debug-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 1000000;
                font-family: sans-serif;
                min-width: 300px;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .auto-fill-debug-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #333;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
            }
            
            .auto-fill-debug-section {
                margin-bottom: 15px;
            }
            
            .auto-fill-debug-section h4 {
                margin: 0 0 5px 0;
                color: #666;
                font-size: 12px;
            }
            
            .auto-fill-debug-code {
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 11px;
                word-break: break-all;
                overflow-wrap: break-word;
                white-space: pre-wrap;
            }
            
            .auto-fill-button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-right: 5px;
                margin-bottom: 5px;
            }
            
            .auto-fill-button:hover {
                background: #45a049;
            }
            
            .auto-fill-button.secondary {
                background: #2196F3;
            }
            
            .auto-fill-button.secondary:hover {
                background: #0b7dda;
            }
            
            .auto-fill-button.danger {
                background: #f44336;
            }
            
            .auto-fill-button.danger:hover {
                background: #da190b;
            }
            
            .auto-fill-form-info {
                background: #e8f5e8;
                border: 1px solid #c8e6c9;
                border-radius: 4px;
                padding: 10px;
                margin: 5px 0;
            }
            
            .auto-fill-input-item {
                padding: 5px;
                border-bottom: 1px solid #eee;
                cursor: pointer;
            }
            
            .auto-fill-input-item:hover {
                background: #f0f0f0;
            }
            
            @keyframes auto-fill-highlight {
                0%, 100% { 
                    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); 
                }
                50% { 
                    box-shadow: 0 0 0 5px rgba(76, 175, 80, 0.5); 
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 处理消息
    function handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'getElementXPath':
                const xpath = getElementXPathForText(request.text);
                sendResponse({ xpath: xpath });
                break;
                
            case 'findForms':
                const forms = findPageForms();
                sendResponse({ forms: forms });
                break;
                
            case 'highlightElement':
                highlightElementByXPath(request.xpath);
                sendResponse({ success: true });
                break;
                
            case 'startElementSelection':
                startElementSelection();
                sendResponse({ success: true });
                break;
                
            case 'stopElementSelection':
                stopElementSelection();
                sendResponse({ success: true });
                break;
                
            case 'getElementConfig':
                if (selectedElement) {
                    const elementConfig = getElementConfig(selectedElement);
                    sendResponse({ config: elementConfig });
                } else {
                    sendResponse({ error: '没有选中的元素' });
                }
                break;
        }
        
        return true; // 保持消息通道开放
    }
    
    // 获取元素的XPath
    function getElementXPath(element) {
        if (!element || element.nodeType !== 1) return null;
        
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        const parts = [];
        let current = element;
        
        while (current && current.nodeType === 1) {
            let part = current.tagName.toLowerCase();
            let siblingIndex = 1;
            let sibling = current.previousElementSibling;
            
            while (sibling) {
                if (sibling.tagName.toLowerCase() === part) {
                    siblingIndex++;
                }
                sibling = sibling.previousElementSibling;
            }
            
            if (siblingIndex > 1) {
                part += `[${siblingIndex}]`;
            }
            
            parts.unshift(part);
            
            if (parts.length >= config.maxXPathDepth) {
                break;
            }
            
            current = current.parentElement;
        }
        
        return parts.length ? '/' + parts.join('/') : null;
    }
    
    // 根据文本获取XPath
    function getElementXPathForText(text) {
        if (!text) return null;
        
        // 查找包含文本的元素
        const xpath = `.//*[contains(text(), "${text}")]`;
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;
        
        if (element) {
            return getElementXPath(element);
        }
        
        return null;
    }
    
    // 高亮元素
    function highlightElement(element, duration = config.highlightDuration) {
        if (!element) return;
        
        const originalClass = element.className;
        
        // 添加高亮类
        element.classList.add('auto-fill-highlight');
        
        // 显示工具提示
        const rect = element.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'auto-fill-tooltip';
        tooltip.textContent = getElementInfo(element);
        tooltip.style.left = (rect.left + window.scrollX) + 'px';
        tooltip.style.top = (rect.top + window.scrollY - 30) + 'px';
        document.body.appendChild(tooltip);
        
        // 移除高亮
        setTimeout(() => {
            element.classList.remove('auto-fill-highlight');
            tooltip.remove();
        }, duration);
    }
    
    // 通过XPath高亮元素
    function highlightElementByXPath(xpath) {
        try {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const element = result.singleNodeValue;
            
            if (element) {
                highlightElement(element);
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (error) {
            console.error('XPath高亮失败:', error);
        }
    }
    
    // 获取元素信息
    function getElementInfo(element) {
        const info = [];
        
        info.push(`Tag: ${element.tagName}`);
        if (element.id) info.push(`ID: ${element.id}`);
        if (element.name) info.push(`Name: ${element.name}`);
        if (element.type) info.push(`Type: ${element.type}`);
        if (element.placeholder) info.push(`Placeholder: ${element.placeholder}`);
        
        return info.join(' | ');
    }
    
    // 获取元素配置
    function getElementConfig(element) {
        if (!element) return null;
        
        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id,
            name: element.name,
            type: element.type,
            className: element.className,
            placeholder: element.placeholder,
            xpath: getElementXPath(element),
            cssSelector: getCssSelector(element)
        };
    }
    
    // 获取CSS选择器
    function getCssSelector(element) {
        if (!element) return '';
        
        if (element.id) {
            return '#' + element.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1');
        }
        
        const parts = [];
        let current = element;
        
        while (current && current !== document.documentElement) {
            let part = current.tagName.toLowerCase();
            
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/);
                if (classes.length > 0) {
                    part += '.' + classes[0];
                }
            }
            
            parts.unshift(part);
            
            if (current.parentElement) {
                const siblings = current.parentElement.children;
                if (siblings.length > 1) {
                    const index = Array.from(siblings).indexOf(current) + 1;
                    if (index > 1) {
                        parts[0] += `:nth-child(${index})`;
                    }
                }
            }
            
            current = current.parentElement;
        }
        
        return parts.join(' > ');
    }
    
    // 查找页面表单
    function findPageForms() {
        const forms = [];
        
        // 查找所有表单元素
        const inputs = document.querySelectorAll(`
            input, 
            textarea, 
            select, 
            button, 
            [role="checkbox"], 
            [role="radio"], 
            [contenteditable="true"]
        `);
        
        inputs.forEach((input, index) => {
            const formInfo = {
                index: index,
                element: input.tagName.toLowerCase(),
                type: input.type || 'text',
                name: input.name || '',
                id: input.id || '',
                placeholder: input.placeholder || '',
                value: input.value || '',
                xpath: getElementXPath(input),
                cssSelector: getCssSelector(input)
            };
            
            forms.push(formInfo);
        });
        
        return forms;
    }
    
    // 开始元素选择
    function startElementSelection() {
        if (isActive) return;
        
        isActive = true;
        console.log('开始元素选择模式');
        
        // 创建选择覆盖层
        selectionOverlay = document.createElement('div');
        selectionOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(33, 150, 243, 0.1);
            cursor: crosshair;
            z-index: 99999;
        `;
        
        document.body.appendChild(selectionOverlay);
        
        // 鼠标移动事件
        selectionOverlay.addEventListener('mousemove', handleMouseMove);
        selectionOverlay.addEventListener('click', handleMouseClick);
        selectionOverlay.addEventListener('contextmenu', handleRightClick);
        
        // 键盘事件
        document.addEventListener('keydown', handleKeyDown);
    }
    
    // 停止元素选择
    function stopElementSelection() {
        if (!isActive) return;
        
        isActive = false;
        console.log('停止元素选择模式');
        
        if (selectionOverlay) {
            selectionOverlay.remove();
            selectionOverlay = null;
        }
        
        if (selectedElement) {
            selectedElement.classList.remove('auto-fill-selection');
            selectedElement = null;
        }
        
        // 移除事件监听
        document.removeEventListener('keydown', handleKeyDown);
    }
    
    // 处理鼠标移动
    function handleMouseMove(event) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        
        if (element && element !== selectionOverlay) {
            // 移除之前的选择
            if (selectedElement && selectedElement !== element) {
                selectedElement.classList.remove('auto-fill-selection');
            }
            
            // 添加新选择
            selectedElement = element;
            element.classList.add('auto-fill-selection');
        }
    }
    
    // 处理鼠标点击
    function handleMouseClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (selectedElement) {
            const config = getElementConfig(selectedElement);
            
            // 发送消息到background
            chrome.runtime.sendMessage({
                action: 'elementSelected',
                config: config
            });
            
            // 显示调试信息
            showElementDebugInfo(config);
        }
        
        stopElementSelection();
    }
    
    // 处理右键点击
    function handleRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (selectedElement) {
            const config = getElementConfig(selectedElement);
            copyToClipboard(config.xpath);
            
            // 显示提示
            showNotification('XPath已复制到剪贴板');
        }
        
        stopElementSelection();
    }
    
    // 处理键盘事件
    function handleKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                stopElementSelection();
                break;
                
            case 'Enter':
                if (selectedElement) {
                    const config = getElementConfig(selectedElement);
                    showElementDebugInfo(config);
                }
                break;
        }
    }
    
    // 显示元素调试信息
    function showElementDebugInfo(config) {
        // 移除现有的调试面板
        const existingPanel = document.querySelector('.auto-fill-debug-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // 创建调试面板
        const panel = document.createElement('div');
        panel.className = 'auto-fill-debug-panel';
        
        panel.innerHTML = `
            <div class="auto-fill-debug-title">🔍 元素调试信息</div>
            
            <div class="auto-fill-debug-section">
                <h4>基本信息</h4>
                <div class="auto-fill-debug-code">
                    标签: ${config.tagName}
                    类型: ${config.type || 'N/A'}
                    ID: ${config.id || 'N/A'}
                    名称: ${config.name || 'N/A'}
                    占位符: ${config.placeholder || 'N/A'}
                </div>
            </div>
            
            <div class="auto-fill-debug-section">
                <h4>XPath</h4>
                <div class="auto-fill-debug-code">${config.xpath}</div>
                <button class="auto-fill-button" onclick="copyXPath('${config.xpath}')">复制XPath</button>
            </div>
            
            <div class="auto-fill-debug-section">
                <h4>CSS选择器</h4>
                <div class="auto-fill-debug-code">${config.cssSelector}</div>
                <button class="auto-fill-button" onclick="copyCSS('${config.cssSelector}')">复制CSS</button>
            </div>
            
            <div class="auto-fill-debug-section">
                <h4>操作</h4>
                <button class="auto-fill-button secondary" onclick="highlightElement()">高亮元素</button>
                <button class="auto-fill-button" onclick="testFill()">测试填写</button>
                <button class="auto-fill-button danger" onclick="closePanel()">关闭</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 添加全局函数
        window.copyXPath = function(xpath) {
            copyToClipboard(xpath);
            showNotification('XPath已复制');
        };
        
        window.copyCSS = function(css) {
            copyToClipboard(css);
            showNotification('CSS选择器已复制');
        };
        
        window.highlightElement = function() {
            highlightElementByXPath(config.xpath);
        };
        
        window.testFill = function() {
            if (selectedElement) {
                selectedElement.value = '测试文本_' + Date.now();
                selectedElement.dispatchEvent(new Event('input', { bubbles: true }));
                selectedElement.dispatchEvent(new Event('change', { bubbles: true }));
                showNotification('测试文本已填写');
            }
        };
        
        window.closePanel = function() {
            panel.remove();
        };
    }
    
    // 添加调试工具
    function addDebugTools() {
        // 创建浮动按钮
        const floatButton = document.createElement('div');
        floatButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #4CAF50;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            z-index: 100000;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        floatButton.textContent = '⚡';
        floatButton.title = '表单自动填写调试工具';
        
        floatButton.addEventListener('mouseenter', () => {
            floatButton.style.transform = 'scale(1.1)';
        });
        
        floatButton.addEventListener('mouseleave', () => {
            floatButton.style.transform = 'scale(1)';
        });
        
        floatButton.addEventListener('click', showDebugPanel);
        document.body.appendChild(floatButton);
    }
    
    // 显示调试面板
    function showDebugPanel() {
        // 移除现有的面板
        const existingPanel = document.querySelector('.auto-fill-debug-panel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }
        
        const forms = findPageForms();
        
        const panel = document.createElement('div');
        panel.className = 'auto-fill-debug-panel';
        
        panel.innerHTML = `
            <div class="auto-fill-debug-title">🛠️ 表单调试工具</div>
            
            <div class="auto-fill-debug-section">
                <h4>页面表单统计</h4>
                <div class="auto-fill-debug-code">
                    找到 ${forms.length} 个表单元素
                </div>
            </div>
            
            <div class="auto-fill-debug-section">
                <h4>操作</h4>
                <button class="auto-fill-button" onclick="startSelection()">选择元素</button>
                <button class="auto-fill-button secondary" onclick="findAllForms()">查找表单</button>
                <button class="auto-fill-button" onclick="testAutoFill()">测试自动填写</button>
                <button class="auto-fill-button danger" onclick="closeDebugPanel()">关闭</button>
            </div>
            
            <div class="auto-fill-debug-section">
                <h4>表单元素列表</h4>
                <div style="max-height: 200px; overflow-y: auto;">
        `;
        
        forms.forEach((form, index) => {
            panel.innerHTML += `
                <div class="auto-fill-input-item" onclick="highlightFormElement(${index})">
                    ${index + 1}. ${form.element}[type="${form.type}"] ${form.name ? 'name="' + form.name + '"' : ''}
                </div>
            `;
        });
        
        panel.innerHTML += `
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 添加全局函数
        window.startSelection = startElementSelection;
        
        window.findAllForms = function() {
            const forms = findPageForms();
            console.log('找到的表单元素:', forms);
            showNotification(`找到 ${forms.length} 个表单元素`);
        };
        
        window.testAutoFill = function() {
            chrome.runtime.sendMessage({
                action: 'testAutoFill'
            });
        };
        
        window.highlightFormElement = function(index) {
            const form = forms[index];
            if (form && form.xpath) {
                highlightElementByXPath(form.xpath);
            }
        };
        
        window.closeDebugPanel = function() {
            panel.remove();
        };
    }
    
    // 复制到剪贴板
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    // 显示通知
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000000;
            animation: notificationFade 3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'notificationFadeOut 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 2500);
        
        // 添加动画样式
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes notificationFade {
                    0% { opacity: 0; transform: translateY(-20px); }
                    10% { opacity: 1; transform: translateY(0); }
                    90% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-20px); }
                }
                
                @keyframes notificationFadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();