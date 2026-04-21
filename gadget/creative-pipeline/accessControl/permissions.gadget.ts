import type { GadgetPermissions } from "gadget-server";

/**
 * This metadata describes the access control configuration available in your application.
 * Grants that are not defined here are set to false by default.
 *
 * View and edit your roles and permissions in the Gadget editor at https://creative-pipeline.gadget.app/edit/settings/permissions
 */
export const permissions: GadgetPermissions = {
  type: "gadget/permissions/v1",
  roles: {
    "shopify-app-users": {
      storageKey: "Role-Shopify-App",
      models: {
        brand: {
          read: {
            filter: "accessControl/filters/shopify/brand.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        campaign: {
          read: {
            filter: "accessControl/filters/shopify/campaign.gelly",
          },
          actions: {
            create: true,
            delete: true,
            generate: true,
            update: true,
          },
        },
        campaignMessage: {
          read: {
            filter:
              "accessControl/filters/shopify/campaignMessage.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        campaignProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/campaignProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        generatedAsset: {
          read: {
            filter:
              "accessControl/filters/shopify/generatedAsset.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyFile: {
          read: {
            filter: "accessControl/filters/shopify/shopifyFile.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyGdprRequest: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyGdprRequest.gelly",
          },
          actions: {
            create: true,
            update: true,
          },
        },
        shopifyProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProduct.gelly",
          },
        },
        shopifyProductMedia: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductMedia.gelly",
          },
        },
        shopifyShop: {
          read: {
            filter: "accessControl/filters/shopify/shopifyShop.gelly",
          },
          actions: {
            install: true,
            reinstall: true,
            uninstall: true,
            update: true,
          },
        },
        shopifySync: {
          read: {
            filter: "accessControl/filters/shopify/shopifySync.gelly",
          },
          actions: {
            abort: true,
            complete: true,
            error: true,
            run: true,
          },
        },
      },
      actions: {
        fetchShopBranding: true,
        runImageGeneration: true,
        scheduledShopifySync: true,
      },
    },
    unauthenticated: {
      storageKey: "unauthenticated",
    },
  },
};
