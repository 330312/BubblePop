// background.js -version 0.0.1
// 以下标有 🔴 的部分需要后端支持

class NewsSearchService {
  constructor() {
    this.settings = {};
    this.loadSettings();
    console.log('新闻分析服务初始化');
  }
  
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        // 用户设置
        apiEndpoint: 'https://your-backend.com/api', // 🔴 需要后端的API地址
        apiKey: '', // 🔴 需要后端的API密钥
        language: 'zh-CN',
        resultCount: 10
      }, (settings) => {
        this.settings = settings;
        resolve();
      });
    });
  }

  // 🔴 需要后端支持：调用新闻搜索API
  async searchNews(query) {
    try {
      // 🔴 需要后端：构建请求到你的服务器
      const endpoint = `${this.settings.apiEndpoint}/search-news`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'X-API-Key': this.settings.apiKey
        },
        body: JSON.stringify({
          query: query,
          language: this.settings.language,
          count: this.settings.resultCount,
          source: 'news'
        })
      });

      if (!response.ok) {
        throw new Error(`后端API错误: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        query: query,
        totalResults: data.total || data.articles?.length || 0,
        articles: this.formatArticles(data.articles || []),
        apiUsed: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API失效:', error);
      return {
        success: false,
        error: 'API失效，请检查后端服务或网络连接。',
        query: query,
        articles: [],
        apiUsed: false,
        fallback: false
      };
    }
  }

  // 🔴 需要后端：根据你的API响应格式调整
  formatArticles(articlesFromAPI) {
    // 这里需要将后端API返回的数据格式化为前端需要的格式
    // 示例格式转换，根据你的实际API响应调整
    return articlesFromAPI.map(item => ({
      source: {
        name: item.source || item.publisher || '未知来源',
        domain: item.domain || this.extractDomain(item.url),
        country: item.country || this.detectCountry(item)
      },
      title: item.title || '无标题',
      description: item.description || item.summary || '无描述',
      content: item.content, // 🔴 如果后端提供详细内容
      publishedAt: item.publishedAt || item.date || item.pubDate || new Date().toISOString(),
      url: item.url || item.link || '#',
      imageUrl: item.image || item.thumbnail || null,
      category: item.category || item.section || '新闻',
      sentiment: item.sentiment || this.analyzeSentiment(item.title + ' ' + (item.description || '')),
      sentimentScore: item.sentimentScore || 0,
      keywords: item.keywords || [], // 🔴 如果后端提供关键词
      isBreaking: item.isBreaking || item.breaking || false,
      readTime: item.readTime || this.calculateReadTime(item.content || item.description)
    }));
  }

  // 🔴 需要后端：测试API连接
  async testAPI(apiKey, endpoint) {
    try {
      // 🔴 需要后端：发送测试请求到你的服务器
      const testUrl = `${endpoint}/test`;
      
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.status === 401) {
        return {
          success: false,
          error: 'API密钥无效'
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          error: 'API调用次数超限'
        };
      }

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          quota: data.quota, // 🔴 后端应返回配额信息
          remaining: data.remaining,
          message: 'API连接正常'
        };
      }

      return {
        success: false,
        error: `HTTP ${response.status}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }


 
  
 

  

  // ✅ 纯前端：计算阅读时间
  calculateReadTime(text) {
    if (!text) return 3;
    const words = text.split(' ').length;
    return Math.ceil(words / 200); // 假设200词/分钟
  }
}

// 初始化服务
const newsService = new NewsSearchService();

// 🔴 需要后端：消息处理器 - 实际需要调用你的API
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request.action);

  switch (request.action) {
    case 'searchNews':
      newsService.searchNews(request.query)
        .then(result => {
          console.log('搜索结果:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('搜索错误:', error);
          sendResponse({
            success: false,
            error: 'API失效，请检查后端服务或网络连接。',
            articles: []
          });
        });
      return true;

    case 'testAPI':
      // 🔴 需要后端：测试你的API连接
      newsService.testAPI(request.apiKey, request.endpoint)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({
          success: false,
          error: error.message
        }));
      return true;

    case 'updateSettings':
      newsService.loadSettings();
      sendResponse({ success: true });
      return false;

    default:
      sendResponse({ 
        success: false, 
        error: '未知操作',
        note: '请确保后端API已正确配置' // 🔴 提醒需要后端
      });
      return false;
  }
});

// 插件安装/更新时
chrome.runtime.onInstalled.addListener((details) => {
  console.log('插件已安装/更新:', details.reason);
  
  // 设置默认配置
  chrome.storage.sync.set({
    apiEndpoint: 'https://your-backend.com/api', // 🔴 需要修改为你的后端地址
    apiKey: '',
    language: 'zh-CN',
    resultCount: 10,
    autoSearch: true,
    showImages: true
  });
});

// 创建右键菜单
chrome.contextMenus.create({
  id: 'analyze-with-backend', // 🔴 这个菜单项会触发后端API调用
  title: '使用后端分析新闻',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyze-with-backend' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeText',
      text: info.selectionText,
      source: 'contextMenu'
    });
  }
});

console.log('Background service ready - 等待后端API配置');