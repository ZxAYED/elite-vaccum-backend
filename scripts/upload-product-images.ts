import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhl04adhz',
  api_key: process.env.CLOUDINARY_API_KEY || '359185831253368',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'pqJeEtVh3qMrmrNHcNprm3sHcNc',
  secure: true,
});

// 12 Products Map
const productsConfig = [
  { index: 1, id: 'a1000000-0000-4000-8000-000000000001', sku: 'EV-PU-950', name: 'ApexFlow Pro 950 Central Vacuum Power Unit' },
  { index: 2, id: 'a1000000-0000-4000-8000-000000000002', sku: 'EV-PU-750', name: 'Aerolux WhisperQuiet 750 Compact Power Unit' },
  { index: 3, id: 'a1000000-0000-4000-8000-000000000003', sku: 'EV-PU-1200', name: 'TitanForce Commercial 1200 Vacuum Station' },
  { index: 4, id: 'a1000000-0000-4000-8000-000000000004', sku: 'EV-PU-VISI', name: 'VisiClean Transparent Hybrid Canister Unit' },
  { index: 5, id: 'a1000000-0000-4000-8000-000000000005', sku: 'EV-PU-650', name: 'ProTerra EcoSilent 650 Power Unit' },
  { index: 6, id: 'a1000000-0000-4000-8000-000000000006', sku: 'EV-PU-1000', name: 'UltraMax Dual-Cyclonic 1000 Power Unit' },
  { index: 7, id: 'a1000000-0000-4000-8000-000000000007', sku: 'EV-HK-RET50', name: 'Chameleon Elite Retractable Hose Complete Kit' },
  { index: 8, id: 'a1000000-0000-4000-8000-000000000008', sku: 'EV-IN-CHM-FLUSH', name: 'Chameleon Designer Flush Wall Valve Inlet' },
  { index: 9, id: 'a1000000-0000-4000-8000-000000000009', sku: 'EV-IN-VACPAN', name: 'VacPan Automatic Kick-Plate Dustpan Inlet' },
  { index: 10, id: 'a1000000-0000-4000-8000-000000000010', sku: 'EV-AC-TOOL12', name: 'ProArtisan Hardwood & Carpet Deluxe Attachment Kit' },
  { index: 11, id: 'a1000000-0000-4000-8000-000000000011', sku: 'EV-FL-HEPA99', name: 'HEPA Shield Active Carbon Replacement Filter Assembly' },
  { index: 12, id: 'a1000000-0000-4000-8000-000000000012', sku: 'EV-IN-PIPE20', name: 'SweepLink 2-Inch Vacuum Pipe & Sweep Elbow Pro Bundle' },
];

function findImageFile(pIndex: number, imgIndex: number): string | null {
  const imagesDir = path.resolve(process.cwd(), 'images');
  const extensions = ['.jpg', '.jpeg', '.png', '.webp'];

  for (const ext of extensions) {
    const filename = `p${pIndex}i${imgIndex}${ext}`;
    const fullPath = path.join(imagesDir, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

async function run() {
  console.log('🚀 Starting Chronological Product Image Upload to Cloudinary & Database...\n');

  let totalUploaded = 0;
  let missingCount = 0;

  for (const config of productsConfig) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📦 Product ${config.index}: ${config.name} (${config.sku})`);
    console.log(`   ID: ${config.id}`);

    // Verify product exists in database
    const product = await prisma.product.findUnique({
      where: { id: config.id },
      include: { images: true },
    });

    if (!product) {
      console.warn(`   ⚠️ Product not found in database with ID ${config.id}. Skipping.`);
      continue;
    }

    // Check files for Image 1 and Image 2
    const file1 = findImageFile(config.index, 1);
    const file2 = findImageFile(config.index, 2);

    if (!file1 && !file2) {
      console.warn(`   ⚠️ No image files found for Product ${config.index} (p${config.index}i1, p${config.index}i2). Skipping.`);
      missingCount += 2;
      continue;
    }

    const uploadsToPerform: Array<{ filePath: string; isPrimary: boolean; sortOrder: number; label: string }> = [];

    if (file1) {
      uploadsToPerform.push({
        filePath: file1,
        isPrimary: true,
        sortOrder: 0,
        label: `${product.name} - Front View`,
      });
    } else {
      console.warn(`   ⚠️ Missing p${config.index}i1 for Product ${config.index}`);
      missingCount++;
    }

    if (file2) {
      uploadsToPerform.push({
        filePath: file2,
        isPrimary: !file1, // Primary if file1 was absent
        sortOrder: 1,
        label: `${product.name} - Detail Angle`,
      });
    } else {
      console.warn(`   ⚠️ Missing p${config.index}i2 for Product ${config.index}`);
      missingCount++;
    }

    // Clean up existing images for this product to prevent duplicates
    if (product.images.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      console.log(`   🔄 Cleared ${product.images.length} previous image records for clean sync`);
    }

    // Upload files to Cloudinary and insert into database
    for (const uploadItem of uploadsToPerform) {
      const fileName = path.basename(uploadItem.filePath);
      console.log(`   📤 Uploading ${fileName} to Cloudinary...`);

      try {
        const uploadResult = await cloudinary.uploader.upload(uploadItem.filePath, {
          folder: 'elite-vacuum/products',
          public_id: `prod-${config.sku.toLowerCase()}-${uploadItem.sortOrder + 1}`,
          overwrite: true,
          resource_type: 'image',
        });

        const imageRecord = await prisma.productImage.create({
          data: {
            productId: product.id,
            key: uploadResult.public_id,
            url: uploadResult.secure_url,
            alt: uploadItem.label,
            isPrimary: uploadItem.isPrimary,
            sortOrder: uploadItem.sortOrder,
          },
        });

        totalUploaded++;
        console.log(`   ✅ Attached Image [${imageRecord.isPrimary ? 'PRIMARY' : 'SECONDARY'}]: ${uploadResult.secure_url}`);
      } catch (err: any) {
        console.error(`   ❌ Failed to upload ${fileName}:`, err?.message || err);
      }
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎉 Image Upload Completed!`);
  console.log(`   ✅ Total Successfully Uploaded & Linked: ${totalUploaded}`);
  if (missingCount > 0) {
    console.log(`   ⚠️ Total Missing Local Image Files: ${missingCount} (e.g. p2i1, p2i2)`);
  }
  console.log(`================================================================================\n`);
}

run()
  .catch((e) => {
    console.error('Fatal execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
