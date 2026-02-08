import json
import sys
import warnings

warnings.filterwarnings("ignore", category=RuntimeWarning)

def collect_results(ddgs_cls, mode, query, count, backend, region):
  out = []
  with warnings.catch_warnings():
    warnings.simplefilter("ignore", RuntimeWarning)
    with ddgs_cls() as ddgs:
      if mode == "new":
        iterator = ddgs.text(query, max_results=count, backend=backend, region=region, safesearch="off")
      else:
        iterator = ddgs.text(query, max_results=count, backend=backend, region=region, safesearch="off")
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
    payload = json.loads(raw) if raw else {}
    query = payload.get("query", "").strip()
    count = int(payload.get("count", 20))
    region = payload.get("region", "cn-zh")
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
    backend = payload.get("backend", "auto")
    if backend == "html":
      backend = "auto"
    sys.stderr.write(f"[ddg_search] mode=new backend={backend} region={region} query={query[:60]}\n")
    sys.stderr.flush()
    try:
      if not new_ddgs_cls:
        raise RuntimeError("new ddgs unavailable")
      results = collect_results(new_ddgs_cls, "new", query, count, backend, region)
    except Exception as e:
      if new_ddgs_cls:
        try:
          sys.stderr.write(f"[ddg_search] new mode retry after error ({str(e)[:120]})\n")
          sys.stderr.flush()
          results = collect_results(new_ddgs_cls, "new", query, count, backend, region)
        except Exception as retry_err:
          if legacy_ddgs_cls:
            sys.stderr.write(f"[ddg_search] new mode failed ({str(retry_err)[:120]}), fallback to legacy/html\n")
            sys.stderr.flush()
            results = collect_results(legacy_ddgs_cls, "legacy", query, count, "html", region)
          else:
            raise
      elif legacy_ddgs_cls:
        results = collect_results(legacy_ddgs_cls, "legacy", query, count, "html", region)
      else:
        raise

    print(json.dumps({"results": results}))
  except Exception as e:
    print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
  main()
