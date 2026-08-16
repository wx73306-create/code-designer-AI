// ============================================================================
// Prisma Seed — 初始化管理员、角色权限、演示用户
// 运行: npx prisma db seed （需在 package.json 配置 prisma.seed）
// ============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // --- 权限 ---
  const permissionNames = [
    'users.read', 'users.write',
    'projects.read', 'projects.write',
    'agents.read', 'settings.read', 'settings.write',
    'stats.read', 'logs.read',
  ]
  for (const name of permissionNames) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} permission` },
    })
  }
  console.log(`✓ ${permissionNames.length} permissions`)

  // --- 角色 ---
  const roles = [
    { name: 'super_admin', description: '超级管理员，拥有全部权限', permissions: permissionNames },
    { name: 'developer', description: '开发者，可查看 Agent/日志/系统', permissions: ['agents.read', 'logs.read', 'stats.read', 'settings.read'] },
    { name: 'operation', description: '运营，可查看用户/项目', permissions: ['users.read', 'projects.read', 'stats.read'] },
    { name: 'support', description: '客服，仅可查看用户', permissions: ['users.read'] },
  ]
  for (const r of roles) {
    await prisma.roleModel.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions },
      create: { name: r.name, description: r.description, permissions: r.permissions },
    })
  }
  console.log(`✓ ${roles.length} roles`)

  // --- 管理员用户 ---
  const adminEmail = process.env.ADMIN_EMAIL || '050125@Code Designer AI.com'
  const adminPassword = process.env.ADMIN_PASSWORD || '050125why'
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: adminPasswordHash, role: 'ADMIN' },
    create: {
      email: adminEmail,
      name: 'Admin',
      password: adminPasswordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  })
  await prisma.admin.upsert({
    where: { userId: admin.id },
    update: { permissions: permissionNames },
    create: { userId: admin.id, permissions: permissionNames },
  })
  console.log(`✓ Admin user: ${adminEmail}`)

  // --- 演示普通用户 ---
  const demoPasswordHash = await bcrypt.hash('demo1234', 12)
  const demo = await prisma.user.upsert({
    where: { email: 'demo@codedesigner.ai' },
    update: {},
    create: {
      email: 'demo@codedesigner.ai',
      name: 'Demo User',
      password: demoPasswordHash,
      role: 'USER',
      emailVerified: new Date(),
    },
  })
  await prisma.quota.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      used: 0,
      limit: 2,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })
  console.log('✓ Demo user: demo@codedesigner.ai (password: demo1234)')

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
