import { FRESHA_BASE } from './config';

export interface FreshaSalonInfo {
  name: string;
  slug: string;
  contactNumber?: string;
  rating?: number;
  reviewsCount?: number;
  address?: {
    shortFormatted?: string;
    streetAddress?: string;
    cityName?: string;
    latitude?: string;
    longitude?: string;
    mapsUrl?: string;
  };
  description?: string;
}

export async function fetchSalonInfo(slug: string): Promise<FreshaSalonInfo> {
  const html = await fetch(`${FRESHA_BASE}/a/${slug}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-CA',
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} fetching salon page`);
    return r.text();
  });

  const startTag = '<script id="__NEXT_DATA__" type="application/json">';
  const i = html.indexOf(startTag);
  if (i === -1) {
    throw new Error('__NEXT_DATA__ not found in salon page');
  }
  const j = html.indexOf('</script>', i + startTag.length);
  if (j === -1) {
    throw new Error('Could not extract __NEXT_DATA__ JSON');
  }

  const json = JSON.parse(html.slice(i + startTag.length, j)) as {
    props?: {
      pageProps?: {
        data?: {
          location?: FreshaSalonInfo;
        };
      };
    };
  };

  const location = json.props?.pageProps?.data?.location;
  if (!location) {
    throw new Error('Location data not found in __NEXT_DATA__');
  }

  return location;
}
