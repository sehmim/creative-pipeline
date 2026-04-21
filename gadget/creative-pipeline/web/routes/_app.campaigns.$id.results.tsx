import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useFindOne, useFindMany } from "@gadgetinc/react";
import { api } from "../api";

const SIZE_LABELS: Record<string, string> = {
  "16x9": "16:9 Landscape",
  "1x1": "1:1 Square",
  "9x16": "9:16 Portrait",
};

const SIZES = ["16x9", "1x1", "9x16"] as const;

export default function CampaignResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [
    { data: campaign, fetching: campaignFetching, error: campaignError },
    refetchCampaign,
  ] = useFindOne(api.campaign, id!, {
    select: {
      id: true,
      name: true,
      status: true,
      generatedAt: true,
    },
  });

  const [{ data: campaignProducts }, refetchProducts] = useFindMany(
    api.campaignProduct,
    {
      filter: { campaignId: { equals: id } },
      select: {
        id: true,
        shopifyProductId: true,
        shopifyProduct: {
          title: true,
          featuredMedia: {
            file: {
              preview: true,
            },
          },
        },
        generatedAssets: {
          edges: {
            node: {
              id: true,
              size: true,
              language: true,
              file: {
                url: true,
                fileName: true,
                mimeType: true,
              },
            },
          },
        },
      },
    }
  );

  useEffect(() => {
    if (campaign?.status !== "generating") return;

    const interval = setInterval(() => {
      refetchCampaign({ requestPolicy: "network-only" });
      refetchProducts({ requestPolicy: "network-only" });
    }, 3000);

    return () => clearInterval(interval);
  }, [campaign?.status, refetchCampaign, refetchProducts]);

  if (campaignFetching && !campaign) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        {/* @ts-ignore */}
        <s-spinner />
      </div>
    );
  }

  if (campaignError) {
    return (
      // @ts-ignore
      <s-page>
        {/* @ts-ignore */}
        <s-banner tone="critical">
          Error loading campaign: {campaignError.message}
        </s-banner>
        <div style={{ marginTop: "16px" }}>
          {/* @ts-ignore */}
          <s-button onClick={() => navigate("/")}>Back to Campaigns</s-button>
        </div>
        {/* @ts-ignore */}
      </s-page>
    );
  }

  const status = campaign?.status;
  const campaignName = campaign?.name ?? "Campaign";

  return (
    // @ts-ignore
    <s-page>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {/* @ts-ignore */}
        <s-heading>{campaignName}</s-heading>
        {status && (
          // @ts-ignore
          <s-badge
            tone={
              status === "completed"
                ? "success"
                : status === "generating"
                  ? "attention"
                  : "info"
            }
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {/* @ts-ignore */}
          </s-badge>
        )}
      </div>

      <div style={{ marginBottom: "24px" }}>
        {/* @ts-ignore */}
        <s-button variant="plain" onClick={() => navigate("/")}>
          ← Back to Campaigns
          {/* @ts-ignore */}
        </s-button>
      </div>

      {status === "generating" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "64px 0",
            gap: "24px",
          }}
        >
          {/* @ts-ignore */}
          <s-spinner />
          {/* @ts-ignore */}
          <s-text>Generating your ads... this may take a moment</s-text>
        </div>
      )}

      {status === "draft" && (
        <div>
          {/* @ts-ignore */}
          <s-banner tone="info">No assets generated yet</s-banner>
          <div style={{ marginTop: "16px" }}>
            {/* @ts-ignore */}
            <s-button onClick={() => navigate(`/campaigns/${id}/products`)}>
              Go to Product Picker
              {/* @ts-ignore */}
            </s-button>
          </div>
        </div>
      )}

      {status === "completed" && (
        <div>
          {/* @ts-ignore */}
          <s-banner tone="success">
            Assets generated on{" "}
            {campaign?.generatedAt
              ? new Date(campaign.generatedAt).toLocaleDateString()
              : "N/A"}
            {/* @ts-ignore */}
          </s-banner>

          <div style={{ marginTop: "16px", marginBottom: "32px" }}>
            {/* @ts-ignore */}
            <s-button
              onClick={() => alert("Download All functionality coming soon!")}
            >
              Download All
              {/* @ts-ignore */}
            </s-button>
          </div>

          {campaignProducts?.map((product) => {
            const assets =
              product.generatedAssets?.edges?.map((edge) => edge.node) ?? [];

            return (
              <div key={product.id} style={{ marginBottom: "24px" }}>
                {/* @ts-ignore */}
                <s-card>
                  {/* @ts-ignore */}
                  <s-section>
                    {/* @ts-ignore */}
                    <s-heading>
                      {product.shopifyProduct?.title ??
                        `Product ${product.shopifyProductId}`}
                      {/* @ts-ignore */}
                    </s-heading>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "24px",
                        marginTop: "16px",
                      }}
                    >
                      {SIZES.map((size) => {
                        const sizeAssets = assets.filter(
                          (a) => a.size === size
                        );
                        return (
                          <div key={size}>
                            <div
                              style={{
                                marginBottom: "8px",
                                fontWeight: 600,
                                fontSize: "14px",
                              }}
                            >
                              {/* @ts-ignore */}
                              <s-text>{SIZE_LABELS[size]}</s-text>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              {sizeAssets.length === 0 ? (
                                // @ts-ignore
                                <s-text tone="subdued">No assets</s-text>
                              ) : (
                                sizeAssets.map((asset) => (
                                  <div
                                    key={asset.id}
                                    style={{
                                      border: "1px solid #e1e3e5",
                                      borderRadius: "8px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {asset.file?.url && (
                                      <img
                                        src={asset.file.url}
                                        alt={`${SIZE_LABELS[size]} - ${asset.language?.toUpperCase()}`}
                                        style={{
                                          width: "100%",
                                          display: "block",
                                        }}
                                      />
                                    )}
                                    <div
                                      style={{
                                        padding: "8px 12px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        backgroundColor: "#f6f6f7",
                                      }}
                                    >
                                      {/* @ts-ignore */}
                                      <s-badge>
                                        {asset.language?.toUpperCase()}
                                        {/* @ts-ignore */}
                                      </s-badge>
                                      {asset.file?.url && (
                                        <a
                                          href={asset.file.url}
                                          download={
                                            asset.file.fileName ??
                                            `asset-${asset.id}`
                                          }
                                          style={{ textDecoration: "none" }}
                                        >
                                          {/* @ts-ignore */}
                                          <s-button variant="plain">
                                            Download
                                            {/* @ts-ignore */}
                                          </s-button>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* @ts-ignore */}
                  </s-section>
                  {/* @ts-ignore */}
                </s-card>
              </div>
            );
          })}
        </div>
      )}
      {/* @ts-ignore */}
    </s-page>
  );
}