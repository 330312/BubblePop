import json
import sys
import warnings

warnings.filterwarnings("ignore", category=RuntimeWarning)

def sanitize_text(s: str) -> str:
  """
  Make text safe for UTF-8 transport:
  - remove surrogate code points (U+D800..U+DFFF)
  - ensure it can be encoded as UTF-8
  """
  if s is None:
    return ""
  if not isinstance(s, str):
    s = str(s)

  # 1) drop surrogate code points explicitly
  s = "".join(ch for ch in s if not (0xD800 <= ord(ch) <= 0xDFFF))

  # 2) ensure UTF-8 encodable; replace any remaining oddities
  s = s.encode("utf-8", errors="replace").decode("utf-8")
  return s

def safe_stderr(msg: str):
  """
  Avoid UnicodeEncodeError when printing to stderr on Windows console.
  """
  try:
    sys.stderr.write(msg)
    sys.stderr.flush()
  except UnicodeEncodeError:
    # fallback: replace unencodable chars
    msg2 = msg.encode("utf-8", errors="replace").decode("utf-8")
    sys.stderr.write(msg2)
    sys.stderr.flush()

def collect_results(ddgs_cls, mode, query, count, backend, region):
  out = []
  query = sanitize_text(query)  # ✅ ensure query is safe before calling ddgs

  with warnings.catch_warnings():
    warnings.simplefilter("ignore", RuntimeWarning)
    with ddgs_cls() as ddgs:
      iterator = ddgs.text(
        query,
        max_results=count,
        backend=backend,
        region=region,
        safesearch="off",
      )
      for r in iterator:
        out.append({
          "title": r.get("title") or "",
          "snippet": r.get("body") or "",
          "url": r.get("href") or "",
          "sourceName": r.get("source") or "",
          "datePublished": r.get("date") or ""
        })
  return out

def main():
  try:
    raw = sys.stdin.read()
    # ✅ stdin 也可能有奇怪字符，先做一次宽松清洗再 json.loads
    raw = sanitize_text(raw)

    payload = json.loads(raw) if raw else {}
    query = sanitize_text(payload.get("query", "")).strip()
    count = int(payload.get("count", 20))
    region = sanitize_text(payload.get("region", "cn-zh"))

    if not query:
      print(json.dumps({"error": "query is required"}))
      return

    new_ddgs_cls = None
    legacy_ddgs_cls = None

    try:
      from ddgs import DDGS as NewDDGS
      new_ddgs_cls = NewDDGS
    except Exception:
      pass

    try:
      warnings.simplefilter("ignore", RuntimeWarning)
      from duckduckgo_search import DDGS as LegacyDDGS
      legacy_ddgs_cls = LegacyDDGS
    except Exception:
      pass

    if not new_ddgs_cls and not legacy_ddgs_cls:
      print(json.dumps({"error": "ddgs/duckduckgo_search not available"}))
      return

    results = []
    backend = sanitize_text(payload.get("backend", "auto"))
    if backend == "html":
      backend = "auto"

    # ✅ log safely (avoid breaking on bad unicode / console encoding)
    safe_stderr(f"[ddg_search] mode=new backend={backend} region={region} query={query[:60]}\n")

    try:
      if not new_ddgs_cls:
        raise RuntimeError("new ddgs unavailable")
      results = collect_results(new_ddgs_cls, "new", query, count, backend, region)

    except Exception as e:
      if new_ddgs_cls:
        try:
          safe_stderr(f"[ddg_search] new mode retry after error ({sanitize_text(str(e))[:120]})\n")
          results = collect_results(new_ddgs_cls, "new", query, count, backend, region)

        except Exception as retry_err:
          if legacy_ddgs_cls:
            safe_stderr(f"[ddg_search] new mode failed ({sanitize_text(str(retry_err))[:120]}), fallback to legacy/html\n")
            results = collect_results(legacy_ddgs_cls, "legacy", query, count, "html", region)
          else:
            raise
      elif legacy_ddgs_cls:
        results = collect_results(legacy_ddgs_cls, "legacy", query, count, "html", region)
      else:
        raise

    # ✅ ensure_ascii=False 让中文正常输出（你下游若需要 utf-8 更友好）
    print(json.dumps({"results": results}, ensure_ascii=False))

  except Exception as e:
    print(json.dumps({"error": sanitize_text(str(e))}, ensure_ascii=False))

if __name__ == "__main__":
  main()