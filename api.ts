import axios from 'axios';

const API_BASE = 'http://localhost:3000'; // 根据你的后端地址修改

export const analyzeText = async (query: string, currentUrl: string) => {
  try {
    const response = await axios.post(`${API_BASE}/api/analyze`, {
      query,
      context: {
        currentUrl,
        timestamp: new Date().toISOString()
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