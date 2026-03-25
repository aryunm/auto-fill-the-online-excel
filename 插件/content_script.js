// 表单自动填写助手 - 内容脚本
(function() {
    'use strict';
    
    // 配置对象
    let config = {
        teamName: '',
        configXpath: '',
        fillValue: '',
        delayTime: 1000
    };
    
    // 全局状态
    let isFilling = false;
    let fillTimer = null;
    
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch (request.action) {
            case 'startAutoFill':
                handleStartAutoFill(request.config, sendResponse);
                return true; // 保持消息通道开放，用于异步响应
                
            case 'getFillStatus':
                sendResponse({ isFilling: isFilling });
                break;
                
            case 'stopAutoFill':
                handleStopAutoFill();
                sendResponse({ success: true });
                break;
        }
    });
    
    // 处理开始自动填充
    async function handleStartAutoFill(newConfig, sendResponse) {
        if (isFilling) {
            sendResponse({ success: false, error: '正在填写中，请等待完成' });
            return;
        }
        
        try {
            config = { ...config, ...newConfig };
            isFilling = true;
            
            // 发送进度消息
            sendProgressMessage('开始自动填写表单');
            
            // 解析XPath配置
            const xpathList = parseConfigLines(config.configXpath);
            const valueList = parseConfigLines(config.fillValue);
            
            if (xpathList.length === 0) {
                throw new Error('XPath配置为空');
            }
            
            // 执行自动填写
            const result = await executeAutoFill(xpathList, valueList);
            
            // 完成后的回调
            sendResponse({ success: true, result: result });
            
            // 发送完成消息
            sendCompleteMessage(result);
            
        } catch (error) {
            console.error('自动填写失败:', error);
            sendResponse({ success: false, error: error.message });
            sendErrorMessage(error.message);
        } finally {
            isFilling = false;
        }
    }
    
    // 解析配置行
    function parseConfigLines(configText) {
        return configText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('//'));
    }
    
    // 执行自动填写
    async function executeAutoFill(xpathList, valueList) {
        const result = {
            filled: 0,
            total: xpathList.length,
            details: []
        };
        
        // 等待页面稳定
        await waitForPageStable();
        
        // 逐个处理每个XPath
        for (let i = 0; i < xpathList.length; i++) {
            const xpath = xpathList[i];
            const value = valueList[i] || config.teamName || '';
            
            try {
                sendProgressMessage(`处理第 ${i + 1}/${xpathList.length} 个元素`);
                
                // 查找元素
                const element = await waitForElement(xpath, 5000);
                
                if (!element) {
                    throw new Error(`未找到元素: ${xpath}`);
                }
                
                // 执行操作
                await performAction(element, value, i);
                
                result.filled++;
                result.details.push({
                    index: i,
                    xpath: xpath,
                    value: value,
                    success: true
                });
                
                // 延迟
                if (i < xpathList.length - 1) {
                    await delay(config.delayTime);
                }
                
            } catch (error) {
                console.error(`处理XPath失败: ${xpath}`, error);
                result.details.push({
                    index: i,
                    xpath: xpath,
                    value: value,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return result;
    }
    
    // 等待页面稳定
    function waitForPageStable(timeout = 5000) {
        return new Promise(resolve => {
            const startTime = Date.now();
            
            function check() {
                if (document.readyState === 'complete') {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    console.warn('页面加载超时，继续执行');
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            }
            
            check();
        });
    }
    
    // 等待元素出现
    function waitForElement(xpath, timeout = 10000, checkInterval = 100) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            function check() {
                try {
                    const element = getElementByXPath(xpath);
                    if (element) {
                        resolve(element);
                        return;
                    }
                    
                    if (Date.now() - startTime > timeout) {
                        reject(new Error(`等待元素超时: ${xpath}`));
                        return;
                    }
                    
                    setTimeout(check, checkInterval);
                } catch (error) {
                    reject(error);
                }
            }
            
            check();
        });
    }
    
    // 通过XPath获取元素
    function getElementByXPath(xpath) {
        try {
            const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            return result.singleNodeValue;
        } catch (error) {
            console.error('XPath解析错误:', xpath, error);
            return null;
        }
    }
    
    // 执行元素操作
    async function performAction(element, value, index) {
        // 确保元素在视图中
        scrollElementIntoView(element);
        
        // 等待元素可交互
        await waitForElementInteractable(element);
        
        // 根据元素类型执行操作
        const tagName = element.tagName.toLowerCase();
        const type = element.type || '';
        
        if (value.toLowerCase() === 'click') {
            // 点击操作
            await clickElement(element);
        } else if (tagName === 'input' || tagName === 'textarea') {
            // 输入框
            if (type === 'radio' || type === 'checkbox') {
                // 单选/复选框
                if (value.toLowerCase() === 'true' || value.toLowerCase() === 'checked') {
                    element.checked = true;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (value.toLowerCase() === 'false' || value.toLowerCase() === 'unchecked') {
                    element.checked = false;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                // 文本输入
                await fillInput(element, value);
            }
        } else if (tagName === 'select') {
            // 下拉选择
            await selectOption(element, value);
        } else if (element.isContentEditable) {
            // 可编辑区域
            await fillContentEditable(element, value);
        } else {
            // 默认点击
            await clickElement(element);
        }
    }
    
    // 滚动元素到视图中
    function scrollElementIntoView(element) {
        try {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center', 
                inline: 'center' 
            });
        } catch (error) {
            console.warn('滚动失败:', error);
        }
    }
    
    // 等待元素可交互
    function waitForElementInteractable(element, timeout = 3000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            function check() {
                if (!element || !element.isConnected) {
                    reject(new Error('元素不存在或已从DOM中移除'));
                    return;
                }
                
                const style = window.getComputedStyle(element);
                if (style.display !== 'none' && 
                    style.visibility !== 'hidden' && 
                    style.opacity !== '0') {
                    
                    if (!element.disabled) {
                        resolve();
                        return;
                    }
                }
                
                if (Date.now() - startTime > timeout) {
                    console.warn('元素交互检查超时，继续执行');
                    resolve();
                    return;
                }
                
                setTimeout(check, 100);
            }
            
            check();
        });
    }
    
    // 点击元素
    async function clickElement(element) {
        try {
            // 尝试普通点击
            element.click();
            
            // 触发相关事件
            element.dispatchEvent(new Event('click', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
        } catch (error) {
            console.warn('点击失败，尝试模拟点击:', error);
            try {
                // 模拟点击
                const rect = element.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                element.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }));
                
                element.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }));
                
                element.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }));
                
            } catch (error2) {
                console.error('所有点击方法都失败了:', error2);
            }
        }
    }
    
    // 填充输入框
    async function fillInput(input, value) {
        // 保存原始值
        const originalValue = input.value;
        
        // 触发focus事件
        input.focus();
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        
        // 清空输入框
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 延迟后输入新值
        await delay(50);
        
        // 设置新值
        input.value = value;
        
        // 触发所有相关事件
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 触发blur事件
        input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        console.log(`已填充输入框: ${value}`);
    }
    
    // 选择下拉选项
    async function selectOption(select, value) {
        // 尝试通过value选择
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.value === value || option.text === value) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
        
        // 如果没找到，尝试通过文本包含
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.text.includes(value) || option.value.includes(value)) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
        
        throw new Error(`未找到下拉选项: ${value}`);
    }
    
    // 填充可编辑区域
    async function fillContentEditable(element, value) {
        element.focus();
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        
        // 清空内容
        element.innerHTML = '';
        
        // 设置新内容
        await delay(50);
        element.textContent = value;
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        element.blur();
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    
    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 停止自动填充
    function handleStopAutoFill() {
        isFilling = false;
        if (fillTimer) {
            clearTimeout(fillTimer);
            fillTimer = null;
        }
    }
    
    // 发送进度消息
    function sendProgressMessage(message) {
        chrome.runtime.sendMessage({
            action: 'fillProgress',
            message: message
        });
    }
    
    // 发送完成消息
    function sendCompleteMessage(result) {
        chrome.runtime.sendMessage({
            action: 'fillComplete',
            result: result
        });
    }
    
    // 发送错误消息
    function sendErrorMessage(error) {
        chrome.runtime.sendMessage({
            action: 'fillError',
            error: error
        });
    }
    
    // 页面加载完成后的初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    function initialize() {
        console.log('表单自动填写助手已加载');
        
        // 监听页面变化
        observePageChanges();
        
        // 注入样式
        injectStyles();
    }
    
    // 监听页面变化
    function observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    // 新内容加载，可以在这里添加自动检测逻辑
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 注入样式
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .auto-fill-highlight {
                animation: auto-fill-highlight 2s ease-in-out;
                box-shadow: 0 0 0 2px #4CAF50 !important;
            }
            
            @keyframes auto-fill-highlight {
                0%, 100% { box-shadow: 0 0 0 2px transparent; }
                50% { box-shadow: 0 0 0 4px #4CAF50; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 工具函数：XPath转CSS选择器
    function xpathToCss(xpath) {
        // 简化的XPath转CSS选择器
        return xpath
            .replace(/\/\//g, ' ')
            .replace(/\/+/g, ' > ')
            .replace(/\[@(.+?)='(.+?)'\]/g, '[$1="$2"]')
            .replace(/\[@(.+?)=(.+?)\]/g, '[$1=$2]')
            .trim();
    }
    
    // 导出到全局对象，便于调试
    window.autoFillHelper = {
        getConfig: () => config,
        setConfig: (newConfig) => { config = { ...config, ...newConfig }; },
        startFill: (customConfig) => handleStartAutoFill({ ...config, ...customConfig }, {
            sendResponse: console.log
        }),
        stopFill: handleStopAutoFill
    };
    
    console.log('自动填写助手已初始化，通过 window.autoFillHelper 访问控制接口');
})();