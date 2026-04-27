#!/usr/bin/env python3
"""
Apollo Argument-Suggestion Discovery for Fresha.

Apollo also leaks valid *argument names* when you pass an unknown argument:
  "Unknown argument 'aaaa' on field 'Geolocation.locations'. 
   Did you mean 'distance', 'query', 'first'?"

This script discovers arguments for any field path.
"""

import json
import re
from pathlib import Path

import httpx

ENDPOINT = "https://www.fresha.com/graphql"
HEADERS_FILE = "fresha_headers.json"
PROXY = None

ARG_ERROR_RE = re.compile(
    r'Unknown argument "([^"]+)" on field "([^"]+)"'
)
ARG_SUGGEST_RE = re.compile(
    r'Did you mean\s+"([^"]+)"(?:,\s+"([^"]+)"(?:,\s+or\s+"([^"]+)")?)?'
)


def load_headers():
    path = Path(HEADERS_FILE)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-CA",
        "x-client-platform": "web",
        "x-client-version": "1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96",
        "Origin": "https://www.fresha.com",
        "Referer": "https://www.fresha.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

client = httpx.Client(
    http2=True, verify=False, proxy=PROXY, timeout=15, headers=load_headers()
)


def graphql_query(query: str):
    try:
        r = client.post(ENDPOINT, json={"query": query})
        if r.status_code != 200:
            print(f"[!] HTTP {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        print(f"[!] Request failed: {e}")
        return None


def extract_arg_suggestions(error_message: str):
    match = ARG_SUGGEST_RE.search(error_message)
    if match:
        return [g for g in match.groups() if g]
    return []


def discover_arguments(field_path: str, base_query_with_placeholder: str, probes=None):
    """
    field_path: human-readable like 'Geolocation.locations'
    base_query_with_placeholder: the GraphQL query string where {PROBE} will be replaced
        with 'aaaa: 1', 'bbbb: 1', etc.
    """
    print(f"\n[*] Discovering arguments for: {field_path}")
    found = set()
    probes = probes or ["aaaa", "bbbb", "zzzz", "xxxx"]

    for probe in probes:
        q = base_query_with_placeholder.replace("{PROBE}", f"{probe}: 1")
        data = graphql_query(q)
        if not data:
            continue
        for err in data.get("errors", []):
            msg = err.get("message", "")
            sugg = extract_arg_suggestions(msg)
            if sugg:
                print(f"    [+] Suggestions: {sugg}")
                found.update(sugg)

    return list(found)


def main():
    print("=" * 60)
    print("Apollo Argument Discovery")
    print("=" * 60)

    results = {}

    # --- Arguments for Query.geolocation ---
    results["Query.geolocation"] = discover_arguments(
        "Query.geolocation",
        'query { geolocation({PROBE}) { __typename } }'
    )

    # --- Arguments for Geolocation.locations ---
    results["Geolocation.locations"] = discover_arguments(
        "Geolocation.locations",
        'query { geolocation(placeId: "49.2827,-123.1207") { locations({PROBE}) { __typename } } }'
    )

    # --- Arguments for Query.location (singular) ---
    results["Query.location"] = discover_arguments(
        "Query.location",
        'query { location({PROBE}) { __typename } }'
    )

    # --- Arguments for Query.locations (root) ---
    results["Query.locations"] = discover_arguments(
        "Query.locations",
        'query { locations({PROBE}) { __typename } }'
    )

    # --- Also try common lat/lng/distance probes on Geolocation.locations ---
    print("\n[*] Trying common geo argument names on Geolocation.locations...")
    for arg in ["lat", "lng", "latitude", "longitude", "center", "radius", "distance"]:
        q = f'query {{ geolocation(placeId: "49.2827,-123.1207") {{ locations({arg}: 1) {{ __typename }} }} }}'
        data = graphql_query(q)
        if data:
            for err in data.get("errors", []):
                msg = err.get("message", "")
                if f'Unknown argument "{arg}"' in msg:
                    sugg = extract_arg_suggestions(msg)
                    if sugg:
                        print(f"    [+] '{arg}' not valid. Suggestions: {sugg}")

    # Save
    out = "fresha_discovered_args.json"
    Path(out).write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n[*] Saved to: {out}")
    for field, args in results.items():
        print(f"    {field}: {args}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[!] Interrupted")
    finally:
        client.close()
