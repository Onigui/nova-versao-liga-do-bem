import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar usuário admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ligadobembotucatu.org.br' },
    update: {},
    create: {
      email: 'admin@ligadobembotucatu.org.br',
      name: 'Administrador Liga do Bem',
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('✅ Usuário admin criado:', adminUser.email);

  // Criar alguns parceiros de exemplo
  const partners = await Promise.all([
    prisma.partner.upsert({
      where: { id: 'partner-1' },
      update: {},
      create: {
        id: 'partner-1',
        name: 'Pet Shop Amigo',
        description: 'Pet shop especializado em cuidados para animais',
        category: 'Pet Shop',
        email: 'contato@petshopamigo.com.br',
        phone: '(14) 99876-5432',
        address: 'Rua das Flores, 123',
        city: 'Botucatu',
        state: 'SP',
        zipCode: '18608-000',
        latitude: -22.8858,
        longitude: -48.4440,
        isActive: true
      }
    }),
    prisma.partner.upsert({
      where: { id: 'partner-2' },
      update: {},
      create: {
        id: 'partner-2',
        name: 'Clínica Veterinária Vida',
        description: 'Clínica veterinária 24h com emergência',
        category: 'Veterinário',
        email: 'contato@clinicavida.com.br',
        phone: '(14) 99876-5433',
        address: 'Av. Principal, 456',
        city: 'Botucatu',
        state: 'SP',
        zipCode: '18608-100',
        latitude: -22.8850,
        longitude: -48.4430,
        isActive: true
      }
    }),
    prisma.partner.upsert({
      where: { id: 'partner-3' },
      update: {},
      create: {
        id: 'partner-3',
        name: 'Farmácia Pet',
        description: 'Farmácia especializada em medicamentos veterinários',
        category: 'Farmácia',
        email: 'contato@farmaciapet.com.br',
        phone: '(14) 99876-5434',
        address: 'Rua Central, 789',
        city: 'Botucatu',
        state: 'SP',
        zipCode: '18608-200',
        latitude: -22.8840,
        longitude: -48.4420,
        isActive: true
      }
    })
  ]);

  console.log('✅ Parceiros criados:', partners.length);

  // Criar descontos para os parceiros
  await Promise.all([
    prisma.partnerDiscount.create({
      data: {
        partnerId: 'partner-1',
        name: 'Desconto em Produtos',
        description: '15% de desconto em todos os produtos',
        percentage: 15,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano
      }
    }),
    prisma.partnerDiscount.create({
      data: {
        partnerId: 'partner-2',
        name: 'Consulta com Desconto',
        description: '20% de desconto em consultas',
        percentage: 20,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    }),
    prisma.partnerDiscount.create({
      data: {
        partnerId: 'partner-3',
        name: 'Medicamentos',
        description: '10% de desconto em medicamentos',
        percentage: 10,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    })
  ]);

  console.log('✅ Descontos criados');

  // Criar alguns animais de exemplo
  const animals = await Promise.all([
    prisma.animal.create({
      data: {
        name: 'Luna',
        species: 'DOG',
        breed: 'SRD',
        age: 24, // 2 anos em meses
        gender: 'FEMALE',
        size: 'MEDIUM',
        description: 'Luna é uma cadela muito carinhosa e brincalhona. Adora crianças e se dá bem com outros animais.',
        isVaccinated: true,
        isCastrated: true,
        hasSpecialNeeds: false,
        isActive: true
      }
    }),
    prisma.animal.create({
      data: {
        name: 'Max',
        species: 'DOG',
        breed: 'Golden Retriever',
        age: 48, // 4 anos em meses
        gender: 'MALE',
        size: 'LARGE',
        description: 'Max é um cão muito dócil e inteligente. Perfeito para famílias com crianças maiores.',
        isVaccinated: true,
        isCastrated: true,
        hasSpecialNeeds: false,
        isActive: true
      }
    }),
    prisma.animal.create({
      data: {
        name: 'Mimi',
        species: 'CAT',
        breed: 'SRD',
        age: 12, // 1 ano em meses
        gender: 'FEMALE',
        size: 'SMALL',
        description: 'Mimi é uma gatinha muito independente e carinhosa. Ideal para apartamentos.',
        isVaccinated: true,
        isCastrated: true,
        hasSpecialNeeds: false,
        isActive: true
      }
    })
  ]);

  console.log('✅ Animais criados:', animals.length);

  // Criar um evento de exemplo
  const event = await prisma.event.create({
    data: {
      title: 'Feira de Adoção - Centro',
      description: 'Venha conhecer nossos animais resgatados e encontre seu novo melhor amigo!',
      type: 'ADOPTION_FAIR',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias no futuro
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // 8 horas depois
      location: 'Praça da Matriz',
      address: 'Centro, Botucatu - SP',
      latitude: -22.8858,
      longitude: -48.4440,
      maxAttendees: 100,
      currentAttendees: 0,
      isActive: true
    }
  });

  console.log('✅ Evento criado:', event.title);

  // Criar relatório financeiro de exemplo
  const financialReport = await prisma.financialReport.create({
    data: {
      year: 2024,
      month: 1,
      type: 'MONTHLY',
      title: 'Relatório Mensal - Janeiro 2024',
      description: 'Relatório financeiro do mês de janeiro de 2024',
      income: 15000,
      expenses: 12000,
      isPublished: true
    }
  });

  // Criar itens de despesa
  await Promise.all([
    prisma.financialExpense.create({
      data: {
        reportId: financialReport.id,
        category: 'VETERINARY',
        description: 'Consultas veterinárias e vacinas',
        amount: 5000
      }
    }),
    prisma.financialExpense.create({
      data: {
        reportId: financialReport.id,
        category: 'FOOD',
        description: 'Ração e alimentação dos animais',
        amount: 4000
      }
    }),
    prisma.financialExpense.create({
      data: {
        reportId: financialReport.id,
        category: 'MEDICATIONS',
        description: 'Medicamentos e tratamentos',
        amount: 3000
      }
    })
  ]);

  console.log('✅ Relatório financeiro criado');

  console.log('🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
