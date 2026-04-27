#!/usr/bin/env python3
"""
Apollo Field-Suggestion Schema Discovery for Fresha.

Apollo GraphQL leaks valid field names via "Did you mean..." error messages
when you query a non-existent field. This script exploits that to recursively
discover the schema without full introspection.

Requires: pip install httpx[http2]
"""

import json
import re
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ENDPOINT = "https://www.fresha.com/graphql"
HEADERS_FILE = "fresha_headers.json"
PROXY = None  # e.g. "http://127.0.0.1:8080"

# Seed with fields we already know work on Fresha Query root
KNOWN_ROOT_FIELDS = [
    "geolocation",
    "locations",
    "liteLocation",
    "location",
    "searchHistory",
]

# ---------------------------------------------------------------------------
# Load headers
# ---------------------------------------------------------------------------
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    }

HEADERS = load_headers()

# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------
client = httpx.Client(
    http2=True,
    verify=False,
    proxy=PROXY,
    timeout=15,
    headers=HEADERS,
)


def graphql_query(query: str, variables: dict = None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    try:
        r = client.post(ENDPOINT, json=payload)
        if r.status_code != 200:
            print(f"[!] HTTP {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        print(f"[!] Request failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Parse Apollo "Did you mean" suggestions
# ---------------------------------------------------------------------------
SUGGESTION_RE = re.compile(
    r'Did you mean\s+"([^"]+)"(?:,\s+"([^"]+)"(?:,\s+or\s+"([^"]+)")?)?'
)
FIELD_ERROR_RE = re.compile(
    r'Cannot query field "([^"]+)" on type "([^"]+)"'
)


def extract_suggestions(error_message: str):
    if not error_message:
        return []
    match = SUGGESTION_RE.search(error_message)
    if not match:
        return []
    return [g for g in match.groups() if g]


def extract_type_from_error(error_message: str):
    match = FIELD_ERROR_RE.search(error_message)
    if match:
        return match.group(2)
    return None


# ---------------------------------------------------------------------------
# Discovery engine
# ---------------------------------------------------------------------------
schema = {}  # type_name -> {field_name: return_type_or_unknown}


def get_suggestions(query_str: str):
    """Send a query and return all suggestions from error messages."""
    data = graphql_query(query_str)
    if not data:
        return []
    all_sugg = []
    for err in data.get("errors", []):
        msg = err.get("message", "")
        sugg = extract_suggestions(msg)
        if sugg:
            all_sugg.extend(sugg)
            print(f"    [+] Suggestions: {sugg}")
        t = extract_type_from_error(msg)
        if t:
            print(f"    [i] Error type: {t}")
    return all_sugg


def discover_fields_on_query():
    """Discover fields on the root Query type."""
    print("[*] Discovering root Query fields...")
    found = set()

    # Try a completely invalid field
    for probe in ["aaaa", "bbbb", "zzzz"]:
        q = "query { " + probe + " }"
        found.update(get_suggestions(q))

    # If still empty, try typos of known fields
    if not found:
        for known in KNOWN_ROOT_FIELDS:
            typo = known[:-1] if len(known) > 3 else known + "x"
            q = "query { " + typo + " }"
            found.update(get_suggestions(q))

    # Seed known fields
    for kf in KNOWN_ROOT_FIELDS:
        found.add(kf)

    return {f: "UNKNOWN" for f in found}


def discover_fields_on_type(type_name: str, path_to_object: str):
    """
    Discover fields on a type by putting an invalid leaf inside path_to_object.
    path_to_object example: geolocation(placeId: "49.2827,-123.1207")
    """
    print(f"[*] Discovering fields on type '{type_name}' via: {path_to_object}")
    found = set()
    for probe in ["aaaa", "bbbb", "zzzz", "xxxx"]:
        q = "query { " + path_to_object + " { " + probe + " } }"
        found.update(get_suggestions(q))
    return {f: "UNKNOWN" for f in found}


def discover_schema():
    print("=" * 60)
    print("Apollo Field-Suggestion Schema Discovery")
    print(f"Target: {ENDPOINT}")
    print("=" * 60)

    # --- Root Query ---
    schema["Query"] = discover_fields_on_query()
    print(f"[*] Query fields: {list(schema['Query'].keys())}")

    # --- Geolocation ---
    if "geolocation" in schema["Query"]:
        schema["Geolocation"] = discover_fields_on_type(
            "Geolocation",
            'geolocation(placeId: "49.2827,-123.1207")'
        )

    # --- LocationConnection / whatever locations returns ---
    if "Geolocation" in schema and "locations" in schema["Geolocation"]:
        # First, find out what type locations returns
        q = 'query { geolocation(placeId: "49.2827,-123.1207") { locations(first: 1) { aaaa } } }'
        data = graphql_query(q)
        return_type = None
        if data:
            for err in data.get("errors", []):
                t = extract_type_from_error(err.get("message", ""))
                if t:
                    return_type = t
                    print(f"[*] 'locations' returns type: {t}")
                    break

        if return_type:
            schema[return_type] = discover_fields_on_type(
                return_type,
                'geolocation(placeId: "49.2827,-123.1207") { locations(first: 1) }'
            )

            # --- edges ---
            if "edges" in schema[return_type]:
                edge_type = return_type.replace("Connection", "Edge")
                schema[edge_type] = discover_fields_on_type(
                    edge_type,
                    'geolocation(placeId: "49.2827,-123.1207") { locations(first: 1) { edges } }'
                )

                # --- node ---
                if "node" in schema.get(edge_type, {}):
                    q = 'query { geolocation(placeId: "49.2827,-123.1207") { locations(first: 1) { edges { node { aaaa } } } } }'
                    data = graphql_query(q)
                    node_type = None
                    if data:
                        for err in data.get("errors", []):
                            t = extract_type_from_error(err.get("message", ""))
                            if t:
                                node_type = t
                                print(f"[*] 'node' returns type: {t}")
                                break

                    if node_type:
                        schema[node_type] = discover_fields_on_type(
                            node_type,
                            'geolocation(placeId: "49.2827,-123.1207") { locations(first: 1) { edges { node } } }'
                        )

    # --- Save ---
    output = "fresha_discovered_schema.json"
    Path(output).write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(f"\n[*] Saved discovered schema to: {output}")
    print(f"[*] Types discovered: {len(schema)}")
    for t, fields in schema.items():
        print(f"    {t}: {len(fields)} fields  -> {list(fields.keys())}")


if __name__ == "__main__":
    try:
        discover_schema()
    except KeyboardInterrupt:
        print("\n[!] Interrupted")
        Path("fresha_discovered_schema_partial.json").write_text(
            json.dumps(schema, indent=2), encoding="utf-8"
        )
        print("[*] Partial results saved")
    finally:
        client.close()
