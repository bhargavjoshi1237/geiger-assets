"use client";

// Title -> screen component, for every workspace surface that has a real screen.
//
// The sidebar is the source of the keys: each entry here must match a title in
// `sidebar_data.js` / `feature_registry.js` exactly, the same contract the events
// reference app uses in `components/internal/screens/registry.jsx`. A title with
// no entry falls through to `FeatureScreen`, the designed placeholder, so adding
// a screen is a one-line change here rather than another `switch` arm.
//
// Kept out of `AssetsPlayground.jsx` deliberately: at ~60 screens the import
// block alone would bury the shell component it lives in.

import { ImagesScreen } from "@/components/internal/screens/projects/media/images";
import { VideoTranscriptsScreen } from "@/components/internal/screens/projects/media/video_transcripts";
import { AudioScreen } from "@/components/internal/screens/projects/media/audio";
import { DocumentsOcrScreen } from "@/components/internal/screens/projects/media/documents_ocr";
import { DesignRawScreen } from "@/components/internal/screens/projects/media/design_raw";
import { ThreeDScreen } from "@/components/internal/screens/projects/media/three_d";
import { ImageEditingScreen } from "@/components/internal/screens/projects/media/image_editing";
import { VideoProcessingScreen } from "@/components/internal/screens/projects/media/video_processing";
import { RenditionsFormatsScreen } from "@/components/internal/screens/projects/media/renditions_formats";

import { SharedLinksScreen } from "@/components/internal/screens/projects/collaboration/shared_links";
import { ApprovalsScreen } from "@/components/internal/screens/projects/collaboration/approvals";
import { TeamScreen } from "@/components/internal/screens/projects/collaboration/team";

import { CdnDeliveryScreen } from "@/components/internal/screens/projects/delivery/cdn_delivery";
import { DynamicImagesScreen } from "@/components/internal/screens/projects/delivery/dynamic_images";
import { VideoDeliveryScreen } from "@/components/internal/screens/projects/delivery/video_delivery";
import { EmbedsHeadlessScreen } from "@/components/internal/screens/projects/delivery/embeds_headless";
import { ChannelPublishingScreen } from "@/components/internal/screens/projects/delivery/channel_publishing";
import { DeliveryAnalyticsScreen } from "@/components/internal/screens/projects/delivery/delivery_analytics";

import { GalleryBuilderScreen } from "@/components/internal/screens/projects/galleries/gallery_builder";
import { ShowcaseGalleriesScreen } from "@/components/internal/screens/projects/galleries/showcase_galleries";
import { GalleryDomainsScreen } from "@/components/internal/screens/projects/galleries/gallery_domains";
import { StorefrontScreen } from "@/components/internal/screens/projects/galleries/storefront";
import { DigitalDownloadsScreen } from "@/components/internal/screens/projects/galleries/digital_downloads";
import { ProductsPricingScreen } from "@/components/internal/screens/projects/galleries/products_pricing";
import { CartCheckoutScreen } from "@/components/internal/screens/projects/galleries/cart_checkout";
import { OrdersInvoicesScreen } from "@/components/internal/screens/projects/galleries/orders_invoices";
import { CustomersScreen } from "@/components/internal/screens/projects/galleries/customers";

import { AccessControlScreen } from "@/components/internal/screens/projects/memberships/access_control";
import { MemberRegistryScreen } from "@/components/internal/screens/projects/memberships/member_registry";
import { RecurringBillingScreen } from "@/components/internal/screens/projects/memberships/recurring_billing";
import { GalleryIntegrationsScreen } from "@/components/internal/screens/projects/memberships/gallery_integrations";

import { RightsInventoryScreen } from "@/components/internal/screens/projects/licensing/rights_inventory";
import { LicenseTemplatesScreen } from "@/components/internal/screens/projects/licensing/license_templates";
import { LicensePricingScreen } from "@/components/internal/screens/projects/licensing/license_pricing";
import { IssuedLicensesScreen } from "@/components/internal/screens/projects/licensing/issued_licenses";
import { ExpirationsRenewalsScreen } from "@/components/internal/screens/projects/licensing/expirations_renewals";
import { RevenueRoyaltiesScreen } from "@/components/internal/screens/projects/licensing/revenue_royalties";

import { PermissionsScreen } from "@/components/internal/screens/projects/governance/permissions";
import { IdentityProvisioningScreen } from "@/components/internal/screens/projects/governance/identity_provisioning";
import { RetentionPoliciesScreen } from "@/components/internal/screens/projects/governance/retention_policies";
import { LegalHoldsScreen } from "@/components/internal/screens/projects/governance/legal_holds";

import { IntegrationsScreen } from "@/components/internal/screens/projects/platform/integrations";
import { ApiScreen } from "@/components/internal/screens/projects/platform/api";
import { SdksScreen } from "@/components/internal/screens/projects/platform/sdks";
import { WebhooksScreen } from "@/components/internal/screens/projects/platform/webhooks";
import { DataImportExportScreen } from "@/components/internal/screens/projects/platform/data_import_export";

import { AssetAnalyticsScreen } from "@/components/internal/screens/projects/analytics/asset_analytics";
import { SearchAnalyticsScreen } from "@/components/internal/screens/projects/analytics/search_analytics";
import { PortalAnalyticsScreen } from "@/components/internal/screens/projects/analytics/portal_analytics";
import { LibraryHealthScreen } from "@/components/internal/screens/projects/analytics/library_health";
import { StorageUsageScreen } from "@/components/internal/screens/projects/analytics/storage_usage";
import { CommerceAnalyticsScreen } from "@/components/internal/screens/projects/analytics/commerce_analytics";
import { LicenseAnalyticsScreen } from "@/components/internal/screens/projects/analytics/license_analytics";
import { ReportsExportsScreen } from "@/components/internal/screens/projects/analytics/reports_exports";

import { GeneralScreen } from "@/components/internal/screens/projects/settings/general";
import { ConnectivityScreen } from "@/components/internal/screens/projects/settings/connectivity";
import { AddonsScreen } from "@/components/internal/screens/projects/settings/addons";
import { UsageStorageScreen } from "@/components/internal/screens/projects/settings/usage_storage";
import { PermissionsSecurityScreen } from "@/components/internal/screens/projects/settings/permissions_security";
import { CustomFieldsScreen } from "@/components/internal/screens/projects/settings/custom_fields";
import { AdvancedScreen } from "@/components/internal/screens/projects/settings/advanced";
import { EnterpriseScreen } from "@/components/internal/screens/projects/settings/enterprise";
import { StorageBackendsScreen } from "@/components/internal/screens/projects/storage/storage_backends_screen";

// Feature tabs (`feature_registry.js`). Screens already wired by name in
// AssetsPlayground's switch — the asset, workflow and creator domains — are not
// repeated here.
export const SCREEN_REGISTRY = {
  // Media
  Images: ImagesScreen,
  "Video & Transcripts": VideoTranscriptsScreen,
  Audio: AudioScreen,
  "Documents & OCR": DocumentsOcrScreen,
  "Design & Raw Files": DesignRawScreen,
  "3D & Immersive": ThreeDScreen,
  "Image Editing": ImageEditingScreen,
  "Video Processing": VideoProcessingScreen,
  "Renditions & Formats": RenditionsFormatsScreen,

  // Collaboration
  "Shared Links": SharedLinksScreen,
  Approvals: ApprovalsScreen,
  Team: TeamScreen,

  // Delivery
  "CDN Delivery": CdnDeliveryScreen,
  "Dynamic Images": DynamicImagesScreen,
  "Video Delivery": VideoDeliveryScreen,
  "Embeds & Headless": EmbedsHeadlessScreen,
  "Channel Publishing": ChannelPublishingScreen,
  "Delivery Analytics": DeliveryAnalyticsScreen,

  // Galleries
  "Gallery Builder": GalleryBuilderScreen,
  "Showcase Galleries": ShowcaseGalleriesScreen,
  "Gallery Domains": GalleryDomainsScreen,
  Storefront: StorefrontScreen,
  "Digital Downloads": DigitalDownloadsScreen,
  "Products & Pricing": ProductsPricingScreen,
  "Cart & Checkout": CartCheckoutScreen,
  "Orders & Invoices": OrdersInvoicesScreen,
  Customers: CustomersScreen,

  // Memberships
  "Access Control": AccessControlScreen,
  "Member Registry": MemberRegistryScreen,
  "Recurring Billing": RecurringBillingScreen,
  "Gallery Integrations": GalleryIntegrationsScreen,

  // Licensing
  "Rights Inventory": RightsInventoryScreen,
  "License Templates": LicenseTemplatesScreen,
  "License Pricing": LicensePricingScreen,
  "Issued Licenses": IssuedLicensesScreen,
  "Expirations & Renewals": ExpirationsRenewalsScreen,
  "Revenue & Royalties": RevenueRoyaltiesScreen,

  // Governance
  Permissions: PermissionsScreen,
  "Identity & Provisioning": IdentityProvisioningScreen,
  "Retention Policies": RetentionPoliciesScreen,
  "Legal Holds": LegalHoldsScreen,

  // Platform
  Integrations: IntegrationsScreen,
  API: ApiScreen,
  SDKs: SdksScreen,
  Webhooks: WebhooksScreen,
  "Data Import & Export": DataImportExportScreen,

  // Analytics. Note "Storage & Usage" here is the analytics report; the settings
  // tab is the differently-titled "Usage & Storage" below.
  "Asset Analytics": AssetAnalyticsScreen,
  "Search Analytics": SearchAnalyticsScreen,
  "Portal Analytics": PortalAnalyticsScreen,
  "Library Health": LibraryHealthScreen,
  "Storage & Usage": StorageUsageScreen,
  "Commerce Analytics": CommerceAnalyticsScreen,
  "License Analytics": LicenseAnalyticsScreen,
  "Reports & Exports": ReportsExportsScreen,
};

// Settings tabs (`settingsNav` in sidebar_data.js).
export const SETTINGS_REGISTRY = {
  General: GeneralScreen,
  Connectivity: ConnectivityScreen,
  "Add-ons": AddonsScreen,
  "Usage & Storage": UsageStorageScreen,
  "Storage Backends": StorageBackendsScreen,
  "Permissions & Security": PermissionsSecurityScreen,
  "Custom Fields": CustomFieldsScreen,
  Advanced: AdvancedScreen,
  Enterprise: EnterpriseScreen,
};
