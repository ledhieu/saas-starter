// Probe Fresha's Query.reservation field
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const headers = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-CA',
  'x-client-platform': 'web',
  'x-client-version': CLIENT_VERSION,
  'Origin': 'https://www.fresha.com',
  'Referer': 'https://www.fresha.com/',
};

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: text.slice(0, 300) };
  }
}

// 1. Discover arguments for Query.reservation
console.log('\n=== 1. Argument discovery for Query.reservation ===');
for (const arg of ['id', 'uuid', 'reference', 'bookingId', 'reservationId', 'slug', 'aaaa']) {
  const q = `query { reservation(${arg}: "test123") { __typename } }`;
  const data = await gql(q);
  const errors = data.errors || [];
  for (const err of errors) {
    const msg = err.message || '';
    if (msg.includes('Unknown argument')) {
      const sugg = msg.match(/Did you mean\s+"([^"]+)"/)?.[1];
      console.log(`  [x] '${arg}' invalid${sugg ? ` -> Did you mean '${sugg}'?` : ''}`);
    } else if (msg.includes('Cannot query field')) {
      console.log(`  [?] '${arg}' accepted? Got field error: ${msg.slice(0, 100)}`);
    } else {
      console.log(`  [?] '${arg}' response: ${msg.slice(0, 100)}`);
    }
  }
  if (data.data) {
    console.log(`  [+] '${arg}' -> returned data:`, JSON.stringify(data.data).slice(0, 200));
  }
}

// 2. Discover subfields of Reservation type (if we can reach it)
console.log('\n=== 2. Subfield discovery for Reservation ===');
for (const probe of ['aaaa', 'bbbb', 'zzzz']) {
  // Try with a dummy id argument first; Apollo will suggest id if it's wrong
  const q = `query { reservation(${probe}: "x") { ${probe} } }`;
  const data = await gql(q);
  for (const err of data.errors || []) {
    const sugg = err.message?.match(/Did you mean\s+"([^"]+)"/)?.[1];
    if (sugg) console.log(`  [+] Suggestion: ${sugg} (${err.message.slice(0, 120)})`);
  }
}

// 3. Try a no-arg query to see if reservation is accessible without auth
console.log('\n=== 3. No-argument reservation query ===');
const noArg = await gql('query { reservation { __typename } }');
console.log('  Response:', JSON.stringify(noArg).slice(0, 300));

// 4. Try introspection-like typename on whatever reservation returns
console.log('\n=== 4. Typename probing ===');
for (const arg of ['id', 'uuid']) {
  const q = `query { reservation(${arg}: "12345") { __typename } }`;
  const data = await gql(q);
  console.log(`  ${arg}:`, JSON.stringify(data).slice(0, 250));
}
