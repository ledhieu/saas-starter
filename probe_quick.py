import json, requests, urllib3
urllib3.disable_warnings()

URL = 'https://www.fresha.com/graphql'
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96',
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}
BODY = {
    'query': 'query { geolocation(placeId: "49.2827,-123.1207") { locations(query: "nail salon", first: 3) { edges { node { id name slug } } } } }',
    'variables': {},
}

r = requests.post(URL, json=BODY, headers=HEADERS, verify=False, timeout=15)
print('Status:', r.status_code)
print('Content-Type:', r.headers.get('Content-Type'))
print('Body first 300 chars:', r.text[:300])
