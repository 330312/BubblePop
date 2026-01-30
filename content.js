// 新闻分析插件核心逻辑 - 增强版
class NewsAnalyzer {
  constructor() {
    this.currentPopup = null;
    this.lastSelection = '';
    this.selectionTimeout = null;
    this.injectStyles();
    this.showWelcomeHint();  // 显示使用提示
    this.setupEventListeners();
    console.log('新闻分析插件已加载');
  }
  
  // 显示使用提示
  showWelcomeHint() {
    const hint = document.createElement('div');
    hint.id = 'news-analyzer-hint';
    hint.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 300px;
      animation: fadeIn 0.5s;
      cursor: pointer;
      border: 2px solid white;
    `;
    
    hint.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
        <span>📰</span>
        <span>新闻分析插件已就绪！</span>
      </div>
      <div style="font-size:14px;margin-bottom:10px;">
        <strong>使用方法：</strong>
        <ol style="margin:5px 0;padding-left:20px;">
          <li>选中新闻标题或文本</li>
          <li>等待1秒钟</li>
          <li>查看分析结果</li>
        </ol>
      </div>
      <div style="text-align:center;">
        <button style="background:white;color:#667eea;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-weight:bold;">
          点击隐藏
        </button>
      </div>
    `;
    
    document.body.appendChild(hint);
    
    // 5秒后自动隐藏
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 500);
    }, 5000);
    
    // 点击隐藏
    hint.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 500);
      }
    });
  }
  
  // 注入样式
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
        100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
      }
      
      /* 新闻分析弹窗 */
      .news-analysis-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        background: white;
        border-radius: 15px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 99999;
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.3s ease;
        overflow: hidden;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -40%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }
      
      .analysis-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .analysis-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .analysis-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.3s;
      }
      
      .analysis-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .analysis-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }
      
      /* 查询显示 */
      .query-display {
        background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        border-left: 5px solid #667eea;
        animation: pulse 2s infinite;
      }
      
      .query-text {
        font-size: 18px;
        color: #333;
        margin-bottom: 5px;
        font-weight: 500;
      }
      
      .query-meta {
        font-size: 14px;
        color: #666;
        display: flex;
        gap: 15px;
      }
      
      /* 加载动画 */
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }
      
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .loading-text {
        color: #666;
        font-size: 16px;
        margin-bottom: 10px;
      }
      
      /* 新闻文章卡片 */
      .news-article {
        background: white;
        border: 2px solid #f0f0f0;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .news-article:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        border-color: #667eea;
      }
      
      .news-article::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 5px;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      .article-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .source-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .source-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
      }
      
      .source-details {
        display: flex;
        flex-direction: column;
      }
      
      .source-name {
        font-weight: bold;
        color: #333;
        font-size: 16px;
      }
      
      .source-country {
        font-size: 12px;
        color: #888;
      }
      
      .article-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
      }
      
      .article-date {
        font-size: 13px;
        color: #888;
      }
      
      .article-bias {
        padding: 3px 10px;
        background: #f0f5ff;
        border-radius: 20px;
        font-size: 12px;
        color: #667eea;
      }
      
      .article-title {
        font-size: 16px;
        color: #2c3e50;
        margin: 10px 0;
        line-height: 1.5;
        font-weight: 500;
      }
      
      .article-description {
        font-size: 14px;
        color: #666;
        line-height: 1.6;
        margin-bottom: 15px;
      }
      
      .article-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 15px;
        border-top: 1px solid #f0f0f0;
      }
      
      .sentiment-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .sentiment-label {
        font-size: 13px;
        color: #888;
      }
      
      .sentiment-value {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
      }
      
      .sentiment-positive {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      .sentiment-neutral {
        background: #fff3e0;
        color: #f57c00;
      }
      
      .sentiment-negative {
        background: #ffebee;
        color: #c62828;
      }
      
      .article-link {
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 5px;
        text-decoration: none;
        font-size: 13px;
        transition: transform 0.2s;
      }
      
      .article-link:hover {
        transform: translateY(-2px);
      }
      
      /* 摘要分析 */
      .summary-container {
        background: linear-gradient(135deg, #667eea05 0%, #764ba205 100%);
        padding: 25px;
        border-radius: 12px;
        margin: 20px 0;
        border: 1px solid #e8e8e8;
      }
      
      .summary-title {
        font-size: 17px;
        font-weight: 600;
        margin-bottom: 20px;
        color: #2c3e50;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }
      
      .summary-item {
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        transition: transform 0.3s;
      }
      
      .summary-item:hover {
        transform: translateY(-2px);
      }
      
      .summary-label {
        font-size: 13px;
        color: #888;
        margin-bottom: 5px;
      }
      
      .summary-value {
        font-size: 18px;
        font-weight: bold;
        color: #667eea;
      }
      
      /* 操作按钮 */
      .action-buttons {
        display: flex;
        gap: 10px;
        padding: 20px;
        background: #f8f9fa;
        border-top: 1px solid #e8e8e8;
      }
      
      .action-btn {
        flex: 1;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        background: white;
        color: #667eea;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s;
        font-weight: 500;
      }
      
      .action-btn:hover {
        background: #667eea;
        color: white;
        transform: translateY(-2px);
      }
      
      /* 选中文本高亮 */
      .selection-highlight {
        background-color: rgba(255, 215, 0, 0.4) !important;
        border-radius: 3px;
        padding: 2px 0;
        transition: background-color 0.3s;
        animation: highlightPulse 2s infinite;
      }
      
      @keyframes highlightPulse {
        0% { background-color: rgba(255, 215, 0, 0.3); }
        50% { background-color: rgba(255, 215, 0, 0.6); }
        100% { background-color: rgba(255, 215, 0, 0.3); }
      }
      
      /* 滚动条样式 */
      .analysis-content::-webkit-scrollbar {
        width: 8px;
      }
      
      .analysis-content::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      .analysis-content::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 4px;
      }
      
      .analysis-content::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #5a6fd8 0%, #6a4499 100%);
      }
    `;
    document.head.appendChild(style);
  }
  
  setupEventListeners() {
    document.addEventListener('mouseup', this.handleSelection.bind(this));
    document.addEventListener('mousedown', this.handleClickOutside.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // 添加右键菜单
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }
  
  handleSelection(event) {
    // 防止在弹窗内触发
    if (this.currentPopup && this.currentPopup.contains(event.target)) {
      return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selectedText.length > 3 && selectedText !== this.lastSelection) {
      this.lastSelection = selectedText;
      
      // 清除之前的计时器
      if (this.selectionTimeout) {
        clearTimeout(this.selectionTimeout);
      }
      
      // 高亮选中的文本
      this.highlightSelection(selection);
      
      // 显示提示
      this.showSelectionHint(event.pageX, event.pageY, selectedText);
      
      // 延迟执行分析
      this.selectionTimeout = setTimeout(() => {
        this.analyzeNews(selectedText);
        // 移除提示
        const hint = document.getElementById('selection-hint');
        if (hint) hint.remove();
      }, 1000);
    }
  }
  
  // 显示选择提示
  showSelectionHint(x, y, text) {
    // 移除旧的提示
    const oldHint = document.getElementById('selection-hint');
    if (oldHint) oldHint.remove();
    
    const hint = document.createElement('div');
    hint.id = 'selection-hint';
    hint.style.cssText = `
      position: absolute;
      left: ${x + 15}px;
      top: ${y + 15}px;
      background: #667eea;
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 13px;
      z-index: 99998;
      animation: fadeIn 0.3s;
      white-space: nowrap;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    hint.innerHTML = `
      <span>🔍 正在分析...</span>
      <span style="opacity:0.8;">"${this.truncateText(text, 15)}"</span>
    `;
    
    document.body.appendChild(hint);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (hint.parentElement) {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 300);
      }
    }, 3000);
  }
  
  highlightSelection(selection) {
    // 移除之前的高亮
    document.querySelectorAll('.selection-highlight').forEach(el => {
      el.classList.remove('selection-highlight');
    });
    
    try {
      const range = selection.getRangeAt(0);
      if (range.collapsed) return;
      
      // 保存原始HTML
      const originalHTML = range.cloneContents();
      
      // 创建高亮容器
      const span = document.createElement('span');
      span.className = 'selection-highlight';
      
      try {
        // 尝试包围内容
        range.surroundContents(span);
      } catch (e) {
        // 如果失败，使用替代方法
        range.extractContents();
        span.appendChild(originalHTML);
        range.insertNode(span);
      }
    } catch (error) {
      console.log('高亮失败（可能是跨元素选择）:', error);
    }
  }
  
  async analyzeNews(query) {
    this.showLoadingPopup(query);
    
    // 使用模拟数据（避免API依赖）
    setTimeout(() => {
      const mockArticles = this.generateMockArticles(query);
      this.showAnalysisResults(query, mockArticles);
    }, 1500);
  }
  
  generateMockArticles(query) {
    const sources = [
      { 
        name: 'BBC新闻', 
        country: '英国 🇬🇧', 
        bias: '中立偏左',
        color: '#FF0000',
        avatar: 'BBC'
      },
      { 
        name: 'CNN', 
        country: '美国 🇺🇸', 
        bias: '偏左',
        color: '#CC0000',
        avatar: 'CNN'
      },
      { 
        name: '路透社', 
        country: '国际 🌍', 
        bias: '中立',
        color: '#FF6B00',
        avatar: 'RT'
      },
      { 
        name: '新华社', 
        country: '中国 🇨🇳', 
        bias: '官方立场',
        color: '#DE2910',
        avatar: 'XH'
      },
      { 
        name: '纽约时报', 
        country: '美国 🇺🇸', 
        bias: '偏左',
        color: '#000000',
        avatar: 'NYT'
      },
      { 
        name: '卫报', 
        country: '英国 🇬🇧', 
        bias: '偏左',
        color: '#052962',
        avatar: 'GD'
      },
      { 
        name: '华尔街日报', 
        country: '美国 🇺🇸', 
        bias: '偏右',
        color: '#0072B5',
        avatar: 'WSJ'
      },
      { 
        name: '朝日新闻', 
        country: '日本 🇯🇵', 
        bias: '中间偏左',
        color: '#0B3D91',
        avatar: 'AJ'
      }
    ];
    
    const sentiments = ['positive', 'neutral', 'negative'];
    const sentimentTexts = {
      'positive': '正面',
      'neutral': '中性', 
      'negative': '负面'
    };
    
    const articles = [];
    const count = Math.min(6, Math.floor(Math.random() * 5) + 3); // 3-6篇文章
    
    for (let i = 0; i < count; i++) {
      const source = sources[i % sources.length];
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      const hoursAgo = Math.floor(Math.random() * 48);
      
      const titles = [
        `"${query}"最新进展：${source.name}独家报道`,
        `深度分析：${query}的全球影响`,
        `${source.name}观察：${query}的多个维度`,
        `专家解读${query}，${source.country}视角`,
        `关于${query}，你需要知道的五个事实`,
        `${query}追踪报道：${source.name}现场直击`
      ];
      
      const descriptions = [
        `${source.name}记者深入调查发现，关于"${query}"的情况比预期更复杂。`,
        `在${source.country}的报道中，"${query}"呈现出不同的发展态势。`,
        `${source.name}分析指出，这一事件可能对未来产生深远影响。`,
        `专家在接受${source.name}采访时表示，"${query}"需要多方关注。`,
        `${source.name}的最新报道揭示了"${query}"背后的关键信息。`
      ];
      
      articles.push({
        source: source,
        title: titles[Math.floor(Math.random() * titles.length)],
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        publishedAt: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
        url: `https://${source.name.toLowerCase().replace(/\s+/g, '')}.com/news/${Date.now()}`,
        sentiment: sentiment,
        sentimentText: sentimentTexts[sentiment],
        sentimentScore: sentiment === 'positive' ? 0.8 : sentiment === 'neutral' ? 0.1 : -0.7
      });
    }
    
    return articles;
  }
  
  showLoadingPopup(query) {
    this.removePopup();
    
    this.currentPopup = document.createElement('div');
    this.currentPopup.className = 'news-analysis-popup';
    
    this.currentPopup.innerHTML = `
      <div class="analysis-header">
        <div class="analysis-title">
          <span>🔍</span>
          <span>正在分析新闻报道</span>
        </div>
        <button class="analysis-close">×</button>
      </div>
      <div class="analysis-content">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在搜索全球媒体报道...</div>
          <div class="query-display">
            <div class="query-text">"${query}"</div>
            <div class="query-meta">
              <span>🔍 搜索中...</span>
              <span>🌍 全球媒体</span>
              <span>📊 分析观点</span>
            </div>
          </div>
          <div style="color:#888;font-size:14px;margin-top:20px;">
            正在分析不同媒体的报道角度和立场...
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.currentPopup);
    
    // 添加关闭按钮事件
    this.currentPopup.querySelector('.analysis-close').addEventListener('click', () => {
      this.removePopup();
    });
  }
  
  showAnalysisResults(query, articles) {
    if (!this.currentPopup) return;
    
    // 生成摘要统计
    const summary = this.generateSummary(articles);
    
    // 生成时间线
    const timeline = this.generateTimeline(articles);
    
    let articlesHTML = '';
    articles.forEach((article, index) => {
      articlesHTML += `
        <div class="news-article">
          <div class="article-header">
            <div class="source-info">
              <div class="source-avatar" style="background:${article.source.color}">
                ${article.source.avatar}
              </div>
              <div class="source-details">
                <div class="source-name">${article.source.name}</div>
                <div class="source-country">${article.source.country}</div>
              </div>
            </div>
            <div class="article-meta">
              <div class="article-date">
                ${new Date(article.publishedAt).toLocaleString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div class="article-bias">${article.source.bias}</div>
            </div>
          </div>
          <div class="article-title">${article.title}</div>
          <div class="article-description">${article.description}</div>
          <div class="article-footer">
            <div class="sentiment-indicator">
              <span class="sentiment-label">情感分析：</span>
              <span class="sentiment-value sentiment-${article.sentiment}">
                ${article.sentimentText}
              </span>
            </div>
            <a href="${article.url}" target="_blank" class="article-link">
              阅读原文 →
            </a>
          </div>
        </div>
      `;
    });
    
    this.currentPopup.innerHTML = `
      <div class="analysis-header">
        <div class="analysis-title">
          <span>📊</span>
          <span>新闻观点分析报告</span>
        </div>
        <button class="analysis-close">×</button>
      </div>
      <div class="analysis-content">
        <div class="query-display">
          <div class="query-text">分析查询：${query}</div>
          <div class="query-meta">
            <span>📰 ${articles.length} 篇报道</span>
            <span>🌍 ${new Set(articles.map(a => a.source.country)).size} 个国家/地区</span>
            <span>🏢 ${new Set(articles.map(a => a.source.name)).size} 家媒体</span>
          </div>
        </div>
        
        ${summary}
        
        <div style="font-size:16px;font-weight:600;margin:25px 0 15px;color:#2c3e50;display:flex;align-items:center;gap:10px;">
          <span>📰</span>
          <span>相关新闻报道</span>
        </div>
        
        ${articlesHTML}
        
        ${timeline}
      </div>
      <div class="action-buttons">
        <button class="action-btn" id="copySummary">
          <span>📋</span>
          复制摘要
        </button>
        <button class="action-btn" id="exportReport">
          <span>💾</span>
          导出报告
        </button>
        <button class="action-btn" id="closeAnalysis">
          <span>❌</span>
          关闭分析
        </button>
      </div>
    `;
    
    this.addResultEventListeners();
  }
  
  generateSummary(articles) {
    const sources = [...new Set(articles.map(a => a.source.name))];
    const countries = [...new Set(articles.map(a => a.source.country))];
    
    const sentimentCount = articles.reduce((acc, article) => {
      acc[article.sentiment] = (acc[article.sentiment] || 0) + 1;
      return acc;
    }, {});
    
    const positivePercent = Math.round((sentimentCount.positive || 0) / articles.length * 100);
    const neutralPercent = Math.round((sentimentCount.neutral || 0) / articles.length * 100);
    const negativePercent = Math.round((sentimentCount.negative || 0) / articles.length * 100);
    
    return `
      <div class="summary-container">
        <div class="summary-title">
          <span>📈</span>
          <span>分析摘要</span>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">媒体报道数量</div>
            <div class="summary-value">${articles.length} 篇</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">媒体来源</div>
            <div class="summary-value">${sources.length} 家</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">涉及国家/地区</div>
            <div class="summary-value">${countries.length} 个</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">正面报道</div>
            <div class="summary-value" style="color:#2e7d32;">${positivePercent}%</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">中性报道</div>
            <div class="summary-value" style="color:#f57c00;">${neutralPercent}%</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">负面报道</div>
            <div class="summary-value" style="color:#c62828;">${negativePercent}%</div>
          </div>
        </div>
      </div>
    `;
  }
  
  generateTimeline(articles) {
    // 按时间排序
    const sortedArticles = [...articles].sort((a, b) => 
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );
    
    if (sortedArticles.length <= 1) return '';
    
    let timelineHTML = `
      <div style="background:#f8f9ff;padding:20px;border-radius:10px;margin-top:20px;">
        <div style="font-size:16px;font-weight:600;margin-bottom:15px;color:#2c3e50;display:flex;align-items:center;gap:10px;">
          <span>🕒</span>
          <span>报道时间线</span>
        </div>
        <div style="position:relative;padding-left:30px;">
          <div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:#667eea;"></div>
    `;
    
    sortedArticles.forEach((article, index) => {
      const time = new Date(article.publishedAt);
      const timeStr = time.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      timelineHTML += `
        <div style="position:relative;margin-bottom:20px;">
          <div style="position:absolute;left:-20px;top:5px;width:10px;height:10px;background:#667eea;border-radius:50%;border:2px solid white;"></div>
          <div style="font-size:13px;color:#888;margin-bottom:3px;">${timeStr}</div>
          <div style="font-size:14px;color:#333;margin-bottom:5px;">
            <strong>${article.source.name}</strong>：${article.title.substring(0, 50)}${article.title.length > 50 ? '...' : ''}
          </div>
        </div>
      `;
    });
    
    timelineHTML += `
        </div>
      </div>
    `;
    
    return timelineHTML;
  }
  
  addResultEventListeners() {
    const popup = this.currentPopup;
    if (!popup) return;
    
    // 关闭按钮
    popup.querySelector('.analysis-close').addEventListener('click', () => {
      this.removePopup();
    });
    
    // 复制摘要按钮
    const copyBtn = popup.querySelector('#copySummary');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const summaryText = popup.querySelector('.summary-container').textContent;
        navigator.clipboard.writeText(summaryText).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '<span>✅</span> 已复制！';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        });
      });
    }
    
    // 导出报告按钮
    const exportBtn = popup.querySelector('#exportReport');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        alert('报告导出功能需要后端支持，当前为演示版本。');
      });
    }
    
    // 关闭分析按钮
    const closeBtn = popup.querySelector('#closeAnalysis');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removePopup();
      });
    }
  }
  
  handleClickOutside(event) {
    if (this.currentPopup && !this.currentPopup.contains(event.target)) {
      this.removePopup();
    }
  }
  
  handleKeyDown(event) {
    if (event.key === 'Escape' && this.currentPopup) {
      this.removePopup();
    }
  }
  
  handleContextMenu(event) {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && selectedText.length > 3) {
      // 可以在这里添加上下文菜单
    }
  }
  
  removePopup() {
    if (this.currentPopup) {
      this.currentPopup.remove();
      this.currentPopup = null;
    }
    this.lastSelection = '';
    
    // 移除高亮
    document.querySelectorAll('.selection-highlight').forEach(el => {
      el.classList.remove('selection-highlight');
    });
  }
  
  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
  const analyzer = new NewsAnalyzer();
  console.log('新闻分析插件初始化完成');
});

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new NewsAnalyzer();
  });
} else {
  const analyzer = new NewsAnalyzer();
}