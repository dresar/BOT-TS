import { PrismaClient, KnowledgeCategory, ScheduleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@desa.id',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created admin user:', adminUser.username);

  // Create default knowledge items
  const knowledgeItems = [
    {
      slug: 'admin-ktp',
      title: 'Cara Membuat KTP Baru',
      content: 'Untuk KTP baru, siapkan fotokopi KK & surat pengantar RT/RW, lalu datang ke kantor desa pada jam kerja.',
      category: KnowledgeCategory.ADMIN_KTP,
    },
    {
      slug: 'admin-kk',
      title: 'Prosedur Kartu Keluarga',
      content: 'Urus KK dengan surat pengantar RT/RW, fotokopi KTP, dan dokumen pendukung (nikah/akta lahir bila perlu).',
      category: KnowledgeCategory.ADMIN_KK,
    },
    {
      slug: 'admin-pindah',
      title: 'Surat Pindah Domisili',
      content: 'Surat pindah perlu pengantar RT/RW, fotokopi KK & KTP, serta pas foto 3×4.',
      category: KnowledgeCategory.ADMIN_PINDAH,
    },
    {
      slug: 'admin-akta',
      title: 'Akta Kelahiran/Kematian',
      content: 'Akta kelahiran/kematian: bawa dokumen pendukung (KK, KTP, surat keterangan terkait). Proses di kantor desa.',
      category: KnowledgeCategory.ADMIN_AKTA,
    },
    {
      slug: 'sos-bansos',
      title: 'Bantuan Sosial',
      content: 'Info bantuan sosial (PKH/BPNT) silakan datang ke kantor desa atau hubungi staf pelayanan sosial.',
      category: KnowledgeCategory.SOS_BANSOS,
    },
    {
      slug: 'posyandu',
      title: 'Jadwal Posyandu',
      content: 'Jadwal Posyandu tersedia di kantor desa dan papan informasi. Anda juga bisa cek di sini bila jadwal sudah diinput.',
      category: KnowledgeCategory.POSYANDU,
    },
    {
      slug: 'keuangan-pbb',
      title: 'Pembayaran PBB',
      content: 'PBB bisa dibayar di kantor desa atau bank yang ditunjuk. Tagihan dapat dicek lewat petugas desa.',
      category: KnowledgeCategory.KEUANGAN_PBB,
    },
    {
      slug: 'keuangan-sampah',
      title: 'Retribusi Sampah',
      content: 'Retribusi sampah: jadwal & biaya ditetapkan desa. Silakan cek di kantor atau tanya petugas.',
      category: KnowledgeCategory.KEUANGAN_SAMPAH,
    },
    {
      slug: 'umum-jam',
      title: 'Jam Operasional',
      content: 'Kantor desa: Sen–Jum 08.00–16.00 WIB, istirahat 12.00–13.00 WIB.',
      category: KnowledgeCategory.UMUM_JAM,
    },
    {
      slug: 'umum-kontak',
      title: 'Kontak Kantor Desa',
      content: 'Nomor telepon kantor desa: {{PHONE}}.',
      category: KnowledgeCategory.UMUM_KONTAK,
    },
  ];

  for (const item of knowledgeItems) {
    await prisma.knowledgeItem.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        content: item.content,
        category: item.category,
        updatedBy: adminUser.id,
      },
      create: {
        ...item,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
    });
  }

  console.log('✅ Created knowledge items');

  // Create default config
  const configs = [
    {
      key: 'office_hours',
      value: {
        monday: { open: '08:00', close: '16:00', break_start: '12:00', break_end: '13:00' },
        tuesday: { open: '08:00', close: '16:00', break_start: '12:00', break_end: '13:00' },
        wednesday: { open: '08:00', close: '16:00', break_start: '12:00', break_end: '13:00' },
        thursday: { open: '08:00', close: '16:00', break_start: '12:00', break_end: '13:00' },
        friday: { open: '08:00', close: '16:00', break_start: '12:00', break_end: '13:00' },
        saturday: null,
        sunday: null,
      },
    },
    {
      key: 'contact_info',
      value: {
        office_phone: process.env.DESA_PHONE || '08xxxxxxxxxx',
        office_address: 'Kantor Desa',
        email: 'info@desa.id',
      },
    },
    {
      key: 'bot_settings',
      value: {
        confidence_threshold: 0.6,
        rate_limit_per_minute: 10,
        max_message_length: 1000,
        out_of_scope_message: 'Maaf, pertanyaan Anda di luar lingkup layanan saya. Silakan hubungi kantor desa untuk info lebih lanjut.',
      },
    },
  ];

  for (const config of configs) {
    await prisma.config.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  console.log('✅ Created default configs');

  // Create sample schedule
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(15);

  await prisma.schedule.upsert({
    where: { id: 'sample-posyandu' },
    update: {},
    create: {
      id: 'sample-posyandu',
      type: ScheduleType.POSYANDU,
      title: 'Posyandu Balita',
      description: 'Pemeriksaan kesehatan balita dan imunisasi',
      date: nextMonth,
      time: '09:00',
      location: 'Balai Desa',
      notes: 'Bawa buku KIA dan KTP',
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    },
  });

  console.log('✅ Created sample schedule');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });