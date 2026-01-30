document.addEventListener('DOMContentLoaded', function() {
  // DOM元素
  const apiProvider = document.getElementById('apiProvider');
  const apiConfigs = document.querySelectorAll('.api-config');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');
  
  // 加载设置
  loadSettings();
  
  // API提供商变化时显示对应的配置
  apiProvider.addEventListener('change', function() {
    apiConfigs.forEach(config => config.style.display = 'none');
    const selectedConfig = document.getElementById(`${this.value}Config`);
    if (selectedConfig) selectedConfig.style.display = 'block';
  });
  
  // 保存设置
  saveBtn.addEventListener('click', saveSettings);
  
  // 测试分析
  testBtn.addEventListener('click', testAnalysis);
  
  function loadSettings() {
    chrome.storage.sync.get({
      // API设置
      apiProvider: 'newsapi',
      newsapiKey: '',
      serpapiKey: '',
      bingKey: '',
      
      // 搜索设置
      timeRange: '24h',
      pageSize: 10,
      
      // 新闻来源
      sources: {
        bbc: true,
        cnn: true,
        reuters: true,
        xinhua: false,
        nyt: true,
        guardian: true
      },
      
      // 分析选项
      enableSentiment: true,
      enableBias: true,
      enableTimeline: true,
      enableKeywords: true
    }, function(settings) {
      // 设置API提供商
      apiProvider.value = settings.apiProvider;
      document.getElementById(`${settings.apiProvider}Config`).style.display = 'block';
      
      // 设置API密钥
      document.getElementById('newsapiKey').value = settings.newsapiKey || '';
      document.getElementById('serpapiKey').value = settings.serpapiKey || '';
      
      // 设置搜索选项
      document.getElementById('timeRange').value = settings.timeRange;
      document.getElementById('pageSize').value = settings.pageSize;
      
      // 设置新闻来源
      Object.keys(settings.sources).forEach(source => {
        const checkbox = document.getElementById(`source${source.charAt(0).toUpperCase() + source.slice(1)}`);
        if (checkbox) checkbox.checked = settings.sources[source];
      });
      
      // 设置分析选项
      document.getElementById('enableSentiment').checked = settings.enableSentiment;
      document.getElementById('enableBias').checked = settings.enableBias;
      document.getElementById('enableTimeline').checked = settings.enableTimeline;
      document.getElementById('enableKeywords').checked = settings.enableKeywords;
    });
  }
  
  function saveSettings() {
    const sources = {};
    document.querySelectorAll('input[type="checkbox"][id^="source"]').forEach(checkbox => {
      const sourceName = checkbox.id.replace('source', '').toLowerCase();
      sources[sourceName] = checkbox.checked;
    });
    
    const settings = {
      // API设置
      apiProvider: apiProvider.value,
      newsapiKey: document.getElementById('newsapiKey').value.trim(),
      serpapiKey: document.getElementById('serpapiKey').value.trim(),
      
      // 搜索设置
      timeRange: document.getElementById('timeRange').value,
      pageSize: parseInt(document.getElementById('pageSize').value),
      
      // 新闻来源
      sources: sources,
      
      // 分析选项
      enableSentiment: document.getElementById('enableSentiment').checked,
      enableBias: document.getElementById('enableBias').checked,
      enableTimeline: document.getElementById('enableTimeline').checked,
      enableKeywords: document.getElementById('enableKeywords').checked
    };
    
    chrome.storage.sync.set(settings, function() {
      showStatus('设置保存成功！', 'success');
      
      // 通知background脚本设置已更新
      chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        settings: settings
      });
    });
  }
  
  function testAnalysis() {
    const testQuery = "中美贸易关系最新进展";
    
    chrome.runtime.sendMessage({
      action: 'searchNews',
      query: testQuery,
      testMode: true
    }, function(response) {
      if (response && response.success) {
        showStatus(`测试成功！找到 ${response.count} 条相关新闻`, 'success');
        
        // 打开一个示例弹窗展示效果
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showSampleAnalysis',
            query: testQuery,
            articles: response.articles.slice(0, 3)
          });
        });
      } else {
        showStatus('测试失败：' + (response?.error || '请检查API密钥设置'), 'error');
      }
    });
  }
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 5000);
  }
});