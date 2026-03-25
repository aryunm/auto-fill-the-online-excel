// 表单自动填写助手 - 后台服务脚本
(function() {
    'use strict';
    
    // 扩展安装事件
    chrome.runtime.onInstalled.addListener(function(details) {
        console.log('表单自动填写助手已安装', details.reason);
        
        // 设置默认配置
        if (details.reason === 'install') {
            setDefaultConfig();
        }
        
        // 创建右键菜单
        createContextMenus();
    });
    
    // 设置默认配置
    async function setDefaultConfig() {
        const defaultConfig = {
            teamName: '',
            configXpath: ``,
            fillValue: ``,
            delayTime: 1000,
            fillHistory: [],
            version: '1.0'
        };
        
        await chrome.storage.local.set(defaultConfig);
        console.log('默认配置已设置');
    }
    
    // 创建右键菜单
    function createContextMenus() {
        // 清除已存在的菜单
        chrome.contextMenus.removeAll();
        
        // 创建主菜单
        chrome.contextMenus.create({
            id: 'auto-fill-root',
            title: '表单自动填写',
            contexts: ['page', 'selection', 'link', 'editable']
        });
        
        // 快速填写当前表单
        chrome.contextMenus.create({
            id: 'quick-fill',
            parentId: 'auto-fill-root',
            title: '快速填写',
            contexts: ['page']
        });
        
        // 保存XPath
        chrome.contextMenus.create({
            id: 'save-xpath',
            parentId: 'auto-fill-root',
            title: '保存选中元素XPath',
            contexts: ['selection']
        });
        
        // 查找表单元素
        chrome.contextMenus.create({
            id: 'find-forms',
            parentId: 'auto-fill-root',
            title: '查找页面表单',
            contexts: ['page']
        });
        
        // 分离菜单
        chrome.contextMenus.create({
            type: 'separator',
            parentId: 'auto-fill-root',
            contexts: ['page']
        });
        
        // 打开设置
        chrome.contextMenus.create({
            id: 'open-settings',
            parentId: 'auto-fill-root',
            title: '打开设置页面',
            contexts: ['page']
        });
        
        // 查看历史
        chrome.contextMenus.create({
            id: 'view-history',
            parentId: 'auto-fill-root',
            title: '查看填写历史',
            contexts: ['page']
        });
        
        // 导出配置
        chrome.contextMenus.create({
            id: 'export-config',
            parentId: 'auto-fill-root',
            title: '导出配置',
            contexts: ['page']
        });
        
        // 导入配置
        chrome.contextMenus.create({
            id: 'import-config',
            parentId: 'auto-fill-root',
            title: '导入配置',
            contexts: ['page']
        });
        
        console.log('右键菜单已创建');
    }
    
    // 监听右键菜单点击事件
    chrome.contextMenus.onClicked.addListener(function(info, tab) {
        switch (info.menuItemId) {
            case 'quick-fill':
                handleQuickFill(tab);
                break;
                
            case 'save-xpath':
                handleSaveXpath(info, tab);
                break;
                
            case 'find-forms':
                handleFindForms(tab);
                break;
                
            case 'open-settings':
                chrome.action.openPopup();
                break;
                
            case 'view-history':
                handleViewHistory(tab);
                break;
                
            case 'export-config':
                handleExportConfig();
                break;
                
            case 'import-config':
                handleImportConfig();
                break;
        }
    });
    
    // 快速填写
    async function handleQuickFill(tab) {
        try {
            // 发送消息给content script
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'startAutoFill',
                config: {}
            });
            
            if (response && response.success) {
                showNotification('快速填写', '表单填写完成！');
            } else {
                showNotification('快速填写', response?.error || '填写失败');
            }
        } catch (error) {
            console.error('快速填写失败:', error);
            showNotification('快速填写失败', '请确保在表单页面使用');
        }
    }
    
    // 保存XPath
    async function handleSaveXpath(info, tab) {
        try {
            const selectionText = info.selectionText;
            if (!selectionText) {
                showNotification('保存XPath', '请先选中页面元素');
                return;
            }
            
            // 发送消息给content script获取XPath
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getElementXPath',
                text: selectionText
            });
            
            if (response && response.xpath) {
                // 保存到存储
                await saveXpathToConfig(response.xpath);
                showNotification('XPath已保存', response.xpath);
            }
        } catch (error) {
            console.error('保存XPath失败:', error);
        }
    }
    
    // 保存XPath到配置
    async function saveXpathToConfig(xpath) {
        try {
            const data = await chrome.storage.local.get(['configXpath']);
            const currentXpaths = data.configXpath || '';
            const newXpaths = currentXpaths + (currentXpaths ? '\n' : '') + xpath;
            
            await chrome.storage.local.set({ configXpath: newXpaths });
        } catch (error) {
            console.error('保存XPath到配置失败:', error);
        }
    }
    
    // 查找表单
    async function handleFindForms(tab) {
        try {
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'findForms'
            });
            
            if (response && response.forms) {
                showNotification('表单检测', `找到 ${response.forms.length} 个表单元素`);
            }
        } catch (error) {
            console.error('查找表单失败:', error);
        }
    }
    
    // 查看历史
    async function handleViewHistory(tab) {
        // 打开历史记录页面
        chrome.tabs.create({
            url: chrome.runtime.getURL('history.html'),
            active: true
        });
    }
    
    // 导出配置
    async function handleExportConfig() {
        try {
            const data = await chrome.storage.local.get(null);
            const configStr = JSON.stringify(data, null, 2);
            const blob = new Blob([configStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: url,
                filename: 'form-auto-fill-config.json',
                saveAs: true
            });
            
            showNotification('配置导出', '配置文件已开始下载');
        } catch (error) {
            console.error('导出配置失败:', error);
            showNotification('导出失败', error.message);
        }
    }
    
    // 导入配置
    async function handleImportConfig() {
        // 创建一个隐藏的文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    await chrome.storage.local.clear();
                    await chrome.storage.local.set(config);
                    
                    showNotification('配置导入', '配置导入成功！');
                    
                    // 发送配置更新消息
                    chrome.runtime.sendMessage({
                        action: 'configUpdated',
                        config: config
                    });
                    
                } catch (error) {
                    console.error('导入配置失败:', error);
                    showNotification('导入失败', '配置文件格式错误');
                }
            };
            
            reader.readAsText(file);
        };
        
        fileInput.click();
    }
    
    // 显示通知
    function showNotification(title, message) {
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: title,
                message: message,
                priority: 1
            });
        } else {
            console.log(`[${title}] ${message}`);
        }
    }
    
    // 监听扩展图标点击
    chrome.action.onClicked.addListener(function(tab) {
        // 默认行为已经在manifest中定义，这里可以添加额外逻辑
        console.log('扩展图标被点击', tab.url);
    });
    
    // 监听标签页更新
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
            // 页面加载完成，可以注入content script
            console.log('页面加载完成:', tab.url);
        }
    });
    
    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch (request.action) {
            case 'log':
                console.log('[Content Script]', request.message);
                break;
                
            case 'error':
                console.error('[Content Script Error]', request.error);
                break;
                
            case 'fillComplete':
                handleFillComplete(request, sender.tab);
                break;
                
            case 'fillError':
                handleFillError(request, sender.tab);
                break;
                
            case 'getConfig':
                chrome.storage.local.get(null).then(sendResponse);
                return true; // 保持消息通道开放
                
            case 'updateConfig':
                chrome.storage.local.set(request.config).then(() => {
                    sendResponse({ success: true });
                });
                return true; // 保持消息通道开放
        }
    });
    
    // 处理填写完成
    async function handleFillComplete(request, tab) {
        console.log('表单填写完成', request.result);
        
        // 更新历史记录
        const data = await chrome.storage.local.get(['fillHistory']);
        const history = data.fillHistory || [];
        
        history.push({
            timestamp: new Date().toISOString(),
            url: tab.url,
            result: request.result,
            success: true
        });
        
        // 只保留最近20条记录
        if (history.length > 20) {
            history.shift();
        }
        
        await chrome.storage.local.set({ fillHistory: history });
        
        // 显示通知
        showNotification('填写完成', `成功填写 ${request.result.filled}/${request.result.total} 个字段`);
    }
    
    // 处理填写错误
    async function handleFillError(request, tab) {
        console.error('表单填写错误', request.error);
        
        // 更新历史记录
        const data = await chrome.storage.local.get(['fillHistory']);
        const history = data.fillHistory || [];
        
        history.push({
            timestamp: new Date().toISOString(),
            url: tab.url,
            error: request.error,
            success: false
        });
        
        if (history.length > 20) {
            history.shift();
        }
        
        await chrome.storage.local.set({ fillHistory: history });
        
        // 显示错误通知
        showNotification('填写失败', request.error);
    }
    
    // 清理过期数据
    function cleanupOldData() {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        
        chrome.storage.local.get(['fillHistory'], function(data) {
            if (data.fillHistory) {
                const filteredHistory = data.fillHistory.filter(record => {
                    const recordTime = new Date(record.timestamp).getTime();
                    return recordTime > thirtyDaysAgo;
                });
                
                if (filteredHistory.length !== data.fillHistory.length) {
                    chrome.storage.local.set({ fillHistory: filteredHistory });
                    console.log('清理过期数据完成');
                }
            }
        });
    }
    
    // 定期清理（每天一次）
    chrome.alarms.create('cleanup', { periodInMinutes: 24 * 60 });
    chrome.alarms.onAlarm.addListener(function(alarm) {
        if (alarm.name === 'cleanup') {
            cleanupOldData();
        }
    });
    
    // 初始化
    console.log('表单自动填写助手后台服务已启动');
    
    // 检查权限
    chrome.permissions.contains({
        permissions: ['scripting', 'activeTab']
    }, function(result) {
        if (!result) {
            console.warn('缺少必要的权限');
        }
    });
    
    // 导出到全局对象，便于调试
    window.autoFillBackground = {
        cleanupOldData: cleanupOldData,
        showNotification: showNotification
    };
})();