// 填写历史页面逻辑
document.addEventListener('DOMContentLoaded', function() {
    // DOM元素引用
    const statsCards = document.getElementById('statsCards');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const filterStatus = document.getElementById('filterStatus');
    const filterDate = document.getElementById('filterDate');
    const searchInput = document.getElementById('searchInput');
    const historyTable = document.getElementById('historyTable');
    const historyTableBody = document.getElementById('historyTableBody');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');
    const detailsPanel = document.getElementById('detailsPanel');
    const detailsOverlay = document.getElementById('detailsOverlay');
    const closeDetailsBtn = document.getElementById('closeDetailsBtn');
    const detailsContent = document.getElementById('detailsContent');
    
    // 全局变量
    let allHistory = [];
    let filteredHistory = [];
    let currentPage = 1;
    const pageSize = 10;
    
    // 初始化
    init();
    
    // 初始化函数
    async function init() {
        await loadHistory();
        setupEventListeners();
    }
    
    // 加载历史数据
    async function loadHistory() {
        showLoading();
        
        try {
            const data = await chrome.storage.local.get(['fillHistory']);
            allHistory = data.fillHistory || [];
            
            // 按时间倒序排序
            allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            updateStatistics();
            applyFilters();
            
        } catch (error) {
            console.error('加载历史数据失败:', error);
            showError('加载历史数据失败');
        } finally {
            hideLoading();
        }
    }
    
    // 更新统计信息
    function updateStatistics() {
        if (allHistory.length === 0) {
            statsCards.innerHTML = `
                <div class="stat-card total">
                    <div class="stat-label">📊 总记录数</div>
                    <div class="stat-value">0</div>
                </div>
            `;
            return;
        }
        
        const total = allHistory.length;
        const success = allHistory.filter(record => record.success).length;
        const error = allHistory.filter(record => !record.success).length;
        const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;
        
        // 最近7天统计
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = allHistory.filter(record => 
            new Date(record.timestamp) > sevenDaysAgo
        ).length;
        
        statsCards.innerHTML = `
            <div class="stat-card total">
                <div class="stat-label">📊 总记录数</div>
                <div class="stat-value">${total}</div>
            </div>
            
            <div class="stat-card success">
                <div class="stat-label">✅ 成功次数</div>
                <div class="stat-value">${success}</div>
            </div>
            
            <div class="stat-card error">
                <div class="stat-label">❌ 失败次数</div>
                <div class="stat-value">${error}</div>
            </div>
            
            <div class="stat-card success">
                <div class="stat-label">📈 成功率</div>
                <div class="stat-value">${successRate}%</div>
            </div>
            
            <div class="stat-card total">
                <div class="stat-label">📅 最近7天</div>
                <div class="stat-value">${recent}</div>
            </div>
        `;
    }
    
    // 应用筛选条件
    function applyFilters() {
        let filtered = [...allHistory];
        
        // 按状态筛选
        const status = filterStatus.value;
        if (status !== 'all') {
            filtered = filtered.filter(record => 
                status === 'success' ? record.success : !record.success
            );
        }
        
        // 按日期筛选
        const date = filterDate.value;
        if (date) {
            const selectedDate = new Date(date);
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            filtered = filtered.filter(record => {
                const recordDate = new Date(record.timestamp);
                return recordDate >= selectedDate && recordDate < nextDay;
            });
        }
        
        // 按搜索关键词筛选
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(record => {
                const searchFields = [
                    record.url || '',
                    record.teamName || '',
                    record.error || '',
                    JSON.stringify(record.result || {})
                ];
                
                return searchFields.some(field => 
                    field.toLowerCase().includes(searchTerm)
                );
            });
        }
        
        filteredHistory = filtered;
        currentPage = 1;
        renderTable();
        renderPagination();
    }
    
    // 渲染表格
    function renderTable() {
        if (filteredHistory.length === 0) {
            historyTable.style.display = 'none';
            pagination.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        historyTable.style.display = 'table';
        
        // 计算分页
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageData = filteredHistory.slice(startIndex, endIndex);
        
        // 清空表格
        historyTableBody.innerHTML = '';
        
        // 填充数据
        pageData.forEach((record, index) => {
            const row = createTableRow(record, startIndex + index);
            historyTableBody.appendChild(row);
        });
    }
    
    // 创建表格行
    function createTableRow(record, index) {
        const row = document.createElement('tr');
        
        // 格式化时间
        const time = new Date(record.timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 状态标签
        const statusClass = record.success ? 'status-success' : 'status-error';
        const statusText = record.success ? '✅ 成功' : '❌ 失败';
        const statusBadge = `<span class="status-badge ${statusClass}">${statusText}</span>`;
        
        // 填写数量
        let fillCount = '-';
        if (record.success && record.result) {
            const filled = record.result.filled || 0;
            const total = record.result.total || 0;
            fillCount = `${filled}/${total}`;
        } else if (record.error) {
            fillCount = '0';
        }
        
        // URL显示
        let urlDisplay = '-';
        if (record.url) {
            try {
                const urlObj = new URL(record.url);
                urlDisplay = urlObj.hostname + urlObj.pathname.substring(0, 30);
                if (urlObj.pathname.length > 30) {
                    urlDisplay += '...';
                }
            } catch (e) {
                urlDisplay = record.url.substring(0, 50);
                if (record.url.length > 50) {
                    urlDisplay += '...';
                }
            }
        }
        
        // 队名
        const teamName = record.teamName || '-';
        
        row.innerHTML = `
            <td>${time}</td>
            <td>${statusBadge}</td>
            <td>${fillCount}</td>
            <td class="url-cell" title="${record.url || ''}">
                ${record.url ? `<a href="${record.url}" target="_blank">${urlDisplay}</a>` : urlDisplay}
            </td>
            <td title="${teamName}">${teamName}</td>
            <td>
                <button class="btn btn-secondary" onclick="showDetails(${index})" style="padding: 4px 8px; font-size: 12px;">
                    详情
                </button>
            </td>
        `;
        
        return row;
    }
    
    // 渲染分页
    function renderPagination() {
        if (filteredHistory.length <= pageSize) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        const totalPages = Math.ceil(filteredHistory.length / pageSize);
        
        // 分页HTML
        let paginationHTML = '';
        
        // 上一页按钮
        paginationHTML += `
            <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                ←
            </button>
        `;
        
        // 页码按钮
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button onclick="goToPage(${i})" ${i === currentPage ? 'class="active"' : ''}>
                    ${i}
                </button>
            `;
        }
        
        // 下一页按钮
        paginationHTML += `
            <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                →
            </button>
        `;
        
        // 总页数显示
        paginationHTML += `
            <span style="margin-left: 10px; color: #718096; font-size: 13px;">
                共 ${totalPages} 页
            </span>
        `;
        
        pagination.innerHTML = paginationHTML;
    }
    
    // 跳转到指定页面
    window.goToPage = function(page) {
        if (page < 1 || page > Math.ceil(filteredHistory.length / pageSize)) {
            return;
        }
        
        currentPage = page;
        renderTable();
        renderPagination();
    };
    
    // 显示记录详情
    window.showDetails = function(index) {
        const record = filteredHistory[index];
        if (!record) return;
        
        // 格式化详细信息
        let detailsHTML = '';
        
        detailsHTML += `
            <div class="details-section">
                <h3>基本信息</h3>
                <ul>
                    <li><strong>时间：</strong>${new Date(record.timestamp).toLocaleString('zh-CN')}</li>
                    <li><strong>状态：</strong>${record.success ? '✅ 成功' : '❌ 失败'}</li>
                    ${record.teamName ? `<li><strong>队名：</strong>${record.teamName}</li>` : ''}
                    ${record.url ? `<li><strong>URL：</strong><a href="${record.url}" target="_blank">${record.url}</a></li>` : ''}
                </ul>
            </div>
        `;
        
        if (record.success && record.result) {
            detailsHTML += `
                <div class="details-section">
                    <h3>填写结果</h3>
                    <ul>
                        <li><strong>填写数量：</strong>${record.result.filled}/${record.result.total}</li>
                        <li><strong>成功率：</strong>${record.result.total > 0 ? ((record.result.filled / record.result.total) * 100).toFixed(1) : 0}%</li>
                    </ul>
                </div>
            `;
            
            if (record.result.details && record.result.details.length > 0) {
                detailsHTML += `
                    <div class="details-section">
                        <h3>详细字段</h3>
                        <ul>
                `;
                
                record.result.details.forEach((detail, idx) => {
                    const status = detail.success ? '✅' : '❌';
                    detailsHTML += `
                        <li>
                            <strong>${idx + 1}. ${status}</strong><br>
                            <small>XPath: ${detail.xpath || 'N/A'}</small><br>
                            <small>值: ${detail.value || 'N/A'}</small>
                            ${detail.error ? `<br><small style="color: #e53e3e;">错误: ${detail.error}</small>` : ''}
                        </li>
                    `;
                });
                
                detailsHTML += `
                        </ul>
                    </div>
                `;
            }
        }
        
        if (!record.success && record.error) {
            detailsHTML += `
                <div class="details-section">
                    <h3>错误信息</h3>
                    <p style="color: #e53e3e; background: #fed7d7; padding: 10px; border-radius: 6px;">
                        ${record.error}
                    </p>
                </div>
            `;
        }
        
        // 显示详情面板
        detailsContent.innerHTML = detailsHTML;
        detailsPanel.classList.add('active');
        detailsOverlay.classList.add('active');
    };
    
    // 导出历史数据
    async function exportHistory() {
        if (filteredHistory.length === 0) {
            alert('没有可导出的数据');
            return;
        }
        
        try {
            const exportData = {
                exportTime: new Date().toISOString(),
                totalRecords: filteredHistory.length,
                data: filteredHistory
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `form-fill-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage('导出成功', 'success');
        } catch (error) {
            console.error('导出失败:', error);
            showMessage('导出失败: ' + error.message, 'error');
        }
    }
    
    // 清空历史数据
    async function clearHistory() {
        if (!confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            await chrome.storage.local.set({ fillHistory: [] });
            await loadHistory();
            showMessage('历史记录已清空', 'success');
        } catch (error) {
            console.error('清空历史失败:', error);
            showMessage('清空失败: ' + error.message, 'error');
        }
    }
    
    // 显示加载状态
    function showLoading() {
        loadingIndicator.style.display = 'block';
        historyTable.style.display = 'none';
        emptyState.style.display = 'none';
        pagination.style.display = 'none';
    }
    
    // 隐藏加载状态
    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }
    
    // 显示错误
    function showError(message) {
        emptyState.innerHTML = `
            <div>❌</div>
            <p>${message}</p>
        `;
        emptyState.style.display = 'block';
        historyTable.style.display = 'none';
    }
    
    // 显示消息
    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageDiv.remove(), 300);
        }, 3000);
    }
    
    // 设置事件监听
    function setupEventListeners() {
        // 刷新按钮
        refreshBtn.addEventListener('click', loadHistory);
        
        // 导出按钮
        exportBtn.addEventListener('click', exportHistory);
        
        // 清空按钮
        clearBtn.addEventListener('click', clearHistory);
        
        // 筛选器
        filterStatus.addEventListener('change', applyFilters);
        filterDate.addEventListener('change', applyFilters);
        searchInput.addEventListener('input', debounce(applyFilters, 300));
        
        // 详情面板关闭
        closeDetailsBtn.addEventListener('click', closeDetailsPanel);
        detailsOverlay.addEventListener('click', closeDetailsPanel);
        
        // ESC键关闭详情面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDetailsPanel();
            }
        });
        
        // 快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+R 刷新
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                loadHistory();
            }
            
            // Ctrl+E 导出
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                exportHistory();
            }
        });
    }
    
    // 关闭详情面板
    function closeDetailsPanel() {
        detailsPanel.classList.remove('active');
        detailsOverlay.classList.remove('active');
    }
    
    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});