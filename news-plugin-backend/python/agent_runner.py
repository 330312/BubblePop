import json
import os
import sys
import traceback
import re
from urllib.parse import urlsplit

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Local import (python/Agent.py)
from Agent import ReActTrinityAnalyzer
from zhipuai import ZhipuAI


def _load_input() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    raw = raw.encode('utf-8', errors='replace').decode('utf-8')
    return json.loads(raw)


def _norm_domain(url_or_domain: str) -> str:
    if not url_or_domain:
        return ""
    s = str(url_or_domain).strip()
    if not s:
        return ""
    if s.startswith("http://") or s.startswith("https://"):
        try:
            netloc = urlsplit(s).netloc.lower()
            if "@" in netloc:
                netloc = netloc.split("@", 1)[-1]
            if ":" in netloc:
                netloc = netloc.split(":", 1)[0]
            if netloc.startswith("www."):
                netloc = netloc[4:]
            return netloc
        except Exception:
            return ""
    s = s.lower()
    if s.startswith("www."):
        s = s[4:]
    return s


def main():
    try:
        payload = _load_input()
        raw_text = payload.get("rawText") or payload.get("text") or ""
        validate_only = bool(payload.get("validateOnly"))
        debug = os.getenv("AGENT_DEBUG", "").strip() == "1"
        mode = payload.get("mode")

        api_key = (
            os.environ.get("ZAI_API_KEY")
            or os.environ.get("ZHIPU_API_KEY")
            or os.environ.get("GLM_API_KEY")
        )
        if not api_key:
            out = {"code": 500, "msg": "Missing API key env (ZAI_API_KEY)", "data": None}
            sys.stdout.write(json.dumps(out, ensure_ascii=False))
            return

        if validate_only:
            try:
                client = ZhipuAI(api_key=api_key)
                if hasattr(client, "timeout"):
                    client.timeout = 8
                client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "user", "content": "ping"}],
                    temperature=0.0,
                    max_tokens=1,
                )
                sys.stdout.write(json.dumps({"code": 200, "data": {"ok": True}}, ensure_ascii=False))
                return
            except Exception as e:
                out = {"code": 500, "msg": "validate error", "data": {"error": str(e)}}
                sys.stdout.write(json.dumps(out, ensure_ascii=False))
                return

        if mode in ["strategy", "select", "summarize", "filter"]:
            client = ZhipuAI(api_key=api_key)
            if hasattr(client, "timeout"):
                client.timeout = 20

            def _extract_json(text: str) -> dict:
                match = re.search(r'(\{.*\})', text, re.DOTALL)
                if not match:
                    raise ValueError("no json found")
                return json.loads(match.group(1))

            if mode == "strategy":
                selection = payload.get("selection") or ""
                page_title = payload.get("pageTitle") or ""
                page_url = payload.get("pageUrl") or ""
                max_queries = int(payload.get("maxQueries") or 4)
                system_msg = (
                    "你是新闻搜索策略生成器。给定文本，请生成多条搜索query用于检索真实新闻。\n"
                    "必须输出纯JSON，不要Markdown。\n"
                    "格式: {\"queries\":[{\"q\":\"...\",\"priority\":1,\"angle\":\"...\",\"lang\":\"zh|en\"}]}.\n"
                    "硬约束：每条 query 的 angle 必须不同（不能同义改写）。\n"
                    "至少覆盖这些 angle（凑不齐也要尽量靠近）：\n"
                    "- 官方/监管/公告（press release / regulator / official statement）\n"
                    "- 争议/质疑/调查（controversy / criticism / investigation / lawsuit）\n"
                    "- 行业/数据/研究（report / data / statistics）\n"
                    "- 影响/受众/市场反应（impact / consumers / investors）\n"
                    "若事件涉及国外主体/国际组织/海外地区/英文专有名词，必须至少给出1-2条英文查询（lang=en）。\n"
                    "中文事件优先输出中文查询（lang=zh）。\n"
                    f"输出{max_queries}条左右，简洁关键词，避免重复。"
                )
                user_msg = f"selection={selection}\npage_title={page_title}\npage_url={page_url}"
                resp = client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                    temperature=0.2,
                    max_tokens=400,
                )
                raw_output = resp.choices[0].message.content
                if debug:
                    sys.stderr.write(f"\n[agent][strategy] RAW OUTPUT START\n{raw_output}\n[agent][strategy] RAW OUTPUT END\n")
                data = _extract_json(raw_output)
                sys.stdout.write(json.dumps({"code": 200, "data": data}, ensure_ascii=False))
                return

            if mode == "select":
                candidates = payload.get("candidates") or []
                max_output = int(payload.get("maxOutput") or 10)
                # Seed domain: the current highlighted page domain.
                seed_domain = _norm_domain(payload.get("seedDomain") or payload.get("pageUrl") or "")

                diversity_block = (
                    "5) 多样性（硬约束优先）：\n"
                    "   - 若候选提供 sourceDomain，则同一 sourceDomain 最多选 2 条；\n"
                    "   - 若候选提供 authorKey，则同一 authorKey 最多选 1 条；\n"
                    "   - 目标：至少覆盖 6 个不同 sourceDomain，不足则用相关度次高的条目补齐。\n"
                )
                if seed_domain:
                    diversity_block += (
                        "   - 额外硬约束：必须至少选出 3 个不同 sourceDomain，且其中至少 2 个域名必须不等于当前页面域名（seedDomain）。\n"
                        "     同 seedDomain 最多选 1 条（最好 0 条）。\n"
                        f"     seedDomain={seed_domain}\n"
                    )

                system_msg = (
                    "你是新闻筛选器，从候选列表中选择相关度高、新闻性强、可核验的新闻条目。\n"
                    "只允许返回候选中的id，不要编造。\n"
                    "请基于以下维度综合评分并挑选：\n"
                    "1) 相关度：是否与原始主题强相关；\n"
                    "2) 新闻性：是否像正式新闻报道而非观点/闲聊/百科；\n"
                    "3) 可核验性：是否有明确来源/日期/标题结构；\n"
                    "4) 时效性：日期较新的优先；\n"
                    + diversity_block +
                    "6) 百科类内容可作为背景信息，最多保留1条。\n"
                    "候选中提供了 hasDate/hasSourceName/titleLen/snippetLen/urlDepth/urlHasDate/sourceDomain/authorKey/isWiki 等信号，可用于判断新闻性与多样性。\n"
                    f"输出JSON格式: {{\"selected_ids\":[...]}}，数量不超过{max_output}。"
                )
                user_msg = json.dumps({"candidates": candidates}, ensure_ascii=False)
                resp = client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                    temperature=0.2,
                    max_tokens=600,
                )
                raw_output = resp.choices[0].message.content
                if debug:
                    sys.stderr.write(f"\n[agent][select] RAW OUTPUT START\n{raw_output}\n[agent][select] RAW OUTPUT END\n")
                data = _extract_json(raw_output)
                sys.stdout.write(json.dumps({"code": 200, "data": data}, ensure_ascii=False))
                return

            if mode == "filter":
                candidates = payload.get("candidates") or []
                system_msg = (
                    "你是新闻候选过滤器。请将候选划分为 news/background/noise 三类。\n"
                    "news: 正式新闻报道；background: 背景/百科/解释性内容；noise: 无关或低价值。\n"
                    "尽量保证 news 相关且可信，background 最多保留1条。\n"
                    "只允许返回候选中的id，不要编造。\n"
                    "输出JSON格式: {\"news_ids\":[...],\"background_ids\":[...],\"discard_ids\":[...]}。\n"
                )
                user_msg = json.dumps({"candidates": candidates}, ensure_ascii=False)
                resp = client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                    temperature=0.2,
                    max_tokens=600,
                )
                raw_output = resp.choices[0].message.content
                if debug:
                    sys.stderr.write(f"\n[agent][filter] RAW OUTPUT START\n{raw_output}\n[agent][filter] RAW OUTPUT END\n")
                data = _extract_json(raw_output)
                sys.stdout.write(json.dumps({"code": 200, "data": data}, ensure_ascii=False))
                return

            if mode == "summarize":
                items = payload.get("items") or []
                system_msg = (
                    "你是新闻摘要器。基于每条新闻的title/snippet，输出简短摘要。\n"
                    "只输出JSON，不要Markdown。\n"
                    "格式: {\"summaries\":[{\"id\":\"...\",\"summary\":\"...\"}]}，summary一句话。"
                )
                user_msg = json.dumps({"items": items}, ensure_ascii=False)
                resp = client.chat.completions.create(
                    model="glm-4-flash",
                    messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                    temperature=0.2,
                    max_tokens=800,
                )
                raw_output = resp.choices[0].message.content
                if debug:
                    sys.stderr.write(f"\n[agent][summarize] RAW OUTPUT START\n{raw_output}\n[agent][summarize] RAW OUTPUT END\n")
                data = _extract_json(raw_output)
                sys.stdout.write(json.dumps({"code": 200, "data": data}, ensure_ascii=False))
                return

        analyzer = ReActTrinityAnalyzer(api_key=api_key)
        if debug:
            sys.stderr.write(f"[agent] run start, text_len={len(raw_text)} model=glm-4-flash\n")
            sys.stderr.flush()
        result_json_str = analyzer.run(raw_text)
        if debug:
            sys.stderr.write("[agent] run finished\n")
            sys.stderr.flush()

        sys.stdout.write(result_json_str)

    except Exception as e:
        out = {
            "code": 500,
            "msg": "agent_runner error",
            "data": {
                "error": str(e),
                "trace": traceback.format_exc()[-4000:],
            },
        }
        sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
