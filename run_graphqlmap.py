#!/usr/bin/env python3
"""
Wrapper to run GraphQLmap from the local GraphQLmap/ directory.

Examples:
    # Connect using POST with an auth token
    python run_graphqlmap.py -u https://yourhostname.com/graphql -v --method POST --headers '{"Authorization" : "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'

    # Pass request through Burp Proxy
    python run_graphqlmap.py -u "http://172.17.0.1:5013/graphql" --proxy http://127.0.0.1:8080
"""

import sys
import os
import argparse
import json

# Ensure the local GraphQLmap package is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPHQLMAP_DIR = os.path.join(SCRIPT_DIR, "GraphQLmap")
sys.path.insert(0, GRAPHQLMAP_DIR)

try:
    import readline
except ImportError:
    try:
        import pyreadline3 as readline
    except ImportError:
        readline = None

from graphqlmap.attacks import *
from graphqlmap.utils import auto_completer, cmdlist, jq, requester
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class GraphQLmap(object):
    author = "@pentest_swissky"
    version = "1.1"
    endpoint = "graphql"
    method = "POST"
    args = None
    url = None
    headers = None
    use_json = False

    def __init__(self, args_graphql):
        print(r"   _____                 _      ____  _                            ")
        print(r"  / ____|               | |    / __ \| |                           ")
        print(r" | |  __ _ __ __ _ _ __ | |__ | |  | | |     _ __ ___   __ _ _ __  ")
        print(r" | | |_ | '__/ _` | '_ \| '_ \| |  | | |    | '_ ` _ \ / _` | '_ \ ")
        print(r" | |__| | | | (_| | |_) | | | | |__| | |____| | | | | | (_| | |_) |")
        print(r"  \_____|_|  \__,_| .__/|_| |_|\___\_\______|_| |_| |_|\__,_| .__/ ")
        print(r"                  | |                                       | |    ")
        print(r"                  |_|                                       |_|    ")
        print(" " * 30, end='')
        print(f"\033[1mAuthor\033[0m: {self.author} \033[1mVersion\033[0m: {self.version} ")
        self.args = args_graphql
        self.url = args_graphql.url
        self.method = args_graphql.method
        self.headers = None
        if args_graphql.headers:
            raw = args_graphql.headers.strip()
            # Support @file.json convention (like curl) for easy Windows usage
            if raw.startswith("@"):
                with open(raw[1:], "r", encoding="utf-8") as f:
                    self.headers = json.load(f)
            else:
                try:
                    self.headers = json.loads(raw)
                except json.JSONDecodeError:
                    # Fallback: simple "Key: Value, Key: Value" format
                    self.headers = {}
                    for part in raw.split(","):
                        if ":" in part:
                            k, v = part.split(":", 1)
                            self.headers[k.strip()] = v.strip()
        self.use_json = True if args_graphql.use_json else False
        self.proxy = {
            "http": args_graphql.proxy,
        }

        while True:
            try:
                query = input("GraphQLmap > ")
            except (EOFError, KeyboardInterrupt):
                print("\nExiting...")
                break
            cmdlist.append(query)
            if query == "exit" or query == "q":
                exit()

            elif query == "help":
                display_help()

            elif query == "debug":
                display_types(self.url, self.method, self.proxy, self.headers, self.use_json)

            elif query == "dump_via_introspection":
                dump_schema(self.url, self.method, 15, self.proxy, self.headers, self.use_json)

            elif query == "dump_via_fragment":
                dump_schema(self.url, self.method, 14, self.proxy, self.headers, self.use_json)

            elif query == "nosqli":
                blind_nosql(self.url, self.method, self.proxy, self.headers, self.use_json)

            elif query == "postgresqli":
                blind_postgresql(self.url, self.method, self.proxy, self.headers, self.use_json)

            elif query == "mysqli":
                blind_mysql(self.url, self.method, self.proxy, self.headers, self.use_json)

            elif query == "mssqli":
                blind_mssql(self.url, self.method, self.proxy, self.headers, self.use_json)

            else:
                exec_advanced(self.url, self.method, query, self.headers, self.use_json, self.proxy)


def parse_args():
    parser = argparse.ArgumentParser(
        description="GraphQLmap wrapper — scripting engine to interact with a GraphQL endpoint for pentesting purposes"
    )
    parser.add_argument('-u', action='store', dest='url', help="URL to query : example.com/graphql?query={}", required=True)
    parser.add_argument('-v', action='store', dest='verbosity', help="Enable verbosity", nargs='?', const=True)
    parser.add_argument('--method', action='store', dest='method',
                        help="HTTP Method to use interact with /graphql endpoint", nargs='?', const=True, default="GET")
    parser.add_argument('--headers', action='store', dest='headers', help="HTTP Headers sent to /graphql endpoint (JSON string)",
                        nargs='?', const=True, type=str)
    parser.add_argument('--json', action='store', dest='use_json', help="Use JSON encoding, implies POST", nargs='?', const=True, type=bool)
    parser.add_argument('--proxy', action='store', dest='proxy',
                        help="HTTP proxy to log requests", nargs='?', const=True, default=None)
    return parser.parse_args()


def display_help():
    print("[+] \033[92mdump_via_introspection \033[0m: dump GraphQL schema (fragment+FullType)")
    print("[+] \033[92mdump_via_fragment      \033[0m: dump GraphQL schema (IntrospectionQuery)")
    print("[+] \033[92mnosqli      \033[0m: exploit a nosql injection inside a GraphQL query")
    print("[+] \033[92mpostgresqli \033[0m: exploit a sql injection inside a GraphQL query")
    print("[+] \033[92mmysqli      \033[0m: exploit a sql injection inside a GraphQL query")
    print("[+] \033[92mmssqli      \033[0m: exploit a sql injection inside a GraphQL query")
    print("[+] \033[92mexit        \033[0m: gracefully exit the application")


if __name__ == "__main__":
    if readline:
        readline.set_completer(auto_completer)
        readline.parse_and_bind("tab: complete")
    args = parse_args()
    GraphQLmap(args)
