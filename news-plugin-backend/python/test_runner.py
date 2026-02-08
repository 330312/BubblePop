import os
import sys

# 模拟输入
test_input = '''{"rawText":"QUERY: 咖啡涨价\\n\\nSNIPPETS:\\n#1\\nTITLE: 咖啡涨价新闻\\nSNIPPET: 某品牌咖啡宣布涨价10%\\nURL: https://example.com/news1"}'''

# 导入并运行
from Agent import ReActTrinityAnalyzer

api_key = (
    os.environ.get("ZAI_API_KEY")
    or os.environ.get("ZHIPU_API_KEY")
    or os.environ.get("GLM_API_KEY")
)
if not api_key:
    sys.stderr.write("Missing API key in env (ZAI_API_KEY / ZHIPU_API_KEY / GLM_API_KEY)\n")
    sys.exit(1)

analyzer = ReActTrinityAnalyzer(api_key=api_key)
result = analyzer.run(test_input)
print(result)
