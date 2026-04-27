#!/usr/bin/env python3
"""Quick diagnostic to see what Fresha returns to an introspection query."""
import json, requests, urllib3
urllib3.disable_warnings()

URL = "https://www.fresha.com/graphql"
PROXY = None  # Set to {"http": "http://127.0.0.1:8080", "https": "http://127.0.0.1:8080"} if using Burp

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Accept-Language": "en-CA",
    "x-client-platform": "web",
    "x-client-version": "1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96",
    "Origin": "https://www.fresha.com",
    "Referer": "https://www.fresha.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

QUERIES = {
    "introspection": """
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types { name kind }
      }
    }
    """,
    "geolocation_search": """
    query {
      geolocation(placeId: "49.2827,-123.1207") {
        locations(query: "nail salon", first: 3) {
          edges { node { id name slug } }
        }
      }
    }
    """,
}

def test_query(name, query):
    print(f"\n{'='*60}")
    print(f"Query: {name}")
    print(f"POST {URL} | Proxy: {PROXY}")
    print("-" * 50)

    r = requests.post(
        URL,
        json={"query": query},
        headers=HEADERS,
        proxies=PROXY,
        verify=False,
        timeout=15,
    )

    print(f"Status: {r.status_code}")
    print(f"Content-Type: {r.headers.get('Content-Type', 'N/A')}")
    print(f"Content-Length: {len(r.text)}")
    print("-" * 50)
    print("Body preview (first 600 chars):")
    print(r.text[:600])
    print("-" * 50)

    try:
        data = r.json()
        if data.get("errors"):
            print("GraphQL errors:")
            for e in data["errors"]:
                print("  -", e.get("message", e))
        elif data.get("data"):
            print("SUCCESS — got data")
    except Exception as e:
        print(f"Not valid JSON: {e}")

for name, q in QUERIES.items():
    test_query(name, q)
