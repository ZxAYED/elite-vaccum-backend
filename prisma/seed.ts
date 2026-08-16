import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const tempSqlPath = path.join(__dirname, 'seed.generated.sql');

function sqlString(value: string | null) {
  if (value === null) {
    return 'NULL';
  }

  return `'${value.replace(/'/g, "''")}'`;
}

function buildSeedSql(params: {
  adminPasswordHash: string;
  techPasswordHash: string;
  adminEmail: string;
  techEmail: string;
}) {
  const {
    adminPasswordHash,
    techPasswordHash,
    adminEmail,
    techEmail,
  } = params;

  return `
BEGIN;

WITH admin_user AS (
  INSERT INTO "User" (
    "id",
    "email",
    "passwordHash",
    "role",
    "status",
    "fullName",
    "phone",
    "cellphone",
    "companyName",
    "notes",
    "isEmailVerified",
    "isDeleted",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'seed-admin-user',
    ${sqlString(adminEmail)},
    ${sqlString(adminPasswordHash)},
    'ADMIN',
    'ACTIVE',
    'Elite Admin',
    '+1-555-100-1000',
    '+1-555-100-1001',
    'Elite Central Vacuum',
    'Default seeded administrator account.',
    true,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "status" = EXCLUDED."status",
    "fullName" = EXCLUDED."fullName",
    "phone" = EXCLUDED."phone",
    "cellphone" = EXCLUDED."cellphone",
    "companyName" = EXCLUDED."companyName",
    "notes" = EXCLUDED."notes",
    "isEmailVerified" = EXCLUDED."isEmailVerified",
    "isDeleted" = EXCLUDED."isDeleted",
    "updatedAt" = NOW()
  RETURNING "id"
)
INSERT INTO "AdminProfile" (
  "id",
  "userId",
  "avatarUrl",
  "bio",
  "createdAt",
  "updatedAt"
)
VALUES (
  'seed-admin-profile',
  (SELECT "id" FROM admin_user),
  NULL,
  'Default seeded administrator account.',
  NOW(),
  NOW()
)
ON CONFLICT ("userId") DO UPDATE SET
  "bio" = EXCLUDED."bio",
  "updatedAt" = NOW();

WITH technician_user AS (
  INSERT INTO "User" (
    "id",
    "email",
    "passwordHash",
    "role",
    "status",
    "fullName",
    "phone",
    "cellphone",
    "companyName",
    "notes",
    "isEmailVerified",
    "isDeleted",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'seed-tech-user',
    ${sqlString(techEmail)},
    ${sqlString(techPasswordHash)},
    'TECHNICIAN',
    'ACTIVE',
    'Elite Technician',
    '+1-555-200-2000',
    '+1-555-200-2001',
    NULL,
    'Default seeded technician account.',
    true,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "status" = EXCLUDED."status",
    "fullName" = EXCLUDED."fullName",
    "phone" = EXCLUDED."phone",
    "cellphone" = EXCLUDED."cellphone",
    "companyName" = EXCLUDED."companyName",
    "notes" = EXCLUDED."notes",
    "isEmailVerified" = EXCLUDED."isEmailVerified",
    "isDeleted" = EXCLUDED."isDeleted",
    "updatedAt" = NOW()
  RETURNING "id"
),
technician_profile AS (
  INSERT INTO "TechnicianProfile" (
    "id",
    "userId",
    "status",
    "avatarUrl",
    "bio",
    "isVerified",
    "availabilityNote",
    "documents",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'seed-tech-profile',
    (SELECT "id" FROM technician_user),
    'ACTIVE',
    NULL,
    'Default seeded technician account.',
    true,
    'Available for service scheduling.',
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId") DO UPDATE SET
    "status" = EXCLUDED."status",
    "bio" = EXCLUDED."bio",
    "isVerified" = EXCLUDED."isVerified",
    "availabilityNote" = EXCLUDED."availabilityNote",
    "updatedAt" = NOW()
  RETURNING "id"
),
repair_spec AS (
  INSERT INTO "TechnicianSpecialization" (
    "id",
    "name",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'seed-tech-spec-repair',
    'Central Vacuum Repair',
    NOW(),
    NOW()
  )
  ON CONFLICT ("name") DO UPDATE SET
    "updatedAt" = NOW()
  RETURNING "id"
),
install_spec AS (
  INSERT INTO "TechnicianSpecialization" (
    "id",
    "name",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'seed-tech-spec-installation',
    'Installation',
    NOW(),
    NOW()
  )
  ON CONFLICT ("name") DO UPDATE SET
    "updatedAt" = NOW()
  RETURNING "id"
)
INSERT INTO "_TechnicianProfileToTechnicianSpecialization" ("A", "B")
VALUES
  ((SELECT "id" FROM technician_profile), (SELECT "id" FROM repair_spec)),
  ((SELECT "id" FROM technician_profile), (SELECT "id" FROM install_spec))
ON CONFLICT DO NOTHING;

COMMIT;
`;
}

async function main() {
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ??
    'admin@elitecentralvacuum.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const techEmail =
    process.env.SEED_TECH_EMAIL?.trim().toLowerCase() ??
    'tech@elitecentralvacuum.com';
  const techPassword = process.env.SEED_TECH_PASSWORD ?? 'Tech123!';

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const techPasswordHash = await bcrypt.hash(techPassword, 12);

  const sql = buildSeedSql({
    adminPasswordHash,
    techPasswordHash,
    adminEmail,
    techEmail,
  });

  fs.writeFileSync(tempSqlPath, sql, 'utf8');

  try {
    execFileSync(
      'cmd',
      ['/c', 'npx', 'prisma', 'db', 'execute', '--schema', 'prisma/schema', '--file', tempSqlPath],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      },
    );
  } finally {
    if (fs.existsSync(tempSqlPath)) {
      fs.unlinkSync(tempSqlPath);
    }
  }

  console.log('Seed complete');
  console.log(`Admin: ${adminEmail}`);
  console.log(`Technician: ${techEmail}`);
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exitCode = 1;
});
