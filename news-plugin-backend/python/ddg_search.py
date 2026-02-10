import json
import sys
import warnings
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import re
import hashlib

warnings.filterwarnings("ignore", category=RuntimeWarning)


def sanitize_text(s: str) -> str:
  """Make text safe for UTF-8 transport."""
  if s is None:
    return ""
  if not isinstance(s, str):
    s = str(s)

  # drop surrogate code points explicitly
  s = "".join(ch for ch in s if not (0xD800 <= ord(ch) <= 0xDFFF))
  # ensure UTF-8 encodable
  s = s.encode("utf-8", errors="replace").decode("utf-8")
  return s


def safe_stderr(msg: str):
  """Avoid UnicodeEncodeError when printing to stderr on Windows console."""
  try:
    sys.stderr.write(msg)
    sys.stderr.flush()
  except UnicodeEncodeError:
    msg2 = msg.encode("utf-8", errors="replace").decode("utf-8")
    sys.stderr.write(msg2)
    sys.stderr.flush()


# --- Diversity helpers -------------------------------------------------

_TRACKING_KEYS = {
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "spm", "spm_id_from", "from", "src", "source", "ref", "referer",
  "fbclid", "gclid", "igshid", "mc_cid", "mc_eid",
}

_AUTHOR_PATTERNS = [
  re.compile(r"/(?:author|authors|writer|column|columns|people|person|profile|user|u|member|members)/([^/?#]+)", re.I),
  re.compile(r"/(?:zuozhe|zuozhe/|zhuanlan|zhuanlan/|zhitongche|renwu)/([^/?#]+)", re.I),
]

_DATE_IN_URL = re.compile(r"(?:/|^)(20\d{2})[\-/](0?[1-9]|1[0-2])[\-/](0?[1-9]|[12]\d|3[01])(?:/|$)")
_DATE_IN_URL_2 = re.compile(r"(?:/|^)(20\d{2})[\-/](0?[1-9]|1[0-2])(?:/|$)")


def _norm_domain(url: str) -> str:
  try:
    netloc = urlsplit(url).netloc.lower()
    if not netloc:
      return ""
    if "@" in netloc:
      netloc = netloc.split("@", 1)[-1]
    if ":" in netloc:
      netloc = netloc.split(":", 1)[0]
    if netloc.startswith("www."):
      netloc = netloc[4:]
    return netloc
  except Exception:
    return ""


def _normalize_url(url: str) -> str:
  """Remove tracking params & fragments to improve dedup."""
  try:
    parts = urlsplit(url)
    q = [(k, v) for (k, v) in parse_qsl(parts.query, keep_blank_values=True) if k.lower() not in _TRACKING_KEYS]
    query = urlencode(q, doseq=True)
    return urlunsplit((parts.scheme.lower() or "https", parts.netloc.lower(), parts.path, query, ""))
  except Exception:
    return url


def _url_depth(url: str) -> int:
  try:
    path = urlsplit(url).path.strip("/")
    if not path:
      return 0
    return len([p for p in path.split("/") if p])
  except Exception:
    return 0


def _url_has_date(url: str) -> bool:
  try:
    path = urlsplit(url).path
    return bool(_DATE_IN_URL.search(path) or _DATE_IN_URL_2.search(path))
  except Exception:
    return False


def _author_key(url: str) -> str:
  try:
    path = urlsplit(url).path
    for pat in _AUTHOR_PATTERNS:
      m = pat.search(path)
      if m:
        return f"{pat.pattern}:{m.group(1).lower()}"
    return ""
  except Exception:
    return ""


def _is_wiki(domain: str, url: str) -> bool:
  d = (domain or "").lower()
  if "wikipedia.org" in d:
    return True
  if d.endswith("baike.baidu.com"):
    return True
  if "wiki" in d and ("/wiki/" in (url or "")):
    return True
  return False


def _enrich(items: list) -> list:
  enriched = []
  for i, it in enumerate(items):
    url = it.get("url") or ""
    nurl = _normalize_url(url)
    domain = _norm_domain(nurl)
    ak = _author_key(nurl)
    has_date = bool((it.get("datePublished") or "").strip()) or _url_has_date(nurl)
    has_source = bool((it.get("sourceName") or "").strip())
    title = it.get("title") or ""
    snippet = it.get("snippet") or ""
    try:
      stable_id = "u_" + hashlib.sha1((nurl or url).encode("utf-8", errors="ignore")).hexdigest()[:12]
    except Exception:
      stable_id = f"ddg_{i}"

    enriched.append({
      **it,
      "id": it.get("id") or stable_id,
      "urlNormalized": nurl,
      "sourceDomain": domain,
      "authorKey": ak,
      "hasDate": has_date,
      "hasSourceName": has_source,
      "titleLen": len(title),
      "snippetLen": len(snippet),
      "urlDepth": _url_depth(nurl),
      "urlHasDate": _url_has_date(nurl),
      "isWiki": _is_wiki(domain, nurl),
    })
  return enriched


def _dedup_by_url(items: list) -> list:
  seen = set()
  out = []
  for it in items:
    key = it.get("urlNormalized") or it.get("url") or ""
    if not key:
      continue
    if key in seen:
      continue
    seen.add(key)
    out.append(it)
  return out


def _unique_domains(items: list, exclude_set: set | None = None) -> set:
  s = set()
  for it in items:
    d = it.get("sourceDomain") or ""
    if not d:
      continue
    if exclude_set and d in exclude_set:
      continue
    s.add(d)
  return s


def _diversify(
  items: list,
  limit: int,
  per_domain_cap: int,
  per_author_cap: int,
  exclude_domains: set,
  excluded_domain_cap: int,
  min_external_domains: int,
) -> list:
  """Greedy diversify. If exclude_domains provided, enforce a minimum number of external domains.

  - For domains in exclude_domains: use excluded_domain_cap (often 0 or 1)
  - For other domains: use per_domain_cap
  """

  def _cap_for_domain(d: str) -> int:
    if d and d in exclude_domains:
      return excluded_domain_cap
    return per_domain_cap

  def _pick(src, cap_domain, cap_author, allow_excluded: bool):
    dom_cnt = {}
    au_cnt = {}
    picked = []
    ext_domains = set()
    for it in src:
      if len(picked) >= limit:
        break
      d = it.get("sourceDomain") or ""
      a = it.get("authorKey") or ""
      is_excluded = bool(d and d in exclude_domains)
      if (not allow_excluded) and is_excluded:
        continue
      dom_cap = cap_domain(d) if cap_domain else 0
      if dom_cap and d and dom_cnt.get(d, 0) >= dom_cap:
        continue
      if cap_author and a and au_cnt.get(a, 0) >= cap_author:
        continue
      picked.append(it)
      if d:
        dom_cnt[d] = dom_cnt.get(d, 0) + 1
        if not is_excluded:
          ext_domains.add(d)
      if a:
        au_cnt[a] = au_cnt.get(a, 0) + 1
    return picked, dom_cnt, au_cnt, ext_domains

  # Pass 1: try to collect enough external domains (do not allow excluded domains)
  picked1, dom_cnt, au_cnt, ext_domains = _pick(items, _cap_for_domain, per_author_cap, allow_excluded=False)

  # If we still don't have enough external domain coverage, relax author cap for external-only picking
  if len(ext_domains) < min_external_domains and len(picked1) < limit:
    picked1b, dom_cnt2, au_cnt2, ext_domains2 = _pick(
      [it for it in items if it not in picked1],
      _cap_for_domain,
      0,
      allow_excluded=False,
    )
    # merge counters
    picked1.extend(picked1b)
    for k, v in dom_cnt2.items():
      dom_cnt[k] = dom_cnt.get(k, 0) + v
    for k, v in au_cnt2.items():
      au_cnt[k] = au_cnt.get(k, 0) + v
    ext_domains |= ext_domains2

  picked = picked1

  # Pass 2: fill remaining slots (allow excluded domains with separate cap)
  if len(picked) < limit:
    for it in items:
      if len(picked) >= limit:
        break
      if it in picked:
        continue
      d = it.get("sourceDomain") or ""
      a = it.get("authorKey") or ""
      dom_cap = _cap_for_domain(d)
      if dom_cap and d and dom_cnt.get(d, 0) >= dom_cap:
        continue
      if per_author_cap and a and au_cnt.get(a, 0) >= per_author_cap:
        continue
      picked.append(it)
      if d:
        dom_cnt[d] = dom_cnt.get(d, 0) + 1
      if a:
        au_cnt[a] = au_cnt.get(a, 0) + 1

  # Pass 3: if still not enough, relax author cap, then domain cap (last resort)
  if len(picked) < limit:
    for it in items:
      if len(picked) >= limit:
        break
      if it in picked:
        continue
      d = it.get("sourceDomain") or ""
      dom_cap = _cap_for_domain(d)
      if dom_cap and d and dom_cnt.get(d, 0) >= dom_cap:
        continue
      picked.append(it)
      if d:
        dom_cnt[d] = dom_cnt.get(d, 0) + 1

  if len(picked) < limit:
    picked.extend([it for it in items if it not in picked])

  return picked[:limit]


def collect_results(ddgs_cls, query, count, backend, region):
  out = []
  query = sanitize_text(query)

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


def _parse_exclude_domains(payload: dict) -> set:
  raw = payload.get("excludeDomains")
  out = set()
  if not raw:
    return out
  if isinstance(raw, str):
    parts = [p.strip() for p in raw.split(",") if p.strip()]
  elif isinstance(raw, list):
    parts = [str(x).strip() for x in raw if str(x).strip()]
  else:
    parts = []
  for p in parts:
    if p.startswith("http://") or p.startswith("https://"):
      d = _norm_domain(_normalize_url(p))
    else:
      d = p.lower()
      if d.startswith("www."):
        d = d[4:]
    if d:
      out.add(d)
  return out


def main():
  try:
    raw = sanitize_text(sys.stdin.read())
    payload = json.loads(raw) if raw else {}

    query = sanitize_text(payload.get("query", "")).strip()
    count = int(payload.get("count", 20))
    region = sanitize_text(payload.get("region", "cn-zh"))

    if not query:
      print(json.dumps({"error": "query is required"}, ensure_ascii=False))
      return

    # Determine seed domain (the page user is highlighting). Caller can pass seedUrl/pageUrl.
    seed_url = sanitize_text(payload.get("seedUrl") or payload.get("pageUrl") or "").strip()
    seed_domain = _norm_domain(_normalize_url(seed_url)) if seed_url else ""

    exclude_domains = _parse_exclude_domains(payload)
    # By default: if seed_domain is known, treat it as excluded to force other sites.
    exclude_seed = payload.get("excludeSeedDomain")
    if exclude_seed is None:
      exclude_seed = True if seed_domain else False
    exclude_seed = bool(exclude_seed)
    if exclude_seed and seed_domain:
      exclude_domains.add(seed_domain)

    # knobs
    diversify = bool(payload.get("diversify", True))
    per_domain_cap = int(payload.get("perDomainCap", 2) or 2)
    per_author_cap = int(payload.get("perAuthorCap", 1) or 1)
    excluded_domain_cap = int(payload.get("excludedDomainCap", 1) or 1)
    min_unique_domains = int(payload.get("minUniqueDomains", 6) or 6)
    min_external_domains = int(payload.get("minExternalDomains", 2) or 2)
    anti_dominant_retry = bool(payload.get("antiDominantRetry", True))
    anti_dominant_topk = int(payload.get("antiDominantTopK", 2) or 2)
    include_meta = bool(payload.get("includeMeta", False))

    # If caller provided seed_url, default to enforcing external domains.
    enforce_external = payload.get("enforceExternal")
    if enforce_external is None:
      enforce_external = True if seed_domain else False
    enforce_external = bool(enforce_external)

    # ddgs import
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
      print(json.dumps({"error": "ddgs/duckduckgo_search not available"}, ensure_ascii=False))
      return

    backend = sanitize_text(payload.get("backend", "auto"))
    if backend == "html":
      backend = "auto"

    safe_stderr(f"[ddg_search] backend={backend} region={region} query={query[:80]} seedDomain={seed_domain or '-'}\n")

    ddgs_cls = new_ddgs_cls or legacy_ddgs_cls
    backend2 = backend if new_ddgs_cls else "html"

    # --- first search ---
    try:
      results = collect_results(ddgs_cls, query, count, backend2, region)
    except Exception as e:
      # one retry
      safe_stderr(f"[ddg_search] retry after error ({sanitize_text(str(e))[:120]})\n")
      results = collect_results(ddgs_cls, query, count, backend2, region)

    results = _dedup_by_url(_enrich(results))

    # --- external-domain enforcement retry (exclude seed domain / excluded domains) ---
    if enforce_external and exclude_domains and results:
      ext = _unique_domains(results, exclude_set=exclude_domains)
      if len(ext) < max(1, min_external_domains):
        # Exclude seed + maybe other dominant domains to get more outside sources.
        # Keep the exclude list small to avoid killing recall.
        # Priority: seedDomain first, then dominant domains in current results.
        dom_cnt = {}
        for it in results:
          d = it.get("sourceDomain") or ""
          if not d:
            continue
          dom_cnt[d] = dom_cnt.get(d, 0) + 1
        dominant = [d for (d, _) in sorted(dom_cnt.items(), key=lambda x: x[1], reverse=True)]

        exclude_list = []
        if seed_domain:
          exclude_list.append(seed_domain)
        for d in dominant:
          if d == seed_domain:
            continue
          if d in exclude_domains:
            exclude_list.append(d)
          elif len(exclude_list) < max(2, anti_dominant_topk + 1):
            # add a couple more dominant sites
            exclude_list.append(d)
          if len(exclude_list) >= max(2, anti_dominant_topk + 1):
            break

        exclude_list = [d for d in exclude_list if d]
        if exclude_list:
          q2 = query + " " + " ".join([f"-site:{d}" for d in exclude_list])
          safe_stderr(f"[ddg_search] external retry exclude={exclude_list}\n")
          try:
            more = collect_results(ddgs_cls, q2, count, backend2, region)
            more = _dedup_by_url(_enrich(more))
            results = _dedup_by_url(results + more)
          except Exception:
            pass

    # --- existing anti-dominant retry (general diversity) ---
    if anti_dominant_retry and results:
      dom_cnt = {}
      for it in results:
        d = it.get("sourceDomain") or ""
        if d:
          dom_cnt[d] = dom_cnt.get(d, 0) + 1
      unique_dom = len(dom_cnt)
      if unique_dom < max(2, min_unique_domains):
        top_domains = sorted(dom_cnt.items(), key=lambda x: x[1], reverse=True)
        exclude = [d for (d, _) in top_domains[:max(1, anti_dominant_topk)] if d]
        if exclude:
          q2 = query + " " + " ".join([f"-site:{d}" for d in exclude])
          safe_stderr(f"[ddg_search] diversity retry exclude={exclude}\n")
          try:
            more = collect_results(ddgs_cls, q2, count, backend2, region)
            more = _dedup_by_url(_enrich(more))
            results = _dedup_by_url(results + more)
          except Exception:
            pass

    # --- diversify selection ---
    if diversify:
      results = _diversify(
        results,
        count,
        per_domain_cap,
        per_author_cap,
        exclude_domains,
        excluded_domain_cap,
        (min_external_domains if enforce_external else 0),
      )
    else:
      results = results[:count]

    if include_meta:
      meta = {
        "seedDomain": seed_domain,
        "excludeDomains": sorted(list(exclude_domains)) if exclude_domains else [],
        "uniqueDomains": sorted(list(_unique_domains(results, exclude_set=set()))),
        "uniqueExternalDomains": sorted(list(_unique_domains(results, exclude_set=exclude_domains))) if exclude_domains else [],
      }
      print(json.dumps({"results": results, "meta": meta}, ensure_ascii=False))
    else:
      print(json.dumps({"results": results}, ensure_ascii=False))

  except Exception as e:
    print(json.dumps({"error": sanitize_text(str(e))}, ensure_ascii=False))


if __name__ == "__main__":
  main()
