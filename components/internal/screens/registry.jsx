import { HomeScreen } from "./projects/home/home_screen";
import { LibraryScreen } from "./projects/library/library_screen";
import { AllMediaScreen } from "./projects/library/all_media_screen";
import { UploadCenterScreen } from "./projects/uploads/upload_center_screen";
import { ExternalUploadsScreen } from "./projects/external_uploads/external_uploads_screen";
import { CollectionsScreen } from "./projects/collections/collections_screen";
import { FoldersScreen } from "./projects/folders/folders_screen";
import { DuplicateReviewScreen } from "./projects/duplicates/duplicate_review_screen";
import { ArchiveTrashScreen } from "./projects/archive/archive_trash_screen";
import { AssetRequestsScreen } from "./projects/requests/asset_requests_screen";
import { TiersScreen } from "./projects/creator/tiers_screen";
import { MembersScreen } from "./projects/creator/members_screen";
import { SubscriptionsScreen } from "./projects/creator/subscriptions_screen";
import { PostsScreen } from "./projects/creator/posts_screen";
import { CreatorPageScreen } from "./projects/creator/creator_page_screen";
import { InboxScreen } from "./projects/creator/inbox_screen";
import { BundlesScreen } from "./projects/creator/bundles_screen";
import { MessagesScreen } from "./projects/creator/messages_screen";
import { TipsScreen } from "./projects/creator/tips_screen";
import { PayoutsScreen } from "./projects/creator/payouts_screen";
import { PromosScreen } from "./projects/creator/promos_screen";
import { AccessControlScreen } from "./projects/creator/access_control_screen";
import { RecurringBillingScreen } from "./projects/creator/recurring_billing_screen";
import { ImagesScreen } from "./projects/media/images/images_screen";
import { VideoTranscriptsScreen } from "./projects/media/video/video_transcripts_screen";
import { AudioScreen } from "./projects/media/audio/audio_screen";
import { DocumentsOcrScreen } from "./projects/media/documents/documents_ocr_screen";
import { DesignRawScreen } from "./projects/media/design/design_raw_screen";
import { ImmersiveScreen } from "./projects/media/immersive/immersive_screen";
import { ImageEditingScreen } from "./projects/media/editing/image_editing_screen";
import { VideoProcessingScreen } from "./projects/media/processing/video_processing_screen";
import { RenditionsScreen } from "./projects/media/renditions/renditions_screen";
import { AllWorkflowsScreen } from "./projects/workflows/all_workflows";
import { WorkflowTemplatesScreen } from "./projects/workflows/workflow_templates";
import { RunHistoryScreen } from "./projects/workflows/run_history";
import { RightsInventoryScreen } from "./projects/licensing/rights_inventory_screen";
import { LicenseTemplatesScreen } from "./projects/licensing/license_templates_screen";
import { LicensePricingScreen } from "./projects/licensing/license_pricing_screen";
import { IssuedLicensesScreen } from "./projects/licensing/issued_licenses_screen";
import { RenewalsScreen } from "./projects/licensing/renewals_screen";
import { RevenueRoyaltiesScreen } from "./projects/licensing/revenue_royalties_screen";
import { GalleryBuilderScreen } from "./projects/galleries/gallery_builder_screen";
import { ShowcaseGalleriesScreen } from "./projects/galleries/showcase_galleries_screen";
import { GalleryDomainsScreen } from "./projects/galleries/gallery_domains_screen";
import { StorefrontScreen } from "./projects/store/storefront_screen";
import { DigitalDownloadsScreen } from "./projects/store/digital_downloads_screen";
import { ProductsPricingScreen } from "./projects/store/products_pricing_screen";
import { CartCheckoutScreen } from "./projects/store/cart_checkout_screen";
import { OrdersInvoicesScreen } from "./projects/store/orders_invoices_screen";
import { CustomersScreen } from "./projects/store/customers_screen";
import { CdnDeliveryScreen } from "./projects/delivery/cdn_delivery_screen";
import { DynamicImagesScreen } from "./projects/delivery/dynamic_images_screen";
import { VideoDeliveryScreen } from "./projects/delivery/video_delivery_screen";
import { EmbedsHeadlessScreen } from "./projects/delivery/embeds_headless_screen";
import { ChannelPublishingScreen } from "./projects/delivery/channel_publishing_screen";
import { DeliveryAnalyticsScreen } from "./projects/delivery/delivery_analytics_screen";
import {
  AssetAnalyticsScreen,
  SearchAnalyticsScreen,
  PortalAnalyticsScreen,
  LibraryHealthScreen,
  StorageUsageAnalyticsScreen,
  CommerceAnalyticsScreen,
  LicenseAnalyticsScreen,
  ReportsExportsScreen,
} from "./projects/analytics/analytics_screen";
import { SharedLinksScreen } from "./projects/collaboration/shared_links_screen";
import { ApprovalsScreen } from "./projects/collaboration/approvals_screen";
import { ApprovalPipelinesScreen } from "./projects/collaboration/approval_pipelines_screen";
import { TeamScreen } from "./projects/collaboration/team_screen";
import { CommentsActivityScreen } from "./projects/collaboration/comments_activity_screen";
import { WebhooksScreen } from "./projects/platform/webhooks_screen";
import { DataExportScreen } from "./projects/platform/data_export_screen";
import { IntegrationsScreen } from "./projects/platform/integrations_screen";
import { ApiKeysScreen } from "./projects/platform/api_keys_screen";
import { DeliverySettingsScreen } from "./projects/platform/delivery_settings_screen";
import { ApiReferenceScreen } from "./projects/platform/api_reference_screen";
import { GeneralSettingsScreen } from "./projects/settings/general_settings";
import { AdvancedSettingsScreen } from "./projects/settings/advanced_settings";
import { UsageStorageScreen } from "./projects/settings/usage_storage_screen";
import { PermissionsSecurityScreen } from "./projects/settings/permissions_security_screen";
import { AddonsSettingsScreen } from "./projects/settings/addons_settings";
import { PermissionsScreen } from "./projects/governance/permissions_screen";
import { IdentityProvisioningScreen } from "./projects/governance/identity_provisioning_screen";
import { RetentionPoliciesScreen } from "./projects/governance/retention_policies_screen";
import { LegalHoldsScreen } from "./projects/governance/legal_holds_screen";

export const SCREEN_REGISTRY = {
  Overview: HomeScreen,
  "All Media": AllMediaScreen,
  "Asset Library": LibraryScreen,
  "Upload Center": UploadCenterScreen,
  "External Uploads": ExternalUploadsScreen,
  Collections: CollectionsScreen,
  Folders: FoldersScreen,
  "Duplicate Review": DuplicateReviewScreen,
  "Archive & Trash": ArchiveTrashScreen,
  "Asset Requests": AssetRequestsScreen,
  "Membership Tiers": TiersScreen,
  Members: MembersScreen,
  Subscriptions: SubscriptionsScreen,
  Posts: PostsScreen,
  "Creator Page": CreatorPageScreen,
  Inbox: InboxScreen,
  Bundles: BundlesScreen,
  "Paid Messages": MessagesScreen,
  Tips: TipsScreen,
  Payouts: PayoutsScreen,
  "Promo Codes & Perks": PromosScreen,
  "Access Control": AccessControlScreen,
  "Recurring Billing": RecurringBillingScreen,
  Images: ImagesScreen,
  "Video & Transcripts": VideoTranscriptsScreen,
  Audio: AudioScreen,
  "Documents & OCR": DocumentsOcrScreen,
  "Design & Raw Files": DesignRawScreen,
  "3D & Immersive": ImmersiveScreen,
  "Image Editing": ImageEditingScreen,
  "Video Processing": VideoProcessingScreen,
  "Renditions & Formats": RenditionsScreen,
  "Rights Inventory": RightsInventoryScreen,
  "License Templates": LicenseTemplatesScreen,
  "License Pricing": LicensePricingScreen,
  "Issued Licenses": IssuedLicensesScreen,
  "Expirations & Renewals": RenewalsScreen,
  "Revenue & Royalties": RevenueRoyaltiesScreen,
  "Gallery Builder": GalleryBuilderScreen,
  "Showcase Galleries": ShowcaseGalleriesScreen,
  "Gallery Domains": GalleryDomainsScreen,
  Storefront: StorefrontScreen,
  "Digital Downloads": DigitalDownloadsScreen,
  "Products & Pricing": ProductsPricingScreen,
  "Cart & Checkout": CartCheckoutScreen,
  "Orders & Invoices": OrdersInvoicesScreen,
  Customers: CustomersScreen,
  "CDN Delivery": CdnDeliveryScreen,
  "Dynamic Images": DynamicImagesScreen,
  "Video Delivery": VideoDeliveryScreen,
  "Embeds & Headless": EmbedsHeadlessScreen,
  "Channel Publishing": ChannelPublishingScreen,
  "Delivery Analytics": DeliveryAnalyticsScreen,
  "Asset Analytics": AssetAnalyticsScreen,
  "Search Analytics": SearchAnalyticsScreen,
  "Portal Analytics": PortalAnalyticsScreen,
  "Library Health": LibraryHealthScreen,
  "Storage & Usage": StorageUsageAnalyticsScreen,
  "Commerce Analytics": CommerceAnalyticsScreen,
  "License Analytics": LicenseAnalyticsScreen,
  "Reports & Exports": ReportsExportsScreen,
  "Shared Links": SharedLinksScreen,
  Approvals: ApprovalsScreen,
  "Approval Pipelines": ApprovalPipelinesScreen,
  Team: TeamScreen,
  "Comments & Activity": CommentsActivityScreen,
  Workflows: AllWorkflowsScreen,
  "All Workflows": AllWorkflowsScreen,
  "Workflow Templates": WorkflowTemplatesScreen,
  "Run History": RunHistoryScreen,
  Integrations: IntegrationsScreen,
  API: ApiKeysScreen,
  "API Keys": ApiKeysScreen,
  "Delivery Settings": DeliverySettingsScreen,
  "API Reference": ApiReferenceScreen,
  Webhooks: WebhooksScreen,
  "Data Export": DataExportScreen,
  Permissions: PermissionsScreen,
  "Identity & Provisioning": IdentityProvisioningScreen,
  "Retention Policies": RetentionPoliciesScreen,
  "Legal Holds": LegalHoldsScreen,
  General: GeneralSettingsScreen,
  Advanced: AdvancedSettingsScreen,
  "Usage & Storage": UsageStorageScreen,
  "Permissions & Security": PermissionsSecurityScreen,
  "Add-ons": AddonsSettingsScreen,
};

export function getScreen(title) {
  return SCREEN_REGISTRY[title] || null;
}
