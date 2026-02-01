import os
import sys

# 设置环境变量
os.environ["ZAI_API_KEY"] = "5bba23796f0348a786c72b16c4639579.m6qMYAQNwicVwKkc"

# 模拟输入
test_input = '''{"rawText":"QUERY: 咖啡涨价\\n\\nSNIPPETS:\\n#1\\nTITLE: 咖啡涨价新闻\\nSNIPPET: 某品牌咖啡宣布涨价10%\\nURL: https://example.com/news1"}'''

# 导入并运行
from Agent import ReActTrinityAnalyzer

analyzer = ReActTrinityAnalyzer(api_key=os.environ["ZAI_API_KEY"])
result = analyzer.run(test_input)
print(result)
