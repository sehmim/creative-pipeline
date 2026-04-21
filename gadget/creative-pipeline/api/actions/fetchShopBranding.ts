import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopify = connections.shopify.current;
  if (!shopify) {
    throw new Error("No Shopify connection found");
  }

  logger.info("Fetching shop info and active theme from Shopify");

  const shopAndThemeQuery = `
    query {
      shop {
        name
        description
        email
        primaryDomain {
          url
        }
      }
      themes(first: 1, roles: [MAIN]) {
        nodes {
          id
          name
          role
        }
      }
    }
  `;

  const shopAndThemeResult = await shopify.graphql(shopAndThemeQuery);
  logger.info(
    { shopName: shopAndThemeResult?.shop?.name, themeNodes: shopAndThemeResult?.themes?.nodes },
    "Fetched shop info and theme data"
  );

  const shop = shopAndThemeResult?.shop;
  const themeNodes = shopAndThemeResult?.themes?.nodes;
  const themeName: string | null = themeNodes?.[0]?.name ?? null;
  const shopDomain: string | null = shop?.primaryDomain?.url ?? null;

  logger.info({ themeName }, "Extracted active theme name");
  logger.info({ shopDomain }, "Extracted shop domain");

  logger.info("Fetching shop brand metafields from Shopify");

  const metafieldsQuery = `
    query {
      shop {
        metafields(first: 10, namespace: "brand") {
          nodes {
            key
            value
          }
        }
      }
    }
  `;

  const metafieldsResult = await shopify.graphql(metafieldsQuery);
  const metafieldNodes = metafieldsResult?.shop?.metafields?.nodes ?? [];
  logger.info({ metafieldNodes }, "Fetched shop brand metafields");

  const name: string | null = shop?.name ?? null;
  const description: string | null = shop?.description ?? null;

  logger.info({ name }, "Extracted shop name");
  logger.info({ description }, "Extracted shop description");

  const result = {
    name,
    description,
    colors: [] as string[],
    logoUrl: null as string | null,
    coverImageUrl: null as string | null,
    themeName,
    shopDomain,
  };

  logger.info({ result }, "Returning branding data");

  return result;
};

export const params = {};

export const options: ActionOptions = {
  triggers: { api: true },
  returnType: true,
};
