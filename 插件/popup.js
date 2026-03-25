// 表单自动填写助手 - Popup界面逻辑
document.addEventListener('DOMContentLoaded', function() {
    // DOM元素引用
    const startFillBtn = document.getElementById('startFill');
    const saveConfigBtn = document.getElementById('saveConfig');
    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const historySection = document.getElementById('historySection');
    const statusSection = document.getElementById('statusSection');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    
    // 输入字段
    const teamNameInput = document.getElementById('teamName');
    const configXpathTextarea = document.getElementById('configXpath');
    const fillValueTextarea = document.getElementById('fillValue');
    const delayTimeInput = document.getElementById('delayTime');
    
    // 当前标签页
    let currentTab = null;
    
    // 初始化
    init();
    
    // 初始化函数
    async function init() {
        try {
            // 获取当前活动标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                currentTab = tabs[0];
                updateStatus('已连接到页面: ' + (currentTab.url || '未知页面'), 'success');
            } else {
                updateStatus('无法获取当前页面', 'error');
                startFillBtn.disabled = true;
            }
            
            // 从存储中加载配置
            await loadConfig();
            
            // 加载填写历史
            await loadHistory();
            
        } catch (error) {
            console.error('初始化失败:', error);
            updateStatus('初始化失败: ' + error.message, 'error');
        }
    }
    
    // 从chrome.storage加载配置
    async function loadConfig() {
        try {
            const data = await chrome.storage.local.get([
                'teamName',
                'configXpath',
                'fillValue',
                'delayTime'
            ]);
            
            if (data.teamName) teamNameInput.value = data.teamName;
            if (data.configXpath) configXpathTextarea.value = data.configXpath;
            if (data.fillValue) fillValueTextarea.value = data.fillValue;
            if (data.delayTime) delayTimeInput.value = data.delayTime;
            
            console.log('配置加载成功');
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }
    
    // 保存配置到chrome.storage
    async function saveConfig() {
        try {
            const config = {
                teamName: teamNameInput.value.trim(),
                configXpath: configXpathTextarea.value.trim(),
                fillValue: fillValueTextarea.value.trim(),
                delayTime: parseInt(delayTimeInput.value) || 1000
            };
            
            await chrome.storage.local.set(config);
            updateStatus('配置已保存', 'success');
            
            // 显示成功状态3秒
            setTimeout(() => {
                updateStatus('准备就绪', 'success');
            }, 2000);
            
        } catch (error) {
            console.error('保存配置失败:', error);
            updateStatus('保存失败: ' + error.message, 'error');
        }
    }
    
    // 加载填写历史
    async function loadHistory() {
        try {
            const data = await chrome.storage.local.get(['fillHistory']);
            const history = data.fillHistory || [];
            
            // 清空历史容器
            historySection.innerHTML = '';
            
            if (history.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'history-item';
                emptyItem.textContent = '暂无填写记录';
                emptyItem.style.opacity = '0.5';
                emptyItem.style.fontStyle = 'italic';
                historySection.appendChild(emptyItem);
                return;
            }
            
            // 显示最近5条记录
            const recentHistory = history.slice(-5).reverse();
            
            recentHistory.forEach((record, index) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const time = new Date(record.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const url = record.url ? new URL(record.url).hostname : '未知页面';
                const success = record.success ? '✅' : '❌';
                
                historyItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 500;">${time}</span>
                        <span>${success}</span>
                    </div>
                    <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${url}</div>
                `;
                
                historySection.appendChild(historyItem);
            });
            
        } catch (error) {
            console.error('加载历史失败:', error);
        }
    }
    
    // 保存历史记录
    async function saveHistory(record) {
        try {
            const data = await chrome.storage.local.get(['fillHistory']);
            const history = data.fillHistory || [];
            
            // 最多保存20条记录
            if (history.length >= 20) {
                history.shift();
            }
            
            history.push({
                ...record,
                timestamp: new Date().toISOString()
            });
            
            await chrome.storage.local.set({ fillHistory: history });
            
            // 重新加载历史显示
            await loadHistory();
            
        } catch (error) {
            console.error('保存历史失败:', error);
        }
    }
    
    // 开始填写表单
    async function startFilling() {
        if (!currentTab) {
            updateStatus('未找到活动页面', 'error');
            return;
        }
        
        updateStatus('正在填写表单...', 'loading');
        
        try {
            const config = {
                teamName: teamNameInput.value.trim(),
                configXpath: configXpathTextarea.value.trim(),
                fillValue: fillValueTextarea.value.trim(),
                delayTime: parseInt(delayTimeInput.value) || 1000
            };
            
            // 验证配置
            if (!config.teamName) {
                updateStatus('请填写队名', 'error');
                return;
            }
            
            if (!config.configXpath) {
                updateStatus('请配置XPath', 'error');
                return;
            }
            
            // 发送消息给content script
            const response = await chrome.tabs.sendMessage(currentTab.id, {
                action: 'startAutoFill',
                config: config
            });
            
            if (response && response.success) {
                updateStatus('表单填写成功！', 'success');
                
                // 保存成功记录
                await saveHistory({
                    success: true,
                    url: currentTab.url,
                    teamName: config.teamName
                });
                
            } else {
                throw new Error(response?.error || '未知错误');
            }
            
        } catch (error) {
            console.error('填写表单失败:', error);
            updateStatus('填写失败: ' + error.message, 'error');
            
            // 保存失败记录
            await saveHistory({
                success: false,
                url: currentTab.url,
                error: error.message
            });
            
            // 可能是content script未加载，尝试注入
            if (error.message.includes('Receiving end does not exist')) {
                updateStatus('正在注入脚本...', 'loading');
                await injectContentScript();
            }
        }
    }
    
    // 注入content script
    async function injectContentScript() {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content_script.js']
            });
            
            updateStatus('脚本注入成功，请重试', 'success');
            
        } catch (error) {
            updateStatus('注入失败: ' + error.message, 'error');
        }
    }
    
    // 更新状态显示
    function updateStatus(text, type = 'success') {
        statusSection.classList.add('visible');
        statusText.textContent = text;
        
        // 设置状态图标
        statusIcon.className = 'status-icon';
        if (type === 'success') {
            statusIcon.classList.add('success');
        } else if (type === 'error') {
            statusIcon.classList.add('error');
        } else if (type === 'loading') {
            statusIcon.classList.add('loading');
        }
    }
    
    // 事件监听
    startFillBtn.addEventListener('click', startFilling);
    saveConfigBtn.addEventListener('click', saveConfig);
    
    toggleHistoryBtn.addEventListener('click', function() {
        const isExpanded = historySection.classList.contains('expanded');
        
        if (isExpanded) {
            historySection.classList.remove('expanded');
            toggleHistoryBtn.innerHTML = '▼ 查看填写历史';
        } else {
            historySection.classList.add('expanded');
            toggleHistoryBtn.innerHTML = '▲ 收起历史';
        }
    });
    
    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'fillComplete') {
            updateStatus('填写完成！', 'success');
        } else if (request.action === 'fillProgress') {
            updateStatus(`正在填写: ${request.message}`, 'loading');
        } else if (request.action === 'fillError') {
            updateStatus(`错误: ${request.error}`, 'error');
        }
    });
    
    // 键盘快捷键支持
    document.addEventListener('keydown', function(event) {
        // Ctrl + S 保存配置
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            saveConfig();
        }
        
        // Ctrl + Enter 开始填写
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            startFilling();
        }
    });
    
    // 自动保存配置（防丢失）
    let saveTimeout = null;
    [teamNameInput, configXpathTextarea, fillValueTextarea, delayTimeInput].forEach(input => {
        input.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveConfig, 2000);
        });
    });
});