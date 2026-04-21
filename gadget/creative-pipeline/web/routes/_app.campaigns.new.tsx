import { useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useFindFirst } from "@gadgetinc/react";
import { api } from "../api";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": any;
      "s-card": any;
      "s-section": any;
      "s-text-field": any;
      "s-button": any;
      "s-select": any;
      "s-text": any;
      "s-heading": any;
      "s-box": any;
      "s-banner": any;
      "s-checkbox": any;
      "s-block-stack": any;
      "s-inline-stack": any;
      "s-divider": any;
    }
  }
}

interface MessageFields {
  headline: string;
  subhead: string;
  fonts: string;
}

const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
];

export default function NewCampaignPage() {
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["en", "fr"]);
  const [messages, setMessages] = useState<Record<string, MessageFields>>({
    en: { headline: "", subhead: "", fonts: "" },
    fr: { headline: "", subhead: "", fonts: "" },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get the current shop's brand
  const [{ data: brandData }] = useFindFirst(api.brand, {
    select: { id: true },
  });

  // Campaign create action
  const [, createCampaign] = useAction(api.campaign.create);

  const toggleRegion = (lang: string) => {
    setSelectedRegions((prev) =>
      prev.includes(lang) ? prev.filter((r) => r !== lang) : [...prev, lang]
    );
  };

  const updateMessage = (lang: string, field: keyof MessageFields, value: string) => {
    setMessages((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Campaign name is required";
    }
    if (!imagePrompt.trim()) {
      newErrors.imagePrompt = "Image prompt is required";
    }
    if (selectedRegions.length === 0) {
      newErrors.regions = "Please select at least one region";
    }

    for (const lang of selectedRegions) {
      const msg = messages[lang];
      if (!msg?.headline?.trim()) {
        newErrors[`${lang}-headline`] = "Headline is required";
      }
      if (!msg?.subhead?.trim()) {
        newErrors[`${lang}-subhead`] = "Subhead is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);

    try {
      const campaignResult = await createCampaign({
        name,
        imagePrompt: { markdown: imagePrompt },
        audience: audience.trim() ? { markdown: audience } : undefined,
        status: "draft",
        regions: selectedRegions,
        brand: brandData?.id ? { _link: brandData.id } : undefined,
      });

      if (campaignResult?.error) {
        setSubmitError(campaignResult.error.message);
        setSaving(false);
        return;
      }

      const newCampaignId = campaignResult?.data?.id;
      if (!newCampaignId) {
        setSubmitError("Failed to create campaign. Please try again.");
        setSaving(false);
        return;
      }

      // Create campaign messages for each selected language
      for (const lang of selectedRegions) {
        const msg = messages[lang];
        await api.campaignMessage.create({
          headline: msg.headline,
          subhead: msg.subhead,
          fonts: msg.fonts.trim() ? msg.fonts : null,
          language: lang as "en" | "fr",
          campaign: { _link: newCampaignId },
        });
      }

      navigate(`/campaigns/${newCampaignId}/products`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An unexpected error occurred";
      setSubmitError(message);
      setSaving(false);
    }
  };

  return (
    <s-page title="New Campaign">
      <s-box padding="400">
        {/* Back link */}
        <s-box padding-block-end="400">
          <s-button variant="plain" onClick={() => navigate("/campaigns")}>
            ← Back to campaigns
          </s-button>
        </s-box>

        {/* Global error banner */}
        {submitError && (
          <s-box padding-block-end="400">
            <s-banner tone="critical" title="Error creating campaign">
              <s-text>{submitError}</s-text>
            </s-banner>
          </s-box>
        )}

        <s-block-stack gap="400">
          {/* Section 1: Campaign Details */}
          <s-card>
            <s-box padding="400">
              <s-block-stack gap="400">
                <s-heading>Campaign Details</s-heading>

                <s-text-field
                  label="Campaign Name"
                  value={name}
                  placeholder="e.g. Summer Sale 2025"
                  required-indicator
                  error={errors.name ?? ""}
                  onInput={(e: any) => setName(e.target?.value ?? "")}
                />

                <s-text-field
                  label="Image Prompt"
                  value={imagePrompt}
                  multiline="4"
                  placeholder="Describe the visual scene for your ads, e.g. Festive Christmas setting with warm holiday lighting..."
                  required-indicator
                  error={errors.imagePrompt ?? ""}
                  onInput={(e: any) => setImagePrompt(e.target?.value ?? "")}
                />

                <s-text-field
                  label="Target Audience"
                  value={audience}
                  multiline="3"
                  placeholder="Describe your target audience, e.g. Young adults aged 25-35 interested in home decor..."
                  onInput={(e: any) => setAudience(e.target?.value ?? "")}
                />

                <s-block-stack gap="200">
                  <s-text>
                    <strong>Regions</strong>
                  </s-text>
                  {errors.regions && (
                    <s-text tone="critical">{errors.regions}</s-text>
                  )}
                  <s-inline-stack gap="400">
                    {LANGUAGES.map((lang) => (
                      <s-checkbox
                        key={lang.value}
                        label={lang.label}
                        checked={selectedRegions.includes(lang.value)}
                        onChange={() => toggleRegion(lang.value)}
                      />
                    ))}
                  </s-inline-stack>
                </s-block-stack>
              </s-block-stack>
            </s-box>
          </s-card>

          {/* Section 2: Ad Copy per selected language */}
          {LANGUAGES.filter((lang) => selectedRegions.includes(lang.value)).map(
            (lang) => (
              <s-card key={lang.value}>
                <s-box padding="400">
                  <s-block-stack gap="400">
                    <s-heading>Ad Copy — {lang.label}</s-heading>

                    <s-text-field
                      label="Headline"
                      value={messages[lang.value]?.headline ?? ""}
                      placeholder={`Enter headline in ${lang.label}`}
                      required-indicator
                      error={errors[`${lang.value}-headline`] ?? ""}
                      onInput={(e: any) =>
                        updateMessage(lang.value, "headline", e.target?.value ?? "")
                      }
                    />

                    <s-text-field
                      label="Subhead"
                      value={messages[lang.value]?.subhead ?? ""}
                      placeholder={`Enter subhead in ${lang.label}`}
                      required-indicator
                      error={errors[`${lang.value}-subhead`] ?? ""}
                      onInput={(e: any) =>
                        updateMessage(lang.value, "subhead", e.target?.value ?? "")
                      }
                    />

                    <s-text-field
                      label="Custom Fonts"
                      value={messages[lang.value]?.fonts ?? ""}
                      placeholder="e.g. Arial, Helvetica (optional)"
                      onInput={(e: any) =>
                        updateMessage(lang.value, "fonts", e.target?.value ?? "")
                      }
                    />
                  </s-block-stack>
                </s-box>
              </s-card>
            )
          )}

          {/* Submit button */}
          <s-box padding-block-start="200">
            <s-button
              variant="primary"
              loading={saving}
              disabled={saving}
              onClick={handleSubmit}
            >
              Save &amp; Pick Products
            </s-button>
          </s-box>
        </s-block-stack>
      </s-box>
    </s-page>
  );
}