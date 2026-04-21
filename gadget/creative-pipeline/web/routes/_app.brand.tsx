import { useState, useEffect } from "react";
import { useFindFirst, useAction, useGlobalAction } from "@gadgetinc/react";
import { api } from "../api";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": any;
      "s-section": any;
      "s-card": any;
      "s-text-field": any;
      "s-button": any;
      "s-select": any;
      "s-badge": any;
      "s-text": any;
      "s-heading": any;
      "s-box": any;
      "s-banner": any;
    }
  }
}

export default function BrandSetupPage() {
  const [{ data: brand, fetching: brandFetching, error: brandError }] = useFindFirst(api.brand, {
    select: {
      id: true,
      name: true,
      description: { markdown: true },
      colors: true,
      fonts: true,
      logoPath: true,
      logoPlacement: true,
      logoMaxHeightPercent: true,
      referenceAssets: true,
      prohibitedWords: true,
    },
  });

  const [{ fetching: creating, error: createError }, createBrand] = useAction(api.brand.create);
  const [{ fetching: updating, error: updateError }, updateBrand] = useAction(api.brand.update);
  const [{ fetching: isFetchingBranding }, fetchShopBranding] = useGlobalAction(api.fetchShopBranding);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colors, setColors] = useState<string[]>([""]);
  const [fonts, setFonts] = useState<string[]>([""]);
  const [logoPath, setLogoPath] = useState("");
  const [logoPlacement, setLogoPlacement] = useState("top-left");
  const [logoMaxHeightPercent, setLogoMaxHeightPercent] = useState(7);
  const [referenceAssets, setReferenceAssets] = useState("");
  const [prohibitedWordsText, setProhibitedWordsText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [prefillSuccess, setPrefillSuccess] = useState(false);

  useEffect(() => {
    if (!brandFetching && !initialized) {
      if (brand) {
        setName(brand.name ?? "");
        setDescription((brand.description as any)?.markdown ?? "");
        const brandColors = brand.colors as string[] | null;
        setColors(brandColors && brandColors.length > 0 ? brandColors : [""]);
        const brandFonts = brand.fonts as string[] | null;
        setFonts(brandFonts && brandFonts.length > 0 ? brandFonts : [""]);
        setLogoPath(brand.logoPath ?? "");
        setLogoPlacement(brand.logoPlacement ?? "top-left");
        setLogoMaxHeightPercent(brand.logoMaxHeightPercent ?? 7);
        setReferenceAssets(brand.referenceAssets ?? "");
        const words = brand.prohibitedWords as string[] | null;
        setProhibitedWordsText(words ? words.join(", ") : "");
      }
      setInitialized(true);
    }
  }, [brand, brandFetching, initialized]);

  const handlePrefill = async () => {
    setPrefillError(null);
    setPrefillSuccess(false);

    const result = await fetchShopBranding();

    if (result?.error) {
      setPrefillError(result.error.message);
    } else if (result?.data) {
      const data = result.data as any;
      setName(data.name ?? "");
      setDescription(data.description ?? "");
      if (data.colors) {
        const filteredColors = (data.colors as string[]).filter(Boolean).slice(0, 5);
        setColors(filteredColors.length > 0 ? filteredColors : [""]);
      }
      if (data.logoUrl) {
        setLogoPath(data.logoUrl);
      }
      setPrefillSuccess(true);
    }
  };

  const isSaving = creating || updating;
  const errorMessage = createError?.message ?? updateError?.message;

  const handleAddColor = () => {
    if (colors.length < 5) {
      setColors([...colors, ""]);
    }
  };

  const handleColorChange = (index: number, value: string) => {
    const newColors = [...colors];
    newColors[index] = value;
    setColors(newColors);
  };

  const handleRemoveColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const handleAddFont = () => {
    setFonts([...fonts, ""]);
  };

  const handleFontChange = (index: number, value: string) => {
    const newFonts = [...fonts];
    newFonts[index] = value;
    setFonts(newFonts);
  };

  const handleRemoveFont = (index: number) => {
    setFonts(fonts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setShowSuccess(false);

    const prohibitedWordsArray = prohibitedWordsText
      ? prohibitedWordsText
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean)
      : [];

    const filteredColors = colors.filter(Boolean);
    const filteredFonts = fonts.filter(Boolean);

    const payload = {
      name,
      description: { markdown: description },
      colors: filteredColors,
      fonts: filteredFonts,
      logoPath: logoPath || undefined,
      logoPlacement: logoPlacement as "top-left" | "top-right" | "center",
      logoMaxHeightPercent,
      referenceAssets: referenceAssets || undefined,
      prohibitedWords: prohibitedWordsArray,
    };

    if (brand?.id) {
      await updateBrand({ id: brand.id, ...payload });
    } else {
      await createBrand(payload);
    }

    setShowSuccess(true);
  };

  if (brandFetching && !initialized) {
    return (
      <s-page title="Brand Setup">
        <s-section>
          <s-card>
            <s-box padding="400">
              <s-text>Loading brand information...</s-text>
            </s-box>
          </s-card>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page title="Brand Setup" subtitle="Configure your brand identity for all ad campaigns">
      {showSuccess && !isSaving && (
        <s-banner tone="success" title="Brand saved successfully">
          <s-text>Your brand settings have been saved and will be used in all future ad campaigns.</s-text>
        </s-banner>
      )}

      {(brandError || errorMessage) && (
        <s-banner tone="critical" title="Error">
          <s-text>{brandError?.message ?? errorMessage}</s-text>
        </s-banner>
      )}

      {prefillSuccess && (
        <s-banner
          tone="info"
          title="Form prefilled from Shopify"
          onDismiss={() => setPrefillSuccess(false)}
        >
          <s-text>Form prefilled from your Shopify store branding. Review the values below and save when ready.</s-text>
        </s-banner>
      )}

      {prefillError && (
        <s-banner tone="critical" title="Prefill Error">
          <s-text>{prefillError}</s-text>
        </s-banner>
      )}

      <s-section>
        <s-card title="Brand Identity">
          <s-box padding="400">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <s-text>Automatically populate this form using your Shopify store brand settings.</s-text>
                <s-button loading={isFetchingBranding} onClick={handlePrefill}>
                  Prefill from Shopify
                </s-button>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: "4px 0" }} />
              <s-text-field
                label="Brand Name"
                value={name}
                onInput={(e: any) => setName(e.target.value)}
                required
                placeholder="Enter your brand name"
              />
              <s-text-field
                label="Brand Description"
                value={description}
                onInput={(e: any) => setDescription(e.target.value)}
                multiline={4}
                placeholder="Describe your brand identity, tone, and values"
              />
            </div>
          </s-box>
        </s-card>
      </s-section>

      <s-section>
        <s-card title="Brand Colors">
          <s-box padding="400">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <s-text>Add up to 5 hex color values for your brand palette.</s-text>
              {colors.map((color, index) => (
                <div
                  key={index}
                  style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}
                >
                  {color && /^#[0-9A-Fa-f]{6}$/.test(color) && (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: color,
                        border: "1px solid #ccc",
                        flexShrink: 0,
                        alignSelf: "center",
                      }}
                    />
                  )}
                  {!(color && /^#[0-9A-Fa-f]{6}$/.test(color)) && (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: "#f4f6f8",
                        border: "1px dashed #8c9196",
                        flexShrink: 0,
                        alignSelf: "center",
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <s-text-field
                      label={`Color ${index + 1}`}
                      value={color}
                      onInput={(e: any) => handleColorChange(index, e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                  <s-button
                    tone="critical"
                    variant="plain"
                    onClick={() => handleRemoveColor(index)}
                  >
                    Remove
                  </s-button>
                </div>
              ))}
              {colors.length < 5 && (
                <div style={{ marginTop: "4px" }}>
                  <s-button onClick={handleAddColor}>Add Color</s-button>
                </div>
              )}
            </div>
          </s-box>
        </s-card>
      </s-section>

      <s-section>
        <s-card title="Fonts">
          <s-box padding="400">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <s-text>Specify the font names used in your brand.</s-text>
              {fonts.map((font, index) => (
                <div
                  key={index}
                  style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}
                >
                  <div style={{ flex: 1 }}>
                    <s-text-field
                      label={`Font ${index + 1}`}
                      value={font}
                      onInput={(e: any) => handleFontChange(index, e.target.value)}
                      placeholder="e.g. Inter, Helvetica Neue"
                    />
                  </div>
                  <s-button
                    tone="critical"
                    variant="plain"
                    onClick={() => handleRemoveFont(index)}
                  >
                    Remove
                  </s-button>
                </div>
              ))}
              <div style={{ marginTop: "4px" }}>
                <s-button onClick={handleAddFont}>Add Font</s-button>
              </div>
            </div>
          </s-box>
        </s-card>
      </s-section>

      <s-section>
        <s-card title="Logo Settings">
          <s-box padding="400">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <s-text-field
                label="Logo Path"
                value={logoPath}
                onInput={(e: any) => setLogoPath(e.target.value)}
                placeholder="e.g. brands/my-brand/logo.png"
              />
              <s-select
                label="Logo Placement"
                value={logoPlacement}
                options={[
                  { label: "Top Left", value: "top-left" },
                  { label: "Top Right", value: "top-right" },
                  { label: "Center", value: "center" },
                ]}
                onChange={(e: any) => setLogoPlacement(e.target.value)}
              />
              <s-text-field
                label="Logo Max Height %"
                type="number"
                value={String(logoMaxHeightPercent)}
                onInput={(e: any) => setLogoMaxHeightPercent(Number(e.target.value))}
                min="1"
                max="100"
              />
            </div>
          </s-box>
        </s-card>
      </s-section>

      <s-section>
        <s-card title="Additional Settings">
          <s-box padding="400">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <s-text-field
                label="Reference Assets Path"
                value={referenceAssets}
                onInput={(e: any) => setReferenceAssets(e.target.value)}
                placeholder="Path to reference assets used in ad generation"
              />
              <s-text-field
                label="Prohibited Words"
                value={prohibitedWordsText}
                onInput={(e: any) => setProhibitedWordsText(e.target.value)}
                multiline={3}
                placeholder="word1, word2, word3"
              />
              <s-text>Prohibited words are separated by commas and will not appear in any generated content.</s-text>
            </div>
          </s-box>
        </s-card>
      </s-section>

      <s-section>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "24px" }}>
          <s-button
            variant="primary"
            loading={isSaving}
            onClick={handleSubmit}
          >
            {brand?.id ? "Update Brand" : "Create Brand"}
          </s-button>
        </div>
      </s-section>
    </s-page>
  );
}