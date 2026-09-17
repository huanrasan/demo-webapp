// Fixture intencionalmente inválido para tests/lint/forbidden-patterns.test.ts. Excluido del lint normal.
declare const prisma: {
  $queryRawUnsafe: (sql: string) => Promise<unknown>;
  $executeRawUnsafe: (sql: string) => Promise<unknown>;
};

export async function unsafe(name: string) {
  await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE name = '${name}'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE name = '${name}'`);
  return <div dangerouslySetInnerHTML={{ __html: name }} />;
}
