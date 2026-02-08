import axios from 'axios';

// 仅使用浏览器可用的环境变量，避免 content-script 中的 process 未定义报错。
const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) ||
  'http://localhost:8787';

export const analyzeText = async (
  query: string,
  currentUrl: string,
  agentUrl?: string,
  snippets?: any[],
  region?: string,
  agentKey?: string
) => {
  try {
    const response = await axios.post(`${API_BASE}/api/analyze`, {
      query,
      context: {
        currentUrl,
        timestamp: new Date().toISOString()
      },
      region,
      snippets: snippets || []
    }, {
      headers: {
        ...(agentUrl ? { 'x-agent-url': agentUrl } : {}),
        ...(agentKey ? { 'x-agent-key': agentKey } : {})
      }
    });

    if (response.data.code === 200) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || '分析失败');
    }
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
};

// 开发阶段使用的mock函数
export const mockAnalyzeText = async (): Promise<any> => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟延迟
  
  return {
    summary: "某公司因原材料上涨宣布涨价，引发消费者不满和监管介入",
    timeline: [
      {
        date: "2025-12-01",
        title: "事件起因：某公司发布新规",
        snippet: "某公司发布公告称，由于原材料成本上涨，将于12月10日起对全线产品提价10%",
        sourceName: "新京报",
        url: "https://example.com/news/1",
        tags: ["企业官方"]
      },
      {
        date: "2025-12-05",
        title: "反转：监管部门介入",
        snippet: "市监局表示已立案调查，要求企业提供成本上涨的详细数据证明",
        sourceName: "央视新闻",
        url: "https://example.com/news/2",
        tags: ["监管机构"],
        isReversal: true
      },
      {
        date: "2025-12-08",
        title: "消费者集体投诉",
        snippet: "多地消费者协会收到大量投诉，质疑涨价合理性",
        sourceName: "消费者报",
        url: "https://example.com/news/3",
        tags: ["消费者"]
      }
    ],
    stances: [
      {
        party: "企业方",
        viewpoint: "强调是成本原因导致涨价，属于市场正常行为"
      },
      {
        party: "消费者",
        viewpoint: "普遍表示不满，认为是借机涨价割韭菜"
      },
      {
        party: "监管机构",
        viewpoint: "要求企业公开透明，维护市场秩序和消费者权益"
      }
    ],
    relatedEvents: [
      {
        eventName: "2023年某品牌类似涨价事件",
        reason: "同样因原材料上涨引发消费者集体投诉"
      }
    ]
  };
};

export const searchNews = async (query: string, region?: string) => {
  const response = await axios.post(`${API_BASE}/api/search`, {
    query,
    region
  });
  return response.data;
};

export const validateDdgService = async (region?: string) => {
  try {
    const response = await axios.post(`${API_BASE}/api/validate/ddg`, { region });
    return response.data;
  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'DDG 服务不可用'
    };
  }
};

export const validateAgentKey = async (apiKey: string) => {
  try {
    const response = await axios.post(`${API_BASE}/api/validate/agent`, {
      apiKey
    });
    return response.data;
  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        'Agent Key 校验失败'
    };
  }
};
