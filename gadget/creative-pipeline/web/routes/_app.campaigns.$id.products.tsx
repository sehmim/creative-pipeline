import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useFindOne, useFindMany } from "@gadgetinc/react";
import { api } from "../api";

interface ShopifyPreviewImage {
  url?: string;
}

interface ShopifyPreview {
  image?: ShopifyPreviewImage;
}

export default function ProductPickerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const campaignId = id ?? "";

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showMaxWarning, setShowMaxWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [{ data: campaign, fetching: campaignFetching, error: campaignError }] = useFindOne(
    api.campaign,
    campaignId,
    {
      select: {
        id: true,
        name: true,
        status: true,
        campaignProducts: {
          edges: {
            node: {
              id: true,
              shopifyProductId: true,
            },
          },
        },
      },
    }
  );

  const [{ data: products, fetching: productsFetching, error: productsError }] = useFindMany(
    api.shopifyProduct,
    {
      first: 50,
      filter: { status: { equals: "active" } },
      select: {
        id: true,
        title: true,
        status: true,
        vendor: true,
        featuredMedia: {
          file: {
            preview: true,
          },
        },
      },
    }
  );

  const [{ data: campaignProducts, fetching: campaignProductsFetching }] = useFindMany(
    api.campaignProduct,
    {
      filter: { campaignId: { equals: campaignId } },
      select: {
        id: true,
        shopifyProductId: true,
      },
    }
  );

  useEffect(() => {
    if (!initialized && campaignProducts && campaignProducts.length >= 0) {
      const initialSelected = new Set<string>(
        campaignProducts
          .filter((cp) => cp.shopifyProductId != null)
          .map((cp) => cp.shopifyProductId as string)
      );
      setSelectedProductIds(initialSelected);
      setInitialized(true);
    }
  }, [campaignProducts, initialized]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        setShowMaxWarning(false);
        return next;
      } else {
        if (next.size >= 5) {
          setShowMaxWarning(true);
          return prev;
        }
        setShowMaxWarning(false);
        next.add(productId);
        return next;
      }
    });
  };

  const handleGenerateAds = async () => {
    if (!campaignId || selectedProductIds.size === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedProductIds = new Set<string>(
        (campaignProducts ?? [])
          .filter((cp) => cp.shopifyProductId != null)
          .map((cp) => cp.shopifyProductId as string)
      );

      const campaignProductMap = new Map<string, string>(
        (campaignProducts ?? [])
          .filter((cp) => cp.shopifyProductId != null)
          .map((cp) => [cp.shopifyProductId as string, cp.id])
      );

      const toCreate = [...selectedProductIds].filter((pid) => !savedProductIds.has(pid));
      const toDelete = [...savedProductIds]
        .filter((pid) => !selectedProductIds.has(pid))
        .map((pid) => campaignProductMap.get(pid))
        .filter((cpId): cpId is string => cpId != null);

      await Promise.all([
        ...toCreate.map((productId) =>
          api.campaignProduct.create({
            campaign: { _link: campaignId },
            shopifyProduct: { _link: productId },
          })
        ),
        ...toDelete.map((cpId) => api.campaignProduct.delete(cpId)),
      ]);

      // Model action sets status to "generating" and enqueues background generation
      await api.campaign.generate(campaignId!);

      navigate(`/campaigns/${campaignId}/results`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setSubmitError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const isLoading = campaignFetching || productsFetching || campaignProductsFetching;
  const isGeneratingOrCompleted =
    campaign?.status === "generating" || campaign?.status === "completed";
  const isButtonDisabled =
    selectedProductIds.size === 0 || isGeneratingOrCompleted || isSubmitting;

  if (!isLoading && campaignError) {
    return (
      // @ts-expect-error Polaris web component
      <s-page title="Error">
        {/* @ts-expect-error Polaris web component */}
        <s-section>
          {/* @ts-expect-error Polaris web component */}
          <s-banner tone="critical">
            <p>Error loading campaign: {campaignError.message}</p>
            {/* @ts-expect-error Polaris web component */}
          </s-banner>
          {/* @ts-expect-error Polaris web component */}
        </s-section>
        {/* @ts-expect-error Polaris web component */}
      </s-page>
    );
  }

  const pageTitle = campaign?.name ?? "Select Products";

  return (
    // @ts-expect-error Polaris web component
    <s-page title={pageTitle}>
      {/* Loading skeleton */}
      {isLoading && !campaign && (
        // @ts-expect-error Polaris web component
        <s-section>
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            {/* @ts-expect-error Polaris web component */}
            <s-spinner />
          </div>
          {/* @ts-expect-error Polaris web component */}
        </s-section>
      )}

      {/* Max products warning */}
      {showMaxWarning && (
        // @ts-expect-error Polaris web component
        <s-section>
          {/* @ts-expect-error Polaris web component */}
          <s-banner tone="warning">
            <p>You can select a maximum of 5 products per campaign.</p>
            {/* @ts-expect-error Polaris web component */}
          </s-banner>
          {/* @ts-expect-error Polaris web component */}
        </s-section>
      )}

      {/* Status banner for generating/completed */}
      {isGeneratingOrCompleted && campaign && (
        // @ts-expect-error Polaris web component
        <s-section>
          {/* @ts-expect-error Polaris web component */}
          <s-banner tone="info">
            <p>
              This campaign is currently{" "}
              <strong>{campaign.status}</strong> and cannot be modified.
            </p>
            {/* @ts-expect-error Polaris web component */}
          </s-banner>
          {/* @ts-expect-error Polaris web component */}
        </s-section>
      )}

      {/* Submit error */}
      {submitError && (
        // @ts-expect-error Polaris web component
        <s-section>
          {/* @ts-expect-error Polaris web component */}
          <s-banner tone="critical">
            <p>Error: {submitError}</p>
            {/* @ts-expect-error Polaris web component */}
          </s-banner>
          {/* @ts-expect-error Polaris web component */}
        </s-section>
      )}

      {campaign && (
        <>
          {/* Header with count and action button */}
          {/* @ts-expect-error Polaris web component */}
          <s-section>
            {/* @ts-expect-error Polaris web component */}
            <s-box>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                }}
              >
                <div>
                  {/* @ts-expect-error Polaris web component */}
                  <s-heading>Select Products</s-heading>
                  {/* @ts-expect-error Polaris web component */}
                  <s-text tone="subdued">
                    {selectedProductIds.size} of 5 products selected
                  </s-text>
                  {/* @ts-expect-error Polaris web component */}
                </div>
                {/* @ts-expect-error Polaris web component */}
                <s-button
                  variant="primary"
                  disabled={isButtonDisabled}
                  loading={isSubmitting}
                  onClick={handleGenerateAds}
                >
                  {isSubmitting ? "Saving..." : "Generate Ads"}
                  {/* @ts-expect-error Polaris web component */}
                </s-button>
              </div>
              {/* @ts-expect-error Polaris web component */}
            </s-box>
            {/* @ts-expect-error Polaris web component */}
          </s-section>

          {/* Product grid */}
          {/* @ts-expect-error Polaris web component */}
          <s-section>
            {productsFetching ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                {/* @ts-expect-error Polaris web component */}
                <s-spinner />
              </div>
            ) : productsError ? (
              // @ts-expect-error Polaris web component
              <s-banner tone="critical">
                <p>Error loading products: {productsError.message}</p>
                {/* @ts-expect-error Polaris web component */}
              </s-banner>
            ) : (products ?? []).length === 0 ? (
              // @ts-expect-error Polaris web component
              <s-banner tone="info">
                <p>No active products found in your store.</p>
                {/* @ts-expect-error Polaris web component */}
              </s-banner>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1rem",
                }}
              >
                {(products ?? []).map((product) => {
                  const isSelected = selectedProductIds.has(product.id);
                  const preview = (product.featuredMedia as { file?: { preview?: ShopifyPreview } } | null)?.file
                    ?.preview as ShopifyPreview | null | undefined;
                  const imageUrl = preview?.image?.url;

                  return (
                    <div
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => toggleProduct(product.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleProduct(product.id);
                        }
                      }}
                      style={{
                        cursor: isGeneratingOrCompleted ? "default" : "pointer",
                        border: isSelected
                          ? "2px solid #008060"
                          : "2px solid #e1e3e5",
                        borderRadius: "8px",
                        overflow: "hidden",
                        backgroundColor: isSelected ? "#f0faf7" : "#ffffff",
                        transition: "border-color 0.2s, background-color 0.2s",
                        userSelect: "none",
                        opacity: isGeneratingOrCompleted ? 0.75 : 1,
                      }}
                    >
                      {/* Product image */}
                      <div
                        style={{
                          position: "relative",
                          paddingTop: "100%",
                          backgroundColor: "#f6f6f7",
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.title ?? ""}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              backgroundColor: "#c9cccf",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ color: "#6d7175", fontSize: "12px" }}>
                              No image
                            </span>
                          </div>
                        )}
                        {/* Selection checkbox overlay */}
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            pointerEvents: "none",
                          }}
                        >
                          {/* @ts-expect-error Polaris web component */}
                          <s-checkbox checked={isSelected} />
                        </div>
                      </div>

                      {/* Product info */}
                      <div style={{ padding: "12px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            marginBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.title}
                        </div>
                        <div style={{ color: "#6d7175", fontSize: "12px" }}>
                          {product.vendor}
                        </div>
                        {isSelected && (
                          <div style={{ marginTop: "6px" }}>
                            {/* @ts-expect-error Polaris web component */}
                            <s-badge tone="success">Selected</s-badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* @ts-expect-error Polaris web component */}
          </s-section>
        </>
      )}
      {/* @ts-expect-error Polaris web component */}
    </s-page>
  );
}