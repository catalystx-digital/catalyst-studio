import fetch from 'node-fetch';

// Run a full export with:
// SKIP_DB_SETUP=true pnpm tsx scripts/generate-head/index.ts \
//   --provider ucs \
//   --website-id site_123 \
//   --data-source graphql \
//   --output ./generated/graphql \
//   --force

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface FetchSiteResult {
  website: {
    id: string;
    name: string;
    category: string;
  } | null;
  page: {
    id: string;
    fullPath: string;
    templateKey: string | null;
    components: Array<{
      id: string;
      type: string;
      sharedComponentId?: string | null;
    }>;
  } | null;
}

const endpoint = process.env.UCS_GRAPHQL_ENDPOINT;
const apiKey = process.env.UCS_GRAPHQL_API_KEY;
const websiteId = process.env.UCS_GRAPHQL_WEBSITE_ID;
const pageSlug = process.env.UCS_GRAPHQL_PAGE_SLUG ?? '/';

if (!endpoint || !apiKey || !websiteId) {
  console.error('Missing required env vars. Set UCS_GRAPHQL_ENDPOINT, UCS_GRAPHQL_API_KEY, and UCS_GRAPHQL_WEBSITE_ID.');
  process.exit(1);
}

const query = /* GraphQL */ `
  query FetchSite($websiteId: ID!, $slug: String!) {
    website(id: $websiteId) {
      id
      name
      category
    }
    page(websiteId: $websiteId, slug: $slug) {
      id
      fullPath
      templateKey
      components {
        id
        type
        sharedComponentId
      }
    }
  }
`;

async function main() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ucs-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { websiteId, slug: pageSlug },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GraphqlResponse<FetchSiteResult>;
  if (payload.errors?.length) {
    throw new Error(`GraphQL responded with errors: ${payload.errors.map(err => err.message).join(', ')}`);
  }

  console.log('Website:');
  console.log(JSON.stringify(payload.data?.website, null, 2));
  console.log('\nPage:');
  console.log(JSON.stringify(payload.data?.page, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
