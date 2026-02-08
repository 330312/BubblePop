import json
import os
import re
import sys
from zhipuai import ZhipuAI

react_prompt = """
你是一个专业的新闻分析师。你的任务是根据提供的多条新闻搜索摘要（Snippets），构建该事件的完整档案。
请针对给定的文本执行【{task_name}】任务。

请严格遵循以下步骤：
1. Thought: 思考并分析原始文本中关键的信息点、潜在的逻辑联系。
2. Action: 根据思考结果，严格按照 JSON 格式输出数据。

任务目标: {task_goal}
约束条件: 
- 必须包含 Thought 和 Action 两个部分。
- Action 必须是合法的 JSON 代码块。严禁包含任何 Markdown 标记（如 ```json）、严禁包含任何前缀文字（如‘这是结果’）或后缀说明。你的整个输出必须能直接被 json.loads() 解析。
- 语言简洁，去除废话。
- 除专有名词/机构名/人名外，输出必须为中文。不要输出英文句子或段落。

{format_instruction}
"""

agent_prompt = {
    "0": {
        "name": "内容总结",
        "goal": "对输入文本进行简要总结，提炼核心观点和关键信息，用一句话概括。",
        "format": "Action 格式: {\"summary\": \"...\"}"
    },
    "A": {
        "name": "时间轴梳理",
        "goal": """
                提取明确的时间节点。
                去除重复信息，保留出现重复信息的条目中信息量最大的一条
                按时间顺序排列；若无时间信息，则按照逻辑顺序排列（同时将date标记为“背景信息”）。
                标题与摘要必须为中文表达（必要时可改写或翻译）。来源名称可保留原文媒体名。
                """,
        "format": """Action 格式:
        {
            "timeline": [
                {
                    "date": "YYYY-MM-DD", 
                    "title": "事件简要标题",
                    "snippet": "对新闻摘要进行中文概述（不要直接复制英文原文）",
                    "sourceName": "发布媒体/机构名称",
                    "url": "关联的原文链接或跳转链接（如输入文本中已给出）",
                    "tags": ["概括的新闻主体类型（如监管机构、企业官方等）“]
                    "isReversal": true/false  // 若该事件为辟谣或与前期报道存在矛盾，则标记为 true，否则为 false
                }
            ]
        }"""
    },
    "B": {
        "name": "立场分析",
        "goal": "识别新闻中的关键实体（公司、协会、政府、群众等等），概括其核心立场和利益诉求。输出必须为中文。",
        "format": "Action 格式: {\"stakeholders\": [{\"party\": \"...\", \"stance\": \"...\", \"viewpoint\": \"...\"}]}"
    },
    "C": {
        "name": "关联推荐",
        "goal": "基于当前事件，分析事件本质，横向联想 1-2 个历史上相似或逻辑相关的事件。输出必须为中文。",
        "format": "Action 格式: {\"associations\": [{\"eventName\": \"...\", \"reason\": \"...\"}]}"
    }
}


class ReActTrinityAnalyzer:
    def __init__(self, api_key: str):
        self.client = ZhipuAI(api_key=api_key)
        self.model = "glm-4-flash"
        self.debug = os.getenv("AGENT_DEBUG", "").strip() == "1"

    def _max_chars_for_step(self, agent_key: str) -> int:
        """Return max input chars for a given ReAct step.

        Env vars (all optional):
        - AGENT_MAX_CHARS_DEFAULT (default: 5000)
        - AGENT_MAX_CHARS_STANCES (for step B)
        - AGENT_MAX_CHARS_RELATED_EVENTS (for step C)
        """

        def _to_int(v: str, fallback: int) -> int:
            try:
                n = int(v)
                return n if n > 0 else fallback
            except Exception:
                return fallback

        default_max = _to_int(os.getenv("AGENT_MAX_CHARS_DEFAULT", "2500"), 2500)

        if agent_key == "B":
            return _to_int(os.getenv("AGENT_MAX_CHARS_STANCES", "2000"), 2000)

        if agent_key == "C":
            return _to_int(
                os.getenv("AGENT_MAX_CHARS_RELATED_EVENTS", "2000"),
                2000
            )

        return default_max
    def extract_json(self, text: str) -> dict:
        try:
            match = re.search(r'(\{.*\})', text, re.DOTALL)
            if match:
                json_str = match.group(1).strip()
                data = json.loads(json_str)
                # Some model outputs wrap payload inside Action.
                if isinstance(data, dict):
                    if isinstance(data.get("Action"), dict):
                        return data["Action"]
                    if isinstance(data.get("action"), dict):
                        return data["action"]
                    if isinstance(data.get("data"), dict):
                        nested = data["data"].get("Action") or data["data"].get("action")
                        if isinstance(nested, dict):
                            return nested
                return data
            return {
                "code": 500, 
                "msg": "未在模型输出中找到有效的 Action JSON 结构",
                "data": None
            }
        except Exception as e:
            return {
                "code": 500, 
                "msg": "error",
                "data": f"JSON 解析错误: {str(e)}"
            }

    def execute_react_step(self, agent_key: str, content: str) -> dict:
        config = agent_prompt[agent_key]
        system_msg = react_prompt.format(
            task_name = config["name"],
            task_goal = config["goal"],
            format_instruction = config["format"]
        )

        max_chars = self._max_chars_for_step(agent_key)
        
        response = self.client.chat.completions.create(
            model = self.model,
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"需要分析的内容如下：\n{content[:max_chars]}"}
            ],
            temperature = 0.2
        )
        
        raw_output = response.choices[0].message.content
        if self.debug:
            sys.stderr.write(f"\n[agent][{config['name']}] RAW OUTPUT START\n")
            sys.stderr.write(raw_output)
            sys.stderr.write(f"\n[agent][{config['name']}] RAW OUTPUT END\n")
            sys.stderr.flush()
        return self.extract_json(raw_output)

    def run(self, raw_text: str):
        data0 = self.execute_react_step("0", raw_text)
        if isinstance(data0, dict) and data0.get("code") == 500:
            return json.dumps(data0, ensure_ascii = False) #这里需要在返回Error之后重新调用一遍整个函数，获得正确的json
        data_a = self.execute_react_step("A", raw_text)
        if isinstance(data_a, dict) and data_a.get("code") == 500:
            return json.dumps(data_a, ensure_ascii = False)
        data_b = self.execute_react_step("B", raw_text)
        if isinstance(data_b, dict) and data_b.get("code") == 500:
            return json.dumps(data_b, ensure_ascii = False)
        data_c = self.execute_react_step("C", raw_text)
        if isinstance(data_c, dict) and data_c.get("code") == 500:
            return json.dumps(data_c, ensure_ascii = False)

        # Be tolerant to key naming differences in model output.
        # Some models may output keys that match API field names (stances/relatedEvents)
        # instead of the instructed keys (stakeholders/associations).
        stances = data_b.get("stakeholders") or data_b.get("stances") or []
        related_events = data_c.get("associations") or data_c.get("relatedEvents") or []
        
        final_output = {
            "code": 200,
            "data": {
                "summary": data0.get("summary", ""),
                "timeline": data_a.get("timeline", []),
                "stances": stances,
                "relatedEvents": related_events
            }
        }
        return json.dumps(final_output, ensure_ascii = False, indent = 2)

### 调用请使用 analyzer=ReActTrinityAnalyzer(api_key)，获取结果请用 analyzer.run(text) ###
