-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('TAXABLE', 'NON_TAXABLE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "PaymentLifecycleStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('AUTHORIZATION', 'CAPTURE', 'REFUND', 'VOID', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'PDF');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QuotationLineType" AS ENUM ('PART', 'SERVICE', 'ADJUSTMENT', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TechnicianVisitOutcome" AS ENUM ('FIXED', 'RETURN_VISIT_REQUIRED', 'PARTS_REQUIRED', 'NOT_RESOLVED');

-- CreateEnum
CREATE TYPE "TechnicianStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PortType" AS ENUM ('HDH', 'CHAMELEON', 'CHAMELEON_ELITE', 'STANDARD');

-- CreateEnum
CREATE TYPE "FloorType" AS ENUM ('BASEMENT', 'FIRST_FLOOR', 'SECOND_FLOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "AdditionalFeatureType" AS ENUM ('VACPAN', 'SPOT_VACUUM', 'WALLY_FLEX');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "cellphone" TEXT,
    "companyName" TEXT,
    "notes" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TechnicianStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "availabilityNote" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianSpecialization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianSpecialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" "AddressLabel" NOT NULL DEFAULT 'HOME',
    "contactName" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "addressId" TEXT,
    "customerMachineId" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "serviceLocationText" TEXT,
    "preferredDate" TIMESTAMP(3),
    "preferredTime" TEXT,
    "problemDescription" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "previousMachineInfo" TEXT,
    "adminInternalNote" TEXT,
    "latestQuotedAmount" DECIMAL(10,2),
    "quotationAcceptedAt" TIMESTAMP(3),
    "quotationRejectedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequestMedia" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMachine" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "installedAddressId" TEXT,
    "label" TEXT,
    "equipmentType" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "condition" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMachineFloorPort" (
    "id" TEXT NOT NULL,
    "customerMachineId" TEXT NOT NULL,
    "floorType" "FloorType" NOT NULL,
    "portType" "PortType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMachineFloorPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMachineAdditionalFeature" (
    "id" TEXT NOT NULL,
    "customerMachineId" TEXT NOT NULL,
    "featureType" "AdditionalFeatureType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMachineAdditionalFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMachineMainUnit" (
    "id" TEXT NOT NULL,
    "customerMachineId" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMachineMainUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipmentSnapshot" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "customerMachineId" TEXT,
    "equipmentType" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "condition" TEXT,
    "problemSymptoms" TEXT,
    "previousRepairHistory" TEXT,
    "previousCustomerMachineInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEquipmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipmentFloorPort" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "floorType" "FloorType" NOT NULL,
    "portType" "PortType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEquipmentFloorPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipmentAdditionalFeature" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "featureType" "AdditionalFeatureType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEquipmentAdditionalFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipmentMainUnit" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEquipmentMainUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuotation" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "subtotalAmount" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "termsAndNotes" TEXT,
    "validForHours" INTEGER NOT NULL DEFAULT 24,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "supersedesQuotationId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuotationLineItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineType" "QuotationLineType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuotationLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSchedule" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "quotationId" TEXT,
    "assignedTechnicianId" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3),
    "estimatedDurationMinutes" INTEGER,
    "serviceAddressSnapshot" JSONB,
    "customerNote" TEXT,
    "internalNote" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePayment" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "quotationId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "eventType" "PaymentEventType" NOT NULL,
    "status" "PaymentLifecycleStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "chargeId" TEXT,
    "authorizationAmount" DECIMAL(10,2),
    "capturedAmount" DECIMAL(10,2),
    "refundedAmount" DECIMAL(10,2) DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePayload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "technicianId" TEXT,
    "outcome" "TechnicianVisitOutcome",
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "workSummary" TEXT,
    "partsNeeded" TEXT,
    "followUpRecommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisitMedia" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVisitMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePartUsed" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePartUsed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCompletion" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "completedByAdminId" TEXT,
    "repairSummary" TEXT,
    "completionNotes" TEXT,
    "finalAmount" DECIMAL(10,2),
    "warrantyNote" TEXT,
    "followUpRecommendation" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "model" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxable" "TaxMode" NOT NULL DEFAULT 'TAXABLE',
    "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "shippingWeight" DECIMAL(10,2),
    "dimensionLength" DECIMAL(10,2),
    "dimensionWidth" DECIMAL(10,2),
    "dimensionHeight" DECIMAL(10,2),
    "warrantyInfo" TEXT,
    "manualPdfUrl" TEXT,
    "tags" TEXT[],
    "specifications" TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "iconKey" TEXT,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "shippingAddressId" TEXT,
    "shippingAddressSnapshot" JSONB NOT NULL,
    "billingAddressSnapshot" JSONB,
    "discountCodeId" TEXT,
    "subtotalAmount" DECIMAL(10,2) NOT NULL,
    "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderItem" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "model" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreShipment" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT 'UPS',
    "trackingNumber" TEXT,
    "shipmentDate" TIMESTAMP(3),
    "deliveryEstimate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePayment" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "eventType" "PaymentEventType" NOT NULL,
    "status" "PaymentLifecycleStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "chargeId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePayload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInvoice" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreReturnRequest" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "storeOrderItemId" TEXT,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "customerNote" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TechnicianProfileToTechnicianSpecialization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TechnicianProfileToTechnicianSpecialization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_email_purpose_idx" ON "OtpCode"("email", "purpose");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_isConsumed_idx" ON "OtpCode"("isConsumed");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianProfile_userId_key" ON "TechnicianProfile"("userId");

-- CreateIndex
CREATE INDEX "TechnicianProfile_status_idx" ON "TechnicianProfile"("status");

-- CreateIndex
CREATE INDEX "TechnicianProfile_isVerified_idx" ON "TechnicianProfile"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianSpecialization_name_key" ON "TechnicianSpecialization"("name");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Address_isDefault_idx" ON "Address"("isDefault");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE INDEX "Address_state_idx" ON "Address"("state");

-- CreateIndex
CREATE INDEX "Address_zipCode_idx" ON "Address"("zipCode");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "ServiceCategory_isActive_idx" ON "ServiceCategory"("isActive");

-- CreateIndex
CREATE INDEX "ServiceCategory_sortOrder_idx" ON "ServiceCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceType_serviceCategoryId_idx" ON "ServiceType"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "ServiceType_isActive_idx" ON "ServiceType"("isActive");

-- CreateIndex
CREATE INDEX "ServiceType_sortOrder_idx" ON "ServiceType"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_serviceCategoryId_slug_key" ON "ServiceType"("serviceCategoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_serviceCategoryId_name_key" ON "ServiceType"("serviceCategoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_requestNumber_key" ON "ServiceRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_idx" ON "ServiceRequest"("customerId");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceCategoryId_idx" ON "ServiceRequest"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceTypeId_idx" ON "ServiceRequest"("serviceTypeId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_preferredDate_idx" ON "ServiceRequest"("preferredDate");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerMachineId_idx" ON "ServiceRequest"("customerMachineId");

-- CreateIndex
CREATE INDEX "ServiceRequestMedia_serviceRequestId_idx" ON "ServiceRequestMedia"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceRequestMedia_type_idx" ON "ServiceRequestMedia"("type");

-- CreateIndex
CREATE INDEX "CustomerMachine_customerId_idx" ON "CustomerMachine"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMachine_installedAddressId_idx" ON "CustomerMachine"("installedAddressId");

-- CreateIndex
CREATE INDEX "CustomerMachine_serialNumber_idx" ON "CustomerMachine"("serialNumber");

-- CreateIndex
CREATE INDEX "CustomerMachine_isActive_idx" ON "CustomerMachine"("isActive");

-- CreateIndex
CREATE INDEX "CustomerMachineFloorPort_customerMachineId_idx" ON "CustomerMachineFloorPort"("customerMachineId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMachineFloorPort_customerMachineId_floorType_portTy_key" ON "CustomerMachineFloorPort"("customerMachineId", "floorType", "portType");

-- CreateIndex
CREATE INDEX "CustomerMachineAdditionalFeature_customerMachineId_idx" ON "CustomerMachineAdditionalFeature"("customerMachineId");

-- CreateIndex
CREATE INDEX "CustomerMachineAdditionalFeature_featureType_idx" ON "CustomerMachineAdditionalFeature"("featureType");

-- CreateIndex
CREATE INDEX "CustomerMachineMainUnit_customerMachineId_idx" ON "CustomerMachineMainUnit"("customerMachineId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMachineMainUnit_customerMachineId_unitNumber_key" ON "CustomerMachineMainUnit"("customerMachineId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEquipmentSnapshot_serviceRequestId_key" ON "ServiceEquipmentSnapshot"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceEquipmentSnapshot_customerMachineId_idx" ON "ServiceEquipmentSnapshot"("customerMachineId");

-- CreateIndex
CREATE INDEX "ServiceEquipmentFloorPort_snapshotId_idx" ON "ServiceEquipmentFloorPort"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEquipmentFloorPort_snapshotId_floorType_portType_key" ON "ServiceEquipmentFloorPort"("snapshotId", "floorType", "portType");

-- CreateIndex
CREATE INDEX "ServiceEquipmentAdditionalFeature_snapshotId_idx" ON "ServiceEquipmentAdditionalFeature"("snapshotId");

-- CreateIndex
CREATE INDEX "ServiceEquipmentAdditionalFeature_featureType_idx" ON "ServiceEquipmentAdditionalFeature"("featureType");

-- CreateIndex
CREATE INDEX "ServiceEquipmentMainUnit_snapshotId_idx" ON "ServiceEquipmentMainUnit"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEquipmentMainUnit_snapshotId_unitNumber_key" ON "ServiceEquipmentMainUnit"("snapshotId", "unitNumber");

-- CreateIndex
CREATE INDEX "ServiceQuotation_serviceRequestId_idx" ON "ServiceQuotation"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceQuotation_status_idx" ON "ServiceQuotation"("status");

-- CreateIndex
CREATE INDEX "ServiceQuotation_validForHours_idx" ON "ServiceQuotation"("validForHours");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuotation_serviceRequestId_version_key" ON "ServiceQuotation"("serviceRequestId", "version");

-- CreateIndex
CREATE INDEX "ServiceQuotationLineItem_quotationId_idx" ON "ServiceQuotationLineItem"("quotationId");

-- CreateIndex
CREATE INDEX "ServiceQuotationLineItem_sortOrder_idx" ON "ServiceQuotationLineItem"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceSchedule_serviceRequestId_idx" ON "ServiceSchedule"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceSchedule_quotationId_idx" ON "ServiceSchedule"("quotationId");

-- CreateIndex
CREATE INDEX "ServiceSchedule_assignedTechnicianId_idx" ON "ServiceSchedule"("assignedTechnicianId");

-- CreateIndex
CREATE INDEX "ServiceSchedule_status_idx" ON "ServiceSchedule"("status");

-- CreateIndex
CREATE INDEX "ServiceSchedule_scheduledStart_idx" ON "ServiceSchedule"("scheduledStart");

-- CreateIndex
CREATE INDEX "ServicePayment_serviceRequestId_idx" ON "ServicePayment"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServicePayment_quotationId_idx" ON "ServicePayment"("quotationId");

-- CreateIndex
CREATE INDEX "ServicePayment_status_idx" ON "ServicePayment"("status");

-- CreateIndex
CREATE INDEX "ServicePayment_paymentIntentId_idx" ON "ServicePayment"("paymentIntentId");

-- CreateIndex
CREATE INDEX "ServiceVisit_serviceRequestId_idx" ON "ServiceVisit"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceVisit_scheduleId_idx" ON "ServiceVisit"("scheduleId");

-- CreateIndex
CREATE INDEX "ServiceVisit_technicianId_idx" ON "ServiceVisit"("technicianId");

-- CreateIndex
CREATE INDEX "ServiceVisitMedia_visitId_idx" ON "ServiceVisitMedia"("visitId");

-- CreateIndex
CREATE INDEX "ServiceVisitMedia_type_idx" ON "ServiceVisitMedia"("type");

-- CreateIndex
CREATE INDEX "ServicePartUsed_visitId_idx" ON "ServicePartUsed"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCompletion_serviceRequestId_key" ON "ServiceCompletion"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceCompletion_completedByAdminId_idx" ON "ServiceCompletion"("completedByAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");

-- CreateIndex
CREATE INDEX "ProductCategory_sortOrder_idx" ON "ProductCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_parentId_key" ON "ProductCategory"("name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubCategory_slug_key" ON "ProductSubCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductSubCategory_categoryId_idx" ON "ProductSubCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ProductSubCategory_isActive_idx" ON "ProductSubCategory"("isActive");

-- CreateIndex
CREATE INDEX "ProductSubCategory_sortOrder_idx" ON "ProductSubCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubCategory_categoryId_name_key" ON "ProductSubCategory"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_subCategoryId_idx" ON "Product"("subCategoryId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "ProductFeature_productId_idx" ON "ProductFeature"("productId");

-- CreateIndex
CREATE INDEX "ProductFeature_sortOrder_idx" ON "ProductFeature"("sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_isPrimary_idx" ON "ProductImage"("isPrimary");

-- CreateIndex
CREATE INDEX "ProductImage_sortOrder_idx" ON "ProductImage"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

-- CreateIndex
CREATE INDEX "DiscountCode_startsAt_idx" ON "DiscountCode"("startsAt");

-- CreateIndex
CREATE INDEX "DiscountCode_endsAt_idx" ON "DiscountCode"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_orderNumber_key" ON "StoreOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "StoreOrder_customerId_idx" ON "StoreOrder"("customerId");

-- CreateIndex
CREATE INDEX "StoreOrder_status_idx" ON "StoreOrder"("status");

-- CreateIndex
CREATE INDEX "StoreOrder_placedAt_idx" ON "StoreOrder"("placedAt");

-- CreateIndex
CREATE INDEX "StoreOrder_shippingAddressId_idx" ON "StoreOrder"("shippingAddressId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_storeOrderId_idx" ON "StoreOrderItem"("storeOrderId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_productId_idx" ON "StoreOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreShipment_storeOrderId_key" ON "StoreShipment"("storeOrderId");

-- CreateIndex
CREATE INDEX "StoreShipment_status_idx" ON "StoreShipment"("status");

-- CreateIndex
CREATE INDEX "StoreShipment_trackingNumber_idx" ON "StoreShipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "StorePayment_storeOrderId_idx" ON "StorePayment"("storeOrderId");

-- CreateIndex
CREATE INDEX "StorePayment_status_idx" ON "StorePayment"("status");

-- CreateIndex
CREATE INDEX "StorePayment_paymentIntentId_idx" ON "StorePayment"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInvoice_storeOrderId_key" ON "StoreInvoice"("storeOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreInvoice_invoiceNumber_key" ON "StoreInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "StoreReturnRequest_storeOrderId_idx" ON "StoreReturnRequest"("storeOrderId");

-- CreateIndex
CREATE INDEX "StoreReturnRequest_storeOrderItemId_idx" ON "StoreReturnRequest"("storeOrderItemId");

-- CreateIndex
CREATE INDEX "StoreReturnRequest_status_idx" ON "StoreReturnRequest"("status");

-- CreateIndex
CREATE INDEX "_TechnicianProfileToTechnicianSpecialization_B_index" ON "_TechnicianProfileToTechnicianSpecialization"("B");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerMachineId_fkey" FOREIGN KEY ("customerMachineId") REFERENCES "CustomerMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestMedia" ADD CONSTRAINT "ServiceRequestMedia_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMachine" ADD CONSTRAINT "CustomerMachine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMachine" ADD CONSTRAINT "CustomerMachine_installedAddressId_fkey" FOREIGN KEY ("installedAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMachineFloorPort" ADD CONSTRAINT "CustomerMachineFloorPort_customerMachineId_fkey" FOREIGN KEY ("customerMachineId") REFERENCES "CustomerMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMachineAdditionalFeature" ADD CONSTRAINT "CustomerMachineAdditionalFeature_customerMachineId_fkey" FOREIGN KEY ("customerMachineId") REFERENCES "CustomerMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMachineMainUnit" ADD CONSTRAINT "CustomerMachineMainUnit_customerMachineId_fkey" FOREIGN KEY ("customerMachineId") REFERENCES "CustomerMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipmentSnapshot" ADD CONSTRAINT "ServiceEquipmentSnapshot_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipmentSnapshot" ADD CONSTRAINT "ServiceEquipmentSnapshot_customerMachineId_fkey" FOREIGN KEY ("customerMachineId") REFERENCES "CustomerMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipmentFloorPort" ADD CONSTRAINT "ServiceEquipmentFloorPort_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ServiceEquipmentSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipmentAdditionalFeature" ADD CONSTRAINT "ServiceEquipmentAdditionalFeature_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ServiceEquipmentSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipmentMainUnit" ADD CONSTRAINT "ServiceEquipmentMainUnit_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ServiceEquipmentSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuotation" ADD CONSTRAINT "ServiceQuotation_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuotation" ADD CONSTRAINT "ServiceQuotation_supersedesQuotationId_fkey" FOREIGN KEY ("supersedesQuotationId") REFERENCES "ServiceQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuotation" ADD CONSTRAINT "ServiceQuotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuotation" ADD CONSTRAINT "ServiceQuotation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuotationLineItem" ADD CONSTRAINT "ServiceQuotationLineItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "ServiceQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "ServiceQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePayment" ADD CONSTRAINT "ServicePayment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePayment" ADD CONSTRAINT "ServicePayment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "ServiceQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ServiceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisitMedia" ADD CONSTRAINT "ServiceVisitMedia_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePartUsed" ADD CONSTRAINT "ServicePartUsed_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCompletion" ADD CONSTRAINT "ServiceCompletion_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCompletion" ADD CONSTRAINT "ServiceCompletion_completedByAdminId_fkey" FOREIGN KEY ("completedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubCategory" ADD CONSTRAINT "ProductSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "ProductSubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeature" ADD CONSTRAINT "ProductFeature_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShipment" ADD CONSTRAINT "StoreShipment_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInvoice" ADD CONSTRAINT "StoreInvoice_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReturnRequest" ADD CONSTRAINT "StoreReturnRequest_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReturnRequest" ADD CONSTRAINT "StoreReturnRequest_storeOrderItemId_fkey" FOREIGN KEY ("storeOrderItemId") REFERENCES "StoreOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TechnicianProfileToTechnicianSpecialization" ADD CONSTRAINT "_TechnicianProfileToTechnicianSpecialization_A_fkey" FOREIGN KEY ("A") REFERENCES "TechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TechnicianProfileToTechnicianSpecialization" ADD CONSTRAINT "_TechnicianProfileToTechnicianSpecialization_B_fkey" FOREIGN KEY ("B") REFERENCES "TechnicianSpecialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

