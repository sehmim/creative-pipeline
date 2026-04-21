import { useFindMany, useAction } from "@gadgetinc/react";
import { useNavigate } from "react-router";
import { api } from "../api";

function getStatusBadgeTone(status: string): string {
  switch (status) {
    case "completed":
      return "success";
    case "generating":
      return "attention";
    case "draft":
    default:
      return "info";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "generating":
      return "Generating...";
    case "draft":
    default:
      return "Draft";
  }
}

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Index() {
  const [{ data: campaigns, fetching, error }] = useFindMany(api.campaign, {
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      generatedAt: true,
      campaignProducts: {
        edges: {
          node: {
            id: true,
          },
        },
      },
    },
    sort: { createdAt: "Descending" },
  });

  const [, deleteCampaign] = useAction(api.campaign.delete);
  const navigate = useNavigate();

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this campaign?")) {
      await deleteCampaign({ id });
    }
  };

  if (fetching) {
    return (
      <s-page heading="Ad Campaigns">
        <s-section>
          <s-box padding="loose">
            <s-text>Loading campaigns...</s-text>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading="Ad Campaigns">
        <s-section>
          <s-box padding="loose">
            <s-text>Error loading campaigns: {error.message}</s-text>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <s-page heading="Ad Campaigns">
        <s-button
          slot="primaryAction"
          variant="primary"
          onClick={() => navigate("/campaigns/new")}
        >
          New Campaign
        </s-button>
        <s-section>
          <s-empty-state heading="No campaigns yet">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <s-text>Create your first AI-powered ad campaign</s-text>
              <s-button variant="primary" onClick={() => navigate("/campaigns/new")}>
                Create Campaign
              </s-button>
            </div>
          </s-empty-state>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Ad Campaigns">
      <s-button
        slot="primaryAction"
        variant="primary"
        onClick={() => navigate("/campaigns/new")}
      >
        New Campaign
      </s-button>
      <s-section>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {campaigns.map((campaign) => {
            const productCount = campaign.campaignProducts?.edges?.length ?? 0;
            return (
              <div
                key={campaign.id}
                style={{
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "white",
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "8px" }}>
                      {campaign.name}
                    </div>
                    <div style={{ display: "flex", flexDirection: "row", gap: "8px", alignItems: "center" }}>
                      <s-badge tone={getStatusBadgeTone(campaign.status)}>
                        {getStatusLabel(campaign.status)}
                      </s-badge>
                      <s-text>{productCount} products</s-text>
                      <s-text>{formatDate(campaign.createdAt)}</s-text>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "row", gap: "8px", alignItems: "center" }}>
                    {campaign.status === "completed" && (
                      <s-button
                        variant="primary"
                        onClick={() => navigate(`/campaigns/${campaign.id}/results`)}
                      >
                        View Results
                      </s-button>
                    )}
                    {campaign.status === "draft" && (
                      <s-button
                        onClick={() => navigate(`/campaigns/${campaign.id}/products`)}
                      >
                        Select Products
                      </s-button>
                    )}
                    {campaign.status === "generating" && (
                      <s-button disabled>
                        Generating...
                      </s-button>
                    )}
                    <s-button
                      tone="critical"
                      variant="plain"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      Delete
                    </s-button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </s-section>
    </s-page>
  );
}
