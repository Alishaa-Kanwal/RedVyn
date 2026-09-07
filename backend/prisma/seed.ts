import "dotenv/config";
import { prisma } from "../src/db";
import { Role } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/password";
import { createDonor, createPatient } from "../src/services/registry.service";

/** A handful of Lahore donors around Children's Hospital, enough to exercise matching. */
const DONORS: [string, string, string, number, number][] = [
  ["Bilal", "03001234501", "B_POS", 31.4795, 74.3005],
  ["Faisal", "03001234502", "B_POS", 31.4832, 74.3121],
  ["Nadia", "03001234503", "B_NEG", 31.4901, 74.2955],
  ["Usman", "03001234504", "O_NEG", 31.4750, 74.3080],
  ["Hina", "03001234505", "O_POS", 31.5210, 74.3480],
  ["Kashif", "03001234506", "A_POS", 31.4788, 74.2990],
  ["Sana", "03001234507", "O_NEG", 31.4812, 74.3040],
  ["Imran", "03001234508", "B_POS", 31.5600, 74.4000],
];

async function seedAdmin(): Promise<void> {
  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_SEED_PASSWORD"];
  if (!email || !password) {
    console.log("ADMIN_EMAIL or ADMIN_SEED_PASSWORD not set — skipping admin seed.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log("Admin user already exists — skipping.");
    return;
  }

  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name: "Admin",
      role: Role.admin,
    },
  });

  console.log(`Seeded admin user: ${email}`);
}

async function main(): Promise<void> {
  await seedAdmin();

  const existing = await prisma.hospital.findFirst({ where: { name: "Children's Hospital Lahore" } });
  if (existing) {
    await prisma.hospital.update({
      where: { id: existing.id },
      data: {
        verified: true,
        email: "hospital@redvyn.test",
        passwordHash: await hashPassword("hospital123"),
      },
    });
    console.log("Already seeded — refreshed hospital login: hospital@redvyn.test / hospital123");
    return;
  }

  const hospital = await prisma.hospital.create({
    data: {
      name: "Children's Hospital Lahore",
      city: "Lahore",
      lat: 31.4805,
      lon: 74.3025,
      deskInfo: "Blood bank, ground floor, gate 2",
      verified: true,
      email: "hospital@redvyn.test",
      passwordHash: await hashPassword("hospital123"),
    },
  });

  await prisma.hospital.create({
    data: {
      name: "Services Hospital Lahore",
      city: "Lahore",
      lat: 31.5382,
      lon: 74.3287,
      deskInfo: "Blood bank, block C",
    },
  });

  for (const [firstName, phone, bloodGroup, lat, lon] of DONORS) {
    await createDonor({
      firstName,
      phone,
      bloodGroup: bloodGroup as never,
      city: "Lahore",
      lat,
      lon,
      language: "ur",
    });
  }

  await createPatient({
    firstName: "Hamza",
    guardianPhone: "03009876543",
    bloodGroup: "B_POS" as never,
    homeHospitalId: hospital.id,
    intervalDaysEstimate: 21,
    lastTransfusionAt: new Date(Date.now() - 19 * 86400_000),
  });

  console.log(`Seeded ${DONORS.length} donors, 2 hospitals, 1 patient.`);
  console.log("Hospital login: hospital@redvyn.test / hospital123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
